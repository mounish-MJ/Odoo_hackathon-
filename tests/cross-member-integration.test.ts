import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createApp } from '../src/server';
import { AdapterFactory } from '../src/integration/adapters/adapter-factory';
import { HttpHRCoreService } from '../src/integration/adapters/http-hr-core.adapter';
import { HttpAIEngineService } from '../src/integration/adapters/http-ai-engine.adapter';
import { PlatformEventBus } from '../src/orchestration/event-bus';
import { EventIngestionService } from '../src/orchestration/event-ingestion.service';
import { StandardEventType } from '../src/contracts/event.contract';
import { Role } from '../src/contracts/authorization.contract';
import { AuthSecurityService } from '../src/security/auth.middleware';

describe('Member 4 Cross-Member Integration Verification Tests', () => {
  let app: any;
  let eventBus: PlatformEventBus;
  let eventIngestion: EventIngestionService;

  beforeEach(() => {
    eventBus = PlatformEventBus.getInstance();
    eventBus.clear();
    eventIngestion = EventIngestionService.getInstance(eventBus);
    app = createApp();
  });

  describe('Integration 1: Member 1 (HR Core Domain)', () => {
    test('HttpHRCoreService adapter seamlessly queries leave balance and records attendance without duplicating business logic', async () => {
      const hrService = new HttpHRCoreService();

      const balance = await hrService.getLeaveBalance('emp_m1_test', 'PAID');
      expect(balance).toBeDefined();
      expect(balance.available).toBeGreaterThan(0);

      const attendanceRes = await hrService.recordAttendance({
        userId: 'emp_m1_test',
        date: '2026-09-01',
        status: 'LEAVE',
        notes: 'Approved by Member 4 Platform Orchestrator',
      });
      expect(attendanceRes.success).toBe(true);
      expect(attendanceRes.attendanceId).toBeDefined();
    });

    test('Member 1 publishes domain events cleanly via EventIngestionService with zero orchestration logic', async () => {
      let capturedEvent: any = null;
      eventBus.subscribe(StandardEventType.EMPLOYEE_UPDATED, (e) => {
        capturedEvent = e;
      });

      const published = await eventIngestion.publishDomainEvent({
        eventType: StandardEventType.EMPLOYEE_UPDATED,
        resourceType: 'employee',
        resourceId: 'emp_m1_001',
        actor: { userId: 'hr_lead', role: Role.HR },
        payload: {
          departmentId: 'engineering',
          designation: 'Principal Engineer',
        },
        correlationId: 'trace-m1-pub-01',
      });

      expect(published.success).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(capturedEvent).not.toBeNull();
      expect(capturedEvent.resourceId).toBe('emp_m1_001');
    });
  });

  describe('Integration 2: Member 2 (AI Intelligence & Decision Engine)', () => {
    test('HttpAIEngineService provides AI risk evaluations as decision inputs', async () => {
      const aiService = new HttpAIEngineService();

      const riskOutput = await aiService.evaluateLeaveRisk({
        userId: 'emp_ai_test',
        leaveType: 'PAID',
        days: 1,
        startDate: '2026-09-01',
        endDate: '2026-09-01',
      });

      expect(riskOutput.riskScore).toBeDefined();
      expect(riskOutput.approvalConfidence).toBeDefined();
      expect(riskOutput.suggestedAction).toBe('AUTO_APPROVE');
    });

    test('AI recommendation NEVER bypasses authentication, authorization, or balance checks', async () => {
      // Scenario: Employee tries to apply for leave with unauthenticated / missing token
      const unauthRes = await request(app)
        .post('/api/v1/leaves/apply')
        .send({
          leaveTypeId: 'PAID',
          startDate: '2026-09-01',
          endDate: '2026-09-01',
          days: 1,
          reason: 'AI said this is 0 risk',
        });

      // Must be rejected by Security Perimeter (401 Unauthorized) regardless of AI score!
      expect(unauthRes.status).toBe(401);
      expect(unauthRes.body.success).toBe(false);
      expect(unauthRes.body.error.code).toBe('UNAUTHORIZED');
    });

    test('AI recommendation cannot bypass insufficient balance rejection', async () => {
      const employeeToken = AuthSecurityService.generateToken({
        userId: 'emp_low_bal',
        name: 'Low Balance Employee',
        email: 'lowbal@dayflow.app',
        role: Role.EMPLOYEE,
      });

      // Requesting 30 days (valid input <= 365, but exceeds available balance)
      const res = await request(app)
        .post('/api/v1/leaves/apply')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          leaveTypeId: 'PAID',
          startDate: '2026-09-01',
          endDate: '2026-09-30',
          days: 30,
          reason: 'Excessive leave request',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.data.status).toBe('FAILED');
      expect(res.body.data.error).toContain('Insufficient leave balance');
    });
  });

  describe('Integration 3: Member 3 (Product Experience & Frontend)', () => {
    test('Exposes clean workflow state querying endpoint with step durations and output', async () => {
      const employeeToken = AuthSecurityService.generateToken({
        userId: 'emp_fe_user',
        name: 'Frontend User',
        email: 'fe@dayflow.app',
        role: Role.EMPLOYEE,
      });

      // 1. Submit leave request
      const applyRes = await request(app)
        .post('/api/v1/leaves/apply')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          leaveTypeId: 'PAID',
          startDate: '2026-09-10',
          endDate: '2026-09-11',
          days: 2,
          reason: 'Frontend test application',
        });

      expect(applyRes.status).toBe(201);
      const workflowId = applyRes.body.data.workflowId;
      expect(workflowId).toBeDefined();

      // 2. Query workflow state
      const queryRes = await request(app)
        .get(`/api/v1/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(queryRes.status).toBe(200);
      expect(queryRes.body.success).toBe(true);
      expect(queryRes.body.data.workflowId).toBe(workflowId);
      expect(queryRes.body.data.status).toBe('COMPLETED');
      expect(queryRes.body.data.stepResults['1_VALIDATION'].status).toBe('SUCCESS');
      expect(queryRes.body.data.stepResults['5_DETERMINISTIC_ACTION'].status).toBe('SUCCESS');
    });

    test('Provides structured, standardized error responses for frontend form validation', async () => {
      const employeeToken = AuthSecurityService.generateToken({
        userId: 'emp_fe_user',
        name: 'Frontend User',
        email: 'fe@dayflow.app',
        role: Role.EMPLOYEE,
      });

      // Send invalid payload (negative days and bad date format)
      const res = await request(app)
        .post('/api/v1/leaves/apply')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          leaveTypeId: 'PAID',
          startDate: 'invalid-date',
          endDate: '2026-09-01',
          days: -5,
          reason: 'Bad payload test',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toBeDefined();
      expect(Array.isArray(res.body.error.details)).toBe(true);
    });
  });
});
