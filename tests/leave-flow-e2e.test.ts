import request from 'supertest';
import { createApp } from '../src/server';
import { AuthSecurityService } from '../src/security/auth.middleware';
import { Role } from '../src/contracts/authorization.contract';
import { ApprovalStatus } from '../src/contracts/approval.contract';
import { WorkflowStatus } from '../src/contracts/workflow.contract';
import { PlatformEventBus } from '../src/orchestration/event-bus';
import { IdempotencyGuard } from '../src/security/idempotency.guard';

describe('Member 4 End-to-End Leave Workflow Scenario Tests', () => {
  const app = createApp();
  let employeeToken: string;
  let managerToken: string;
  let hrToken: string;

  beforeAll(() => {
    employeeToken = AuthSecurityService.generateToken({
      userId: 'user_123',
      name: 'John Doe',
      email: 'john.doe@dayflow.app',
      role: Role.EMPLOYEE,
      departmentId: 'engineering',
      reportingManagerId: 'mgr_456',
    });

    managerToken = AuthSecurityService.generateToken({
      userId: 'mgr_456',
      name: 'Jane Manager',
      email: 'jane.manager@dayflow.app',
      role: Role.MANAGER,
      departmentId: 'engineering',
    });

    hrToken = AuthSecurityService.generateToken({
      userId: 'hr_lead',
      name: 'HR Lead',
      email: 'hr.lead@dayflow.app',
      role: Role.HR,
      departmentId: 'human_resources',
    });
  });

  beforeEach(() => {
    PlatformEventBus.getInstance().clear();
    IdempotencyGuard.clear();
  });

  describe('Scenario A: Short Leave Auto-Approval Flow (<= 2 days, low risk)', () => {
    test('Employee requests 2-day leave -> Auto-approved by AI -> Balance deducted -> Attendance marked -> Notifications & Audit created', async () => {
      const res = await request(app)
        .post('/api/v1/leaves/apply')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          leaveTypeId: 'PAID',
          startDate: '2026-09-01',
          endDate: '2026-09-02',
          days: 2,
          reason: 'Personal time off',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(WorkflowStatus.COMPLETED);
      expect(res.body.data.approvalStatus).toBe(ApprovalStatus.AUTO_APPROVED);
      expect(res.body.data.output.daysDeducted).toBe(2);
      expect(res.body.data.output.attendanceUpdated).toBe(true);

      const workflowId = res.body.data.workflowId;

      // Query workflow state as exposed to Member 3 Frontend
      const stateRes = await request(app)
        .get(`/api/v1/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(stateRes.status).toBe(200);
      expect(stateRes.body.success).toBe(true);
      expect(stateRes.body.data.workflowId).toBe(workflowId);
      expect(stateRes.body.data.status).toBe(WorkflowStatus.COMPLETED);
      expect(stateRes.body.data.approvalStatus).toBe(ApprovalStatus.AUTO_APPROVED);
      expect(stateRes.body.data.stepResults['1_VALIDATION'].status).toBe('SUCCESS');
      expect(stateRes.body.data.stepResults['2_PERMISSION_CHECK'].status).toBe('SUCCESS');
      expect(stateRes.body.data.stepResults['3_RISK_EVALUATION'].status).toBe('SUCCESS');
      expect(stateRes.body.data.stepResults['5_DETERMINISTIC_ACTION'].status).toBe('SUCCESS');
      expect(stateRes.body.data.stepResults['6_VERIFICATION'].status).toBe('SUCCESS');
      expect(stateRes.body.data.stepResults['7_NOTIFICATION_DISPATCH'].status).toBe('SUCCESS');
      expect(stateRes.body.data.stepResults['8_AUDIT_LOGGING'].status).toBe('SUCCESS');
    });
  });

  describe('Scenario B: Multi-day Leave Manager Routing & Approval Flow (> 2 days)', () => {
    test('Employee requests 5-day leave -> Pauses for Manager Approval -> Manager approves -> State mutations execute & verified', async () => {
      // 1. Employee applies for 5 days
      const applyRes = await request(app)
        .post('/api/v1/leaves/apply')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          leaveTypeId: 'PAID',
          startDate: '2026-09-10',
          endDate: '2026-09-14',
          days: 5,
          reason: 'Family annual vacation',
        });

      expect(applyRes.status).toBe(201);
      expect(applyRes.body.success).toBe(true);
      expect(applyRes.body.data.status).toBe(WorkflowStatus.AWAITING_APPROVAL);
      expect(applyRes.body.data.approvalStatus).toBe(ApprovalStatus.PENDING);

      const approvalId = applyRes.body.data.approvalId;
      const workflowId = applyRes.body.data.workflowId;
      expect(approvalId).toBeDefined();

      // 2. Manager checks pending queue
      const queueRes = await request(app)
        .get('/api/v1/approvals/pending')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(queueRes.status).toBe(200);
      const pendingApproval = queueRes.body.data.find(
        (a: any) => a.approvalId === approvalId
      );
      expect(pendingApproval).toBeDefined();
      expect(pendingApproval.requesterId).toBe('user_123');

      // 3. Manager approves the leave
      const decideRes = await request(app)
        .post(`/api/v1/approvals/${approvalId}/decide`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          decision: 'APPROVED',
          comments: 'Approved with team backup arranged',
        });

      expect(decideRes.status).toBe(200);
      expect(decideRes.body.success).toBe(true);
      expect(decideRes.body.data.status).toBe(WorkflowStatus.COMPLETED);
      expect(decideRes.body.data.output.daysDeducted).toBe(5);
      expect(decideRes.body.data.output.attendanceUpdated).toBe(true);

      // 4. Employee checks updated workflow state
      const finalStateRes = await request(app)
        .get(`/api/v1/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(finalStateRes.status).toBe(200);
      expect(finalStateRes.body.data.status).toBe(WorkflowStatus.COMPLETED);
      expect(finalStateRes.body.data.approvalStatus).toBe(ApprovalStatus.APPROVED);
    });
  });

  describe('Scenario C: Manager Rejection Flow', () => {
    test('Manager rejects leave request -> Workflow transitions to FAILED with rejection reason -> No balance deducted', async () => {
      // 1. Employee applies
      const applyRes = await request(app)
        .post('/api/v1/leaves/apply')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          leaveTypeId: 'PAID',
          startDate: '2026-09-20',
          endDate: '2026-09-24',
          days: 5,
          reason: 'Optional trip',
        });

      const approvalId = applyRes.body.data.approvalId;
      const workflowId = applyRes.body.data.workflowId;

      // 2. Manager rejects
      const decideRes = await request(app)
        .post(`/api/v1/approvals/${approvalId}/decide`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          decision: 'REJECTED',
          comments: 'Critical sprint release occurring during this period',
        });

      expect(decideRes.status).toBe(200);
      expect(decideRes.body.data.status).toBe(WorkflowStatus.FAILED);

      // 3. Verify workflow state reflects failure & rejection
      const finalStateRes = await request(app)
        .get(`/api/v1/workflows/${workflowId}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(finalStateRes.status).toBe(200);
      expect(finalStateRes.body.data.status).toBe(WorkflowStatus.FAILED);
      expect(finalStateRes.body.data.approvalStatus).toBe(ApprovalStatus.REJECTED);
      expect(finalStateRes.body.data.stepResults['4_APPROVAL_GATE'].status).toBe('FAILED');
    });
  });

  describe('Scenario D: Insufficient Leave Balance Validation', () => {
    test('Rejects leave request when requested days exceed available balance', async () => {
      const res = await request(app)
        .post('/api/v1/leaves/apply')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          leaveTypeId: 'PAID',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          days: 30, // Exceeds balance
          reason: 'Month off',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.data.status).toBe(WorkflowStatus.FAILED);
      expect(res.body.data.error).toContain('Insufficient leave balance');
    });
  });
});
