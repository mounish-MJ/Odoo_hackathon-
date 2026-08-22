import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createApp } from '../src/server';
import { AuditService } from '../src/audit/audit.service';
import { EventAuditOrchestrator } from '../src/audit/event-audit.orchestrator';
import { PlatformEventBus } from '../src/orchestration/event-bus';
import { StandardEventType, StandardEvent } from '../src/contracts/event.contract';
import { Role } from '../src/contracts/authorization.contract';
import { AuthSecurityService } from '../src/security/auth.middleware';

describe('Member 4 Comprehensive Audit Trail Component Tests', () => {
  let app: any;
  let auditService: AuditService;
  let eventBus: PlatformEventBus;
  let orchestrator: EventAuditOrchestrator;

  beforeEach(() => {
    eventBus = PlatformEventBus.getInstance();
    eventBus.clear();
    auditService = AuditService.getInstance();
    auditService.clear();
    orchestrator = EventAuditOrchestrator.getInstance(eventBus, auditService);
    orchestrator.wireEventListeners();
    app = createApp();
  });

  afterEach(() => {
    orchestrator.unbind();
  });

  describe('1. Automatic Workflow & Security Event Capture', () => {
    test('LeaveRequested event creates an immutable audit record with correlationId', async () => {
      const event: StandardEvent = {
        eventId: uuidv4(),
        eventType: StandardEventType.LEAVE_REQUESTED,
        timestamp: new Date().toISOString(),
        actor: { userId: 'emp_123', role: Role.EMPLOYEE },
        source: 'MEMBER_3_FRONTEND',
        resourceType: 'leave',
        resourceId: 'LR-101',
        correlationId: 'trace-audit-01',
        payload: {
          days: 3,
          leaveType: 'SICK',
          startDate: '2026-09-01',
        },
      };

      await eventBus.publish(event);
      await new Promise((resolve) => setTimeout(resolve, 60));

      const result = await auditService.queryAuditLogs({
        correlationId: 'trace-audit-01',
        action: 'LEAVE_REQUESTED',
      });
      expect(result.total).toBe(1);
      expect(result.logs[0].action).toBe('LEAVE_REQUESTED');
      expect(result.logs[0].userId).toBe('emp_123');
      expect(result.logs[0].resourceId).toBe('LR-101');
      expect(result.logs[0].correlationId).toBe('trace-audit-01');
    });

    test('LeaveApproved and LeaveRejected events generate corresponding audit records', async () => {
      await eventBus.publish({
        eventId: uuidv4(),
        eventType: StandardEventType.LEAVE_APPROVED,
        timestamp: new Date().toISOString(),
        actor: { userId: 'mgr_456', role: Role.MANAGER },
        source: 'MEMBER_4_PLATFORM',
        resourceType: 'leave',
        resourceId: 'LR-102',
        correlationId: 'trace-audit-02',
        payload: {
          leaveRequestId: 'LR-102',
          approvedBy: 'mgr_456',
          daysDeducted: 4,
        },
      });

      await eventBus.publish({
        eventId: uuidv4(),
        eventType: StandardEventType.LEAVE_REJECTED,
        timestamp: new Date().toISOString(),
        actor: { userId: 'mgr_456', role: Role.MANAGER },
        source: 'MEMBER_4_PLATFORM',
        resourceType: 'leave',
        resourceId: 'LR-103',
        correlationId: 'trace-audit-03',
        payload: {
          leaveRequestId: 'LR-103',
          rejectedBy: 'mgr_456',
          reason: 'Overlap with critical audit',
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 60));

      const approvedLog = await auditService.queryAuditLogs({ correlationId: 'trace-audit-02' });
      expect(approvedLog.total).toBe(1);
      expect(approvedLog.logs[0].action).toBe('LEAVE_APPROVED');

      const rejectedLog = await auditService.queryAuditLogs({ correlationId: 'trace-audit-03' });
      expect(rejectedLog.total).toBe(1);
      expect(rejectedLog.logs[0].action).toBe('LEAVE_REJECTED');
    });

    test('ActionFailed event creates failure audit record with error diagnostics', async () => {
      await eventBus.publish({
        eventId: uuidv4(),
        eventType: StandardEventType.ACTION_FAILED,
        timestamp: new Date().toISOString(),
        actor: { userId: 'system', role: 'SYSTEM' },
        source: 'MEMBER_4_PLATFORM',
        resourceType: 'workflow',
        resourceId: 'wf_failed_01',
        correlationId: 'trace-audit-04',
        payload: {
          workflowId: 'wf_failed_01',
          workflowType: 'payroll-process',
          failedStep: '5_DETERMINISTIC_ACTION',
          error: 'Database transaction lock timeout',
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 60));

      const failedLog = await auditService.queryAuditLogs({ correlationId: 'trace-audit-04' });
      expect(failedLog.total).toBe(1);
      expect(failedLog.logs[0].action).toBe('HR_ACTION_FAILED');
      expect(failedLog.logs[0].status).toBe('FAILURE');
      expect(failedLog.logs[0].failureReason).toContain('Database transaction lock timeout');
    });
  });

  describe('2. PII & Secret Scrubbing in Audit Logs', () => {
    test('Deeply scrubs all passwords, bank accounts, SSN, and salaries before saving', async () => {
      const record = await auditService.recordAudit({
        userId: 'emp_secret',
        userRole: Role.EMPLOYEE,
        action: 'PROFILE_UPDATED',
        resourceType: 'employee',
        resourceId: 'emp_secret',
        oldData: {
          salary: 90000,
          bankAccount: 'US1234567890',
          password: 'MyPassword123!',
          department: 'Sales',
        },
        newData: {
          salary: 95000,
          bankAccount: 'US9876543210',
          password: 'NewPassword456!',
          department: 'Sales Lead',
        },
        status: 'SUCCESS',
      });

      expect(record.oldData?.salary).toBe('[REDACTED]');
      expect(record.oldData?.bankAccount).toBe('[REDACTED]');
      expect(record.oldData?.password).toBe('[REDACTED]');
      expect(record.newData?.salary).toBe('[REDACTED]');
      expect(record.newData?.bankAccount).toBe('[REDACTED]');
      expect(record.newData?.password).toBe('[REDACTED]');
      expect(record.diff?.department).toEqual({ from: 'Sales', to: 'Sales Lead' });
    });
  });

  describe('3. Audit Query API Protected by RBAC', () => {
    test('Admin and HR can query audit logs with filters', async () => {
      await auditService.recordAudit({
        userId: 'emp_999',
        userRole: Role.EMPLOYEE,
        action: 'ATTENDANCE_ANOMALY',
        resourceType: 'attendance',
        resourceId: 'att_999',
        correlationId: 'trace-api-query',
        status: 'SUCCESS',
      });

      const adminToken = AuthSecurityService.generateToken({
        userId: 'admin_1',
        name: 'Admin Root',
        email: 'admin@dayflow.app',
        role: Role.ADMIN,
      });

      const hrToken = AuthSecurityService.generateToken({
        userId: 'hr_1',
        name: 'HR Lead',
        email: 'hr@dayflow.app',
        role: Role.HR,
      });

      // Admin Query
      const adminRes = await request(app)
        .get('/api/v1/audit/logs?action=ATTENDANCE_ANOMALY')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminRes.status).toBe(200);
      expect(adminRes.body.success).toBe(true);
      expect(adminRes.body.data.length).toBeGreaterThanOrEqual(1);

      // HR Query
      const hrRes = await request(app)
        .get('/api/v1/audit/logs?resourceType=attendance')
        .set('Authorization', `Bearer ${hrToken}`);

      expect(hrRes.status).toBe(200);
      expect(hrRes.body.success).toBe(true);
    });

    test('Non-authorized roles (Employee / Manager) are rejected with 403 Forbidden', async () => {
      const employeeToken = AuthSecurityService.generateToken({
        userId: 'emp_reg',
        name: 'Regular Employee',
        email: 'emp@dayflow.app',
        role: Role.EMPLOYEE,
      });

      const managerToken = AuthSecurityService.generateToken({
        userId: 'mgr_reg',
        name: 'Regular Manager',
        email: 'mgr@dayflow.app',
        role: Role.MANAGER,
      });

      const empRes = await request(app)
        .get('/api/v1/audit/logs')
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(empRes.status).toBe(403);

      const mgrRes = await request(app)
        .get('/api/v1/audit/logs')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(mgrRes.status).toBe(403);
    });
  });
});
