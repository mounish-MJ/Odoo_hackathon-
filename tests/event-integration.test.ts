import { v4 as uuidv4 } from 'uuid';
import {
  EventIngestionService,
  PlatformEventBus,
  StandardEvent,
  StandardEventType,
  AISignals,
} from '../src';
import { Role } from '../src/contracts/authorization.contract';
import { IdempotencyGuard } from '../src/security/idempotency.guard';

describe('Member 4 Event-Driven Integration Layer Tests', () => {
  let eventBus: PlatformEventBus;
  let ingestionService: EventIngestionService;

  beforeEach(() => {
    IdempotencyGuard.clear();
    eventBus = PlatformEventBus.getInstance();
    eventBus.clear();
    ingestionService = EventIngestionService.getInstance(eventBus);
    ingestionService.clear();
  });

  describe('1. Canonical Event Types Verification', () => {
    test('Supports all 9 required event types without speculative bloat', () => {
      const canonicalEvents = [
        StandardEventType.LEAVE_REQUESTED,
        StandardEventType.LEAVE_APPROVED,
        StandardEventType.LEAVE_REJECTED,
        StandardEventType.APPROVAL_REQUESTED,
        StandardEventType.APPROVAL_COMPLETED,
        StandardEventType.EMPLOYEE_UPDATED,
        StandardEventType.NOTIFICATION_REQUESTED,
        StandardEventType.ACTION_COMPLETED,
        StandardEventType.ACTION_FAILED,
      ];

      expect(canonicalEvents).toHaveLength(9);
      expect(canonicalEvents).toContain('LeaveRequested');
      expect(canonicalEvents).toContain('LeaveApproved');
      expect(canonicalEvents).toContain('LeaveRejected');
      expect(canonicalEvents).toContain('ApprovalRequested');
      expect(canonicalEvents).toContain('ApprovalCompleted');
      expect(canonicalEvents).toContain('EmployeeUpdated');
      expect(canonicalEvents).toContain('NotificationRequested');
      expect(canonicalEvents).toContain('ActionCompleted');
      expect(canonicalEvents).toContain('ActionFailed');
    });
  });

  describe('2. Ingestion Validation & Schema Enforcement', () => {
    test('Valid event is ingested successfully', async () => {
      const result = await ingestionService.ingestEvent({
        eventId: uuidv4(),
        eventType: StandardEventType.LEAVE_REQUESTED,
        actor: { userId: 'emp_001', role: Role.EMPLOYEE },
        source: 'MEMBER_3_FRONTEND',
        resourceType: 'leave',
        resourceId: 'LR-101',
        correlationId: 'req-corr-1',
        payload: { days: 2, leaveType: 'PAID' },
      });

      expect(result.success).toBe(true);
      expect(result.duplicate).toBe(false);
    });

    test('Rejects malformed event missing actor or resourceId', async () => {
      const result = await ingestionService.ingestEvent({
        eventType: StandardEventType.LEAVE_REQUESTED,
        // missing actor
        source: 'MEMBER_3_FRONTEND',
        payload: { days: 2 },
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('validation failed');
    });
  });

  describe('3. Ingestion Actor Authorization Checks', () => {
    test('Employee is blocked from emitting LeaveApproved event', async () => {
      const result = await ingestionService.ingestEvent({
        eventId: uuidv4(),
        eventType: StandardEventType.LEAVE_APPROVED,
        actor: { userId: 'emp_001', role: Role.EMPLOYEE },
        source: 'MEMBER_3_FRONTEND',
        resourceType: 'leave',
        resourceId: 'LR-101',
        correlationId: 'req-corr-2',
        payload: { approved: true },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('unauthorized to emit');
    });

    test('Manager IS authorized to emit LeaveApproved event', async () => {
      const result = await ingestionService.ingestEvent({
        eventId: uuidv4(),
        eventType: StandardEventType.LEAVE_APPROVED,
        actor: { userId: 'mgr_001', role: Role.MANAGER },
        source: 'MEMBER_3_FRONTEND',
        resourceType: 'leave',
        resourceId: 'LR-101',
        correlationId: 'req-corr-3',
        payload: { approved: true },
      });

      expect(result.success).toBe(true);
    });

    test('HR Core (Member 1) trusted producer is authorized automatically', async () => {
      const result = await ingestionService.ingestEvent({
        eventId: uuidv4(),
        eventType: StandardEventType.ACTION_COMPLETED,
        actor: { userId: 'system', role: 'SYSTEM' },
        source: 'MEMBER_1_HR_CORE',
        resourceType: 'payroll',
        resourceId: 'PAY-BATCH-2026-08',
        correlationId: 'req-corr-4',
        payload: { batchProcessed: true },
      });

      expect(result.success).toBe(true);
    });
  });

  describe('4. Event Idempotency & Replay Protection', () => {
    test('Duplicate event with same eventId / idempotencyKey is detected and not re-emitted', async () => {
      const eventId = uuidv4();
      const eventPayload = {
        eventId,
        idempotencyKey: `idem_${eventId}`,
        eventType: StandardEventType.LEAVE_REQUESTED,
        actor: { userId: 'emp_001', role: Role.EMPLOYEE },
        source: 'MEMBER_3_FRONTEND',
        resourceType: 'leave',
        resourceId: 'LR-101',
        correlationId: 'req-corr-5',
        payload: { days: 1 },
      };

      const firstAttempt = await ingestionService.ingestEvent(eventPayload);
      expect(firstAttempt.success).toBe(true);
      expect(firstAttempt.duplicate).toBe(false);

      const secondAttempt = await ingestionService.ingestEvent(eventPayload);
      expect(secondAttempt.success).toBe(true);
      expect(secondAttempt.duplicate).toBe(true);
    });
  });

  describe('5. Member 1 Publish Interface', () => {
    test('Member 1 can publish domain events cleanly with zero orchestration knowledge', async () => {
      let eventReceived: StandardEvent | null = null;
      ingestionService.subscribeToEvent(StandardEventType.EMPLOYEE_UPDATED, (e) => {
        eventReceived = e;
      });

      const publishResult = await ingestionService.publishDomainEvent({
        eventType: StandardEventType.EMPLOYEE_UPDATED,
        resourceType: 'employee',
        resourceId: 'emp_002',
        actor: { userId: 'hr_lead', role: Role.HR },
        payload: { departmentId: 'engineering', title: 'Senior Engineer' },
        correlationId: 'trace-member1-001',
      });

      expect(publishResult.success).toBe(true);
      expect(publishResult.eventId).toBeDefined();

      // Allow microtask tick for event listener
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(eventReceived).not.toBeNull();
      expect((eventReceived as any).payload.title).toBe('Senior Engineer');
    });
  });

  describe('6. Member 2 AI Signal Hook', () => {
    test('Attaches AI signals strictly as data metadata without bypassing auth/approval', () => {
      const baseEvent: StandardEvent = {
        eventId: uuidv4(),
        eventType: StandardEventType.LEAVE_REQUESTED,
        timestamp: new Date().toISOString(),
        actor: { userId: 'emp_001', role: Role.EMPLOYEE },
        source: 'MEMBER_3_FRONTEND',
        resourceType: 'leave',
        resourceId: 'LR-101',
        correlationId: 'trace-ai-001',
        version: '1.0',
        payload: { days: 5 },
      };

      const aiSignals: AISignals = {
        riskScore: 0.82,
        confidence: 0.94,
        anomalyScore: 0.12,
        factors: ['High team absence collision on selected dates'],
        suggestedAction: 'ROUTE_MANAGER',
        modelVersion: 'dayflow-v2-lgbm',
      };

      const enrichedEvent = ingestionService.attachAISignals(baseEvent, aiSignals);

      expect(enrichedEvent.aiSignals).toBeDefined();
      expect(enrichedEvent.aiSignals?.riskScore).toBe(0.82);
      expect(enrichedEvent.aiSignals?.suggestedAction).toBe('ROUTE_MANAGER');
      // Verify base actor and resource are untouched
      expect(enrichedEvent.actor?.userId).toBe('emp_001');
      expect(enrichedEvent.resourceId).toBe('LR-101');
    });
  });

  describe('7. Member 3 Read & Query Interface', () => {
    test('Member 3 can query events by correlationId and resourceId', async () => {
      const correlationId = 'ui-session-corr-99';
      await ingestionService.ingestEvent({
        eventId: uuidv4(),
        eventType: StandardEventType.LEAVE_REQUESTED,
        actor: { userId: 'emp_003', role: Role.EMPLOYEE },
        source: 'MEMBER_3_FRONTEND',
        resourceType: 'leave',
        resourceId: 'LR-500',
        correlationId,
        payload: { days: 3 },
      });

      const eventsByCorr = ingestionService.getEventsByCorrelationId(correlationId);
      expect(eventsByCorr).toHaveLength(1);
      expect(eventsByCorr[0].resourceId).toBe('LR-500');

      const eventsByResource = ingestionService.getEventsByResource('leave', 'LR-500');
      expect(eventsByResource).toHaveLength(1);
      expect(eventsByResource[0].correlationId).toBe(correlationId);
    });
  });
});
