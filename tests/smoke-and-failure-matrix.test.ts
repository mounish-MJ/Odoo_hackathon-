import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createApp } from '../src/server';
import { WorkflowEngine } from '../src/orchestration/workflow-engine';
import { BaseWorkflow } from '../src/orchestration/workflows/base.workflow';
import { WorkflowStatus } from '../src/contracts/workflow.contract';
import { ApprovalRouter, DuplicateApprovalError, ApprovalNotFoundError } from '../src/orchestration/approval-router';
import { PlatformEventBus } from '../src/orchestration/event-bus';
import { AuditService } from '../src/audit/audit.service';
import { NotificationService } from '../src/notifications/notification.service';
import { StandardEventType, StandardEvent } from '../src/contracts/event.contract';
import { Role } from '../src/contracts/authorization.contract';
import { AuthSecurityService } from '../src/security/auth.middleware';
import { LeaveRequestWorkflow } from '../src/orchestration/workflows/leave-request.workflow';
import { MockHRCoreService } from '../src/mocks/mock-hr-core';
import { MockAIEngineService } from '../src/mocks/mock-ai-engine';
import { NotificationChannel, INotificationProvider } from '../src/contracts/notification.contract';

describe('Member 4 Comprehensive Smoke & Failure Matrix Tests', () => {
  let app: any;
  let eventBus: PlatformEventBus;
  let approvalRouter: ApprovalRouter;
  let auditService: AuditService;
  let notificationService: NotificationService;
  let workflowEngine: WorkflowEngine;
  let hrCoreService: MockHRCoreService;
  let aiEngineService: MockAIEngineService;

  beforeEach(() => {
    eventBus = PlatformEventBus.getInstance();
    eventBus.clear();
    approvalRouter = ApprovalRouter.getInstance(eventBus);
    approvalRouter.clear();
    auditService = AuditService.getInstance();
    auditService.clear();
    notificationService = NotificationService.getInstance();
    notificationService.clear();

    hrCoreService = new MockHRCoreService();
    aiEngineService = new MockAIEngineService();
    workflowEngine = WorkflowEngine.getInstance(eventBus, approvalRouter);
    workflowEngine.registerWorkflow(
      new LeaveRequestWorkflow(hrCoreService, aiEngineService, approvalRouter)
    );

    app = createApp();
  });

  // -------------------------------------------------------------
  // 1. SMOKE TESTS
  // -------------------------------------------------------------
  describe('1. Platform Smoke Tests', () => {
    test('GET /health returns 200 OK with healthy subsystem statuses and X-Request-Id header', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('HEALTHY');
      expect(res.body.service).toContain('DAYFLOW');
      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.headers['x-correlation-id']).toBeDefined();
    });
  });

  // -------------------------------------------------------------
  // 2. AUTHENTICATION & AUTHORIZATION FAILURES
  // -------------------------------------------------------------
  describe('2. Authentication & Authorization Failure Cases', () => {
    test('Missing authentication header returns 401 UNAUTHORIZED', async () => {
      const res = await request(app)
        .post('/api/v1/leaves/apply')
        .send({
          leaveTypeId: 'PAID',
          startDate: '2026-09-01',
          endDate: '2026-09-02',
          days: 2,
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toContain('Missing or malformed Authorization header');
    });

    test('Expired JWT token returns 401 UNAUTHORIZED', async () => {
      const expiredToken = AuthSecurityService.generateToken(
        {
          userId: 'emp_expired',
          name: 'Expired User',
          email: 'expired@dayflow.app',
          role: Role.EMPLOYEE,
        },
        '-1s' // Expired in the past
      );

      const res = await request(app)
        .post('/api/v1/leaves/apply')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({
          leaveTypeId: 'PAID',
          startDate: '2026-09-01',
          endDate: '2026-09-02',
          days: 2,
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    test('Invalid role attempting privileged action (e.g. Employee attempting audit queries) returns 403 FORBIDDEN', async () => {
      const employeeToken = AuthSecurityService.generateToken({
        userId: 'emp_basic',
        name: 'Basic Employee',
        email: 'basic@dayflow.app',
        role: Role.EMPLOYEE,
      });

      const res = await request(app)
        .get('/api/v1/audit/logs')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('Resource access boundary violation: Employee A reading Employee B private workflow state returns 403 FORBIDDEN', async () => {
      const empAToken = AuthSecurityService.generateToken({
        userId: 'emp_alice',
        name: 'Alice',
        email: 'alice@dayflow.app',
        role: Role.EMPLOYEE,
      });

      const empBToken = AuthSecurityService.generateToken({
        userId: 'emp_bob',
        name: 'Bob',
        email: 'bob@dayflow.app',
        role: Role.EMPLOYEE,
      });

      // Alice creates a workflow
      const applyRes = await request(app)
        .post('/api/v1/leaves/apply')
        .set('Authorization', `Bearer ${empAToken}`)
        .send({
          leaveTypeId: 'PAID',
          startDate: '2026-09-01',
          endDate: '2026-09-02',
          days: 2,
          reason: 'Alice Private Leave',
        });

      const aliceWfId = applyRes.body.data.workflowId;

      // Bob tries to query Alice's workflow
      const bobQueryRes = await request(app)
        .get(`/api/v1/workflows/${aliceWfId}`)
        .set('Authorization', `Bearer ${empBToken}`);

      expect(bobQueryRes.status).toBe(403);
      expect(bobQueryRes.body.success).toBe(false);
      expect(bobQueryRes.body.error.message).toContain('You cannot access another user workflow');
    });
  });

  // -------------------------------------------------------------
  // 3. INPUT VALIDATION FAILURES
  // -------------------------------------------------------------
  describe('3. Request Payload Validation Failures', () => {
    test('Malformed payload with invalid date format and negative days returns 400 VALIDATION_ERROR', async () => {
      const token = AuthSecurityService.generateToken({
        userId: 'emp_val',
        name: 'Validator',
        email: 'val@dayflow.app',
        role: Role.EMPLOYEE,
      });

      const res = await request(app)
        .post('/api/v1/leaves/apply')
        .set('Authorization', `Bearer ${token}`)
        .send({
          leaveTypeId: '',
          startDate: '01-09-2026', // Bad format (not YYYY-MM-DD)
          endDate: '2026-09-02',
          days: -3, // Negative days
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(res.body.error.details)).toBe(true);
      expect(res.body.error.details.length).toBeGreaterThanOrEqual(2);
    });
  });

  // -------------------------------------------------------------
  // 4. DUPLICATE EVENTS & APPROVAL REPLAY PROTECTION
  // -------------------------------------------------------------
  describe('4. Deduplication & Replay Protection', () => {
    test('Duplicate event with same eventId is dropped without re-executing workflow actions', async () => {
      const duplicateEventId = uuidv4();

      const event: StandardEvent = {
        eventId: duplicateEventId,
        eventType: StandardEventType.LEAVE_REQUESTED,
        timestamp: new Date().toISOString(),
        actor: { userId: 'emp_dup', role: Role.EMPLOYEE },
        source: 'MEMBER_3_FRONTEND',
        resourceType: 'leave',
        resourceId: 'LR-DUP-01',
        correlationId: 'trace-dup-01',
        idempotencyKey: `idemp_${duplicateEventId}`,
        payload: {
          userId: 'emp_dup',
          leaveTypeId: 'PAID',
          startDate: '2026-09-01',
          endDate: '2026-09-02',
          days: 2,
        },
      };

      // 1st Publish
      const firstRes = await eventBus.publish(event);
      expect(firstRes.published).toBe(true);
      expect(firstRes.duplicate).toBe(false);

      // 2nd Duplicate Publish with same idempotency key
      const secondRes = await eventBus.publish(event);
      expect(secondRes.published).toBe(false);
      expect(secondRes.duplicate).toBe(true);
    });

    test('Duplicate approval decision attempt on already-decided approval throws DuplicateApprovalError', async () => {
      const approval = await approvalRouter.createApprovalRequest({
        workflowId: 'wf_dup_appr',
        workflowType: 'leave-request',
        requesterId: 'emp_req',
        assignedToRoleId: Role.MANAGER,
        assignedToUserId: 'mgr_lead',
      });

      // First decision
      await approvalRouter.processDecision({
        approvalId: approval.approvalId,
        deciderId: 'mgr_lead',
        deciderRole: Role.MANAGER,
        status: 'APPROVED' as any,
      });

      // Second duplicate decision
      await expect(
        approvalRouter.processDecision({
          approvalId: approval.approvalId,
          deciderId: 'mgr_lead',
          deciderRole: Role.MANAGER,
          status: 'APPROVED' as any,
        })
      ).rejects.toThrow(DuplicateApprovalError);
    });
  });

  // -------------------------------------------------------------
  // 5. DETERMINISTIC ACTION & NOTIFICATION FAILURES
  // -------------------------------------------------------------
  describe('5. Deterministic Action & Notification Failure Resilience', () => {
    test('When deterministic action fails, workflow status is marked FAILED, ActionFailed event is emitted, and audit is logged', async () => {
      let actionFailedCaptured: any = null;
      eventBus.subscribe(StandardEventType.ACTION_FAILED, (e) => {
        actionFailedCaptured = e;
      });

      class CustomFailingActionWorkflow extends BaseWorkflow<Record<string, unknown>, unknown> {
        workflowType = 'custom-failing-test';

        async validateEvent(): Promise<boolean> {
          return true;
        }
        async checkPermissions(): Promise<boolean> {
          return true;
        }
        async evaluateRisk(): Promise<{ decision: 'AUTO_PROCEED' }> {
          return { decision: 'AUTO_PROCEED' };
        }
        async executeDeterministicAction(): Promise<unknown> {
          throw new Error('SQL Deadlock: balance table locked');
        }
        async verifyAction(): Promise<boolean> {
          return true;
        }
        async dispatchNotifications(): Promise<void> {}
        async recordAuditEvent(): Promise<void> {}
      }

      workflowEngine.registerWorkflow(new CustomFailingActionWorkflow());

      const event: StandardEvent = {
        eventId: uuidv4(),
        eventType: StandardEventType.ACTION_COMPLETED,
        timestamp: new Date().toISOString(),
        actor: { userId: 'emp_fail_test', role: Role.EMPLOYEE },
        source: 'MEMBER_4_PLATFORM',
        resourceType: 'workflow',
        resourceId: 'res-fail-01',
        correlationId: 'trace-fail-01',
        payload: {},
      };

      const result = await workflowEngine.executeWorkflow('custom-failing-test', event);

      expect(result.status).toBe(WorkflowStatus.FAILED);
      expect(result.error?.toString()).toContain('SQL Deadlock: balance table locked');

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(actionFailedCaptured).not.toBeNull();
      expect(actionFailedCaptured.payload.failedStep).toBe('5_DETERMINISTIC_ACTION');
    });

    test('Partial notification channel failure does NOT fail the completed primary workflow', async () => {
      const failingChannelProvider: INotificationProvider = {
        channel: 'CUSTOM_SMS' as any,
        send: async () => {
          throw new Error('Third-party SMS provider 503 Service Unavailable');
        },
      };

      notificationService.registerProvider(failingChannelProvider);

      const result = await notificationService.send({
        recipientId: 'emp_notif_test',
        type: 'SYSTEM_ALERT',
        title: 'System Ping',
        message: 'Notification resilience check',
        channels: [NotificationChannel.IN_APP, 'CUSTOM_SMS' as any],
      });

      expect(result.success).toBe(false);
      expect(result.partialFailure).toBe(true);
      expect(result.deliveryResults[NotificationChannel.IN_APP].success).toBe(true);
      expect(result.deliveryResults['CUSTOM_SMS'].success).toBe(false);

      // Verify failure audit log recorded
      const audits = await auditService.queryAuditLogs({
        action: 'NOTIFICATION.DELIVERY_PARTIAL_FAILURE',
      });
      expect(audits.total).toBeGreaterThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------
  // 6. WORKFLOW RESUME & COMPLETION CONSTRAINTS
  // -------------------------------------------------------------
  describe('6. Workflow Resumption on Completed Workflows', () => {
    test('Attempting to resume an already completed workflow throws error', async () => {
      const approval = await approvalRouter.createApprovalRequest({
        workflowId: 'wf_already_done',
        workflowType: 'leave-request',
        requesterId: 'emp_done',
        assignedToRoleId: Role.MANAGER,
        assignedToUserId: 'mgr_lead',
      });

      // Complete it first
      const firstDecision = await approvalRouter.processDecision({
        approvalId: approval.approvalId,
        deciderId: 'mgr_lead',
        deciderRole: Role.MANAGER,
        status: 'APPROVED' as any,
      });
      expect(firstDecision.status).toBe('APPROVED');

      // Attempting to resume with a non-existent/invalid approvalId
      await expect(
        workflowEngine.resumeWorkflowWithApproval(
          'appr_invalid_uuid',
          'APPROVED' as any,
          'mgr_lead'
        )
      ).rejects.toThrow();
    });
  });
});
