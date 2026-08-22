import { WorkflowEngine } from '../src/orchestration/workflow-engine';
import { PlatformEventBus } from '../src/orchestration/event-bus';
import { ApprovalRouter } from '../src/orchestration/approval-router';
import { LeaveRequestWorkflow } from '../src/orchestration/workflows/leave-request.workflow';
import { AttendanceAnomalyWorkflow } from '../src/orchestration/workflows/attendance-anomaly.workflow';
import { PayrollProcessWorkflow } from '../src/orchestration/workflows/payroll-process.workflow';
import { MockHRCoreService } from '../src/mocks/mock-hr-core';
import { MockAIEngineService } from '../src/mocks/mock-ai-engine';
import { EventContract, EventType } from '../src/contracts/event.contract';
import { WorkflowStatus } from '../src/contracts/workflow.contract';
import { ApprovalStatus } from '../src/contracts/approval.contract';
import { AuditService } from '../src/audit/audit.service';
import { NotificationService } from '../src/notifications/notification.service';
import { Role } from '../src/contracts/authorization.contract';
import { v4 as uuidv4 } from 'uuid';

describe('Member 4 Orchestration Layer — 8-Step Core Pipeline Tests', () => {
  let eventBus: PlatformEventBus;
  let approvalRouter: ApprovalRouter;
  let workflowEngine: WorkflowEngine;
  let hrCore: MockHRCoreService;
  let aiEngine: MockAIEngineService;
  let auditService: AuditService;
  let notifService: NotificationService;

  beforeEach(() => {
    eventBus = new PlatformEventBus();
    approvalRouter = new ApprovalRouter();
    hrCore = new MockHRCoreService();
    aiEngine = new MockAIEngineService();
    auditService = new AuditService();
    notifService = new NotificationService();

    workflowEngine = new WorkflowEngine(eventBus, approvalRouter);

    workflowEngine.registerWorkflow(
      new LeaveRequestWorkflow(hrCore, aiEngine, approvalRouter)
    );
    workflowEngine.registerWorkflow(
      new AttendanceAnomalyWorkflow(hrCore, aiEngine)
    );
    workflowEngine.registerWorkflow(
      new PayrollProcessWorkflow(hrCore)
    );
  });

  test('1. Short Leave Request is Auto-Approved via AI & completes all 8 steps', async () => {
    const event: EventContract = {
      eventId: uuidv4(),
      eventType: EventType.LEAVE_APPLIED,
      producerId: 'MEMBER_3_FRONTEND',
      idempotencyKey: `idemp_${uuidv4()}`,
      timestamp: new Date().toISOString(),
      metadata: {
        correlationId: uuidv4(),
        userId: 'user_123',
        userRole: 'EMPLOYEE',
        timestamp: new Date().toISOString(),
        version: '1.0',
      },
      payload: {
        userId: 'user_123',
        userName: 'John Doe',
        leaveTypeId: 'PAID',
        startDate: '2026-09-01',
        endDate: '2026-09-02',
        days: 2, // <= 2 days qualifies for AI auto-approval
        reason: 'Personal time off',
      },
    };

    const context = await workflowEngine.executeWorkflow('leave-request', event);

    // Verify 8-step pipeline execution
    expect(context.status).toBe(WorkflowStatus.COMPLETED);
    expect(context.approvalStatus).toBe(ApprovalStatus.AUTO_APPROVED);
    expect(context.output).toBeDefined();
    expect((context.output as any).status).toBe('APPROVED');
    expect((context.output as any).newBalance).toBe(13); // 15 initial - 2 days = 13

    // Verify Step Metrics were recorded
    expect(context.stepResults['1_VALIDATION'].status).toBe('SUCCESS');
    expect(context.stepResults['2_PERMISSION_CHECK'].status).toBe('SUCCESS');
    expect(context.stepResults['3_RISK_EVALUATION'].status).toBe('SUCCESS');
    expect(context.stepResults['5_DETERMINISTIC_ACTION'].status).toBe('SUCCESS');
    expect(context.stepResults['6_VERIFICATION'].status).toBe('SUCCESS');
    expect(context.stepResults['7_NOTIFICATION_DISPATCH'].status).toBe('SUCCESS');
    expect(context.stepResults['8_AUDIT_LOGGING'].status).toBe('SUCCESS');
  });

  test('2. Long Leave Request pauses for Manager Approval, then completes upon manager decision', async () => {
    const event: EventContract = {
      eventId: uuidv4(),
      eventType: EventType.LEAVE_APPLIED,
      producerId: 'MEMBER_3_FRONTEND',
      idempotencyKey: `idemp_${uuidv4()}`,
      timestamp: new Date().toISOString(),
      metadata: {
        correlationId: uuidv4(),
        userId: 'user_123',
        userRole: 'EMPLOYEE',
        timestamp: new Date().toISOString(),
        version: '1.0',
      },
      payload: {
        userId: 'user_123',
        userName: 'John Doe',
        reportingManagerId: 'mgr_456',
        leaveTypeId: 'PAID',
        startDate: '2026-09-01',
        endDate: '2026-09-07',
        days: 5, // > 2 days requires human approval
        reason: 'Family vacation',
      },
    };

    // Initial run halts at Approval Gate
    const context = await workflowEngine.executeWorkflow('leave-request', event);

    expect(context.status).toBe(WorkflowStatus.AWAITING_APPROVAL);
    expect(context.approvalStatus).toBe(ApprovalStatus.PENDING);
    expect(context.approvalId).toBeDefined();

    // Manager reviews and approves the request
    const resumed = await workflowEngine.resumeWorkflowWithApproval(
      context.approvalId!,
      'APPROVED',
      'mgr_456',
      'Approved, have fun!'
    );

    expect(resumed.status).toBe(WorkflowStatus.COMPLETED);
    expect(resumed.approvalStatus).toBe(ApprovalStatus.APPROVED);
    expect((resumed.output as any).status).toBe('APPROVED');
    expect((resumed.output as any).newBalance).toBe(10); // 15 - 5 days = 10
  });

  test('3. Attendance Anomaly Workflow executes detection and telemetry action', async () => {
    const event: EventContract = {
      eventId: uuidv4(),
      eventType: EventType.ATTENDANCE_ANOMALY_DETECTED,
      producerId: 'MEMBER_2_AI_ENGINE',
      idempotencyKey: `idemp_${uuidv4()}`,
      timestamp: new Date().toISOString(),
      metadata: {
        correlationId: uuidv4(),
        userId: 'user_123',
        timestamp: new Date().toISOString(),
        version: '1.0',
      },
      payload: {
        userId: 'user_123',
        attendanceDate: '2026-08-20',
        checkInTime: '09:00',
        checkOutTime: '18:00',
        workingHours: 9.0,
        anomalyScore: 0.25, // moderate anomaly auto-proceeds
      },
    };

    const context = await workflowEngine.executeWorkflow('attendance-anomaly', event);

    expect(context.status).toBe(WorkflowStatus.COMPLETED);
    expect((context.output as any).anomalyHandled).toBe(true);
    expect((context.output as any).status).toBe('FLAGGED_RECORDED');
  });

  test('4. Payroll Process Workflow executes batch mutations & audit logs', async () => {
    const event: EventContract = {
      eventId: uuidv4(),
      eventType: EventType.PAYROLL_RUN_INITIATED,
      producerId: 'MEMBER_1_HR_CORE',
      idempotencyKey: `idemp_${uuidv4()}`,
      timestamp: new Date().toISOString(),
      metadata: {
        correlationId: uuidv4(),
        userId: 'hr_user_99',
        userRole: Role.HR,
        timestamp: new Date().toISOString(),
        version: '1.0',
      },
      payload: {
        month: 8,
        year: 2026,
        initiatedByUserId: 'hr_user_99',
      },
    };

    const context = await workflowEngine.executeWorkflow('payroll-process', event);

    expect(context.status).toBe(WorkflowStatus.COMPLETED);
    expect((context.output as any).processedCount).toBe(2);
    expect((context.output as any).totalDisbursement).toBeGreaterThan(0);
  });
});
