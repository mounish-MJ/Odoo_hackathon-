import { BaseWorkflow } from './base.workflow';
import { WorkflowContext, WorkflowStatus } from '../../contracts/workflow.contract';
import { IHRCoreService } from '../../contracts/hr-core.contract';
import { IAIEngineService } from '../../contracts/ai-engine.contract';
import { ApprovalRouter } from '../approval-router';
import { ApprovalStatus } from '../../contracts/approval.contract';
import { NotificationChannel, NotificationType } from '../../contracts/notification.contract';
import { Role } from '../../contracts/authorization.contract';
import { RbacSecurityGuard } from '../../security/rbac.guard';

export interface LeaveRequestPayload {
  leaveRequestId?: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  leaveTypeId: string;
  leaveTypeName?: string;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  reportingManagerId?: string;
  departmentId?: string;
}

export interface LeaveRequestResult {
  leaveRequestId: string;
  status: string;
  daysDeducted: number;
  newBalance: number;
  aiRiskScore?: number;
  aiConfidence?: number;
  approvedBy?: string;
  approvalStatus: ApprovalStatus;
  attendanceUpdated?: boolean;
}

export class LeaveRequestWorkflow extends BaseWorkflow<LeaveRequestPayload, LeaveRequestResult> {
  public workflowType = 'leave-request';

  private hrCoreService: IHRCoreService;
  private aiEngineService: IAIEngineService;
  private approvalRouter: ApprovalRouter;

  constructor(
    hrCoreService: IHRCoreService,
    aiEngineService: IAIEngineService,
    approvalRouter?: ApprovalRouter
  ) {
    super();
    this.hrCoreService = hrCoreService;
    this.aiEngineService = aiEngineService;
    this.approvalRouter = approvalRouter || ApprovalRouter.getInstance();
  }

  // 1. Ingestion Validation
  public async validateEvent(
    context: WorkflowContext<LeaveRequestPayload, LeaveRequestResult>
  ): Promise<boolean> {
    const p = context.event.payload;
    if (!p.userId || !p.leaveTypeId || !p.startDate || !p.endDate || !p.days) {
      throw new Error('Invalid leave payload: missing userId, leaveTypeId, dates, or days count');
    }
    if (p.days <= 0) {
      throw new Error('Invalid leave days count: must be greater than 0');
    }

    // Verify sufficient balance in Member 1 HR Core
    const balance = await this.hrCoreService.getLeaveBalance(p.userId, p.leaveTypeId);
    if (balance.available < p.days) {
      throw new Error(
        `Insufficient leave balance. Available: ${balance.available}, Requested: ${p.days}`
      );
    }

    return true;
  }

  // 2. Permission Check
  public async checkPermissions(
    context: WorkflowContext<LeaveRequestPayload, LeaveRequestResult>
  ): Promise<boolean> {
    const user = context.user || {
      userId: context.event.payload.userId,
      email: context.event.payload.userEmail || '',
      name: context.event.payload.userName || '',
      role: Role.EMPLOYEE,
    };

    return RbacSecurityGuard.canExecuteAction(user, {
      resourceType: 'leave',
      action: 'create',
      resourceOwnerId: context.event.payload.userId,
    });
  }

  // 3. AI Risk Assessment & Approval Routing
  public async evaluateRisk(
    context: WorkflowContext<LeaveRequestPayload, LeaveRequestResult>
  ): Promise<{
    riskScore?: number;
    confidence?: number;
    decision: 'AUTO_PROCEED' | 'REQUIRE_APPROVAL' | 'REJECT';
  }> {
    const p = context.event.payload;

    // Call Member 2 AI Engine for risk scoring & recommendation
    const aiAssessment = await this.aiEngineService.evaluateLeaveRisk({
      userId: p.userId,
      leaveType: p.leaveTypeId,
      days: p.days,
      startDate: p.startDate,
      endDate: p.endDate,
      departmentId: p.departmentId,
    });

    // Check with ApprovalRouter against policy thresholds
    const approvalEval = await this.approvalRouter.evaluateApprovalRequirement(
      this.workflowType,
      p as unknown as Record<string, unknown>,
      aiAssessment.riskScore,
      aiAssessment.approvalConfidence
    );

    if (approvalEval.status === ApprovalStatus.AUTO_APPROVED) {
      context.approvalStatus = ApprovalStatus.AUTO_APPROVED;
      return {
        riskScore: aiAssessment.riskScore,
        confidence: aiAssessment.approvalConfidence,
        decision: 'AUTO_PROCEED',
      };
    }

    // Create pending approval request routed to Manager
    const approvalRequest = this.approvalRouter.createApprovalRequest({
      workflowId: context.workflowId,
      workflowType: this.workflowType,
      requesterId: p.userId,
      requesterName: p.userName || 'Employee',
      assignedToRoleId: approvalEval.assignedRole || Role.MANAGER,
      assignedToUserId: approvalEval.assignedUserId,
      aiRiskScore: aiAssessment.riskScore,
      aiConfidence: aiAssessment.approvalConfidence,
      aiRationale: aiAssessment.factors.join(', '),
    });

    context.approvalStatus = ApprovalStatus.PENDING;
    context.approvalId = approvalRequest.approvalId;
    context.assignedApproverId = approvalRequest.assignedToUserId;

    // Notify manager that approval is required
    await this.notificationService.send({
      recipientId: approvalRequest.assignedToUserId || 'MANAGER_POOL',
      recipientRole: Role.MANAGER,
      type: NotificationType.APPROVAL_REQUEST,
      title: 'Leave Approval Required',
      message: `${p.userName || 'Employee'} requested ${p.days} day(s) leave from ${p.startDate} to ${p.endDate}. AI Risk: ${(aiAssessment.riskScore * 100).toFixed(0)}%`,
      channels: [NotificationChannel.IN_APP, NotificationChannel.SSE_STREAM],
      data: {
        workflowId: context.workflowId,
        approvalId: approvalRequest.approvalId,
        requesterId: p.userId,
        days: p.days,
        aiScore: aiAssessment.riskScore,
      },
    });

    return {
      riskScore: aiAssessment.riskScore,
      confidence: aiAssessment.approvalConfidence,
      decision: 'REQUIRE_APPROVAL',
    };
  }

  // 4. Deterministic Core Action (Member 1 HR Core State Mutation)
  public async executeDeterministicAction(
    context: WorkflowContext<LeaveRequestPayload, LeaveRequestResult>
  ): Promise<LeaveRequestResult> {
    const p = context.event.payload;
    const leaveRequestId = p.leaveRequestId || `LR-${context.workflowId.substring(0, 8)}`;

    // 1. Deduct balance from Member 1 Core
    const balanceResult = await this.hrCoreService.deductLeaveBalance({
      userId: p.userId,
      leaveTypeId: p.leaveTypeId,
      days: p.days,
      reason: `Leave Request ${leaveRequestId} Approved`,
    });

    if (!balanceResult.success) {
      throw new Error(`Failed to deduct leave balance in Member 1 HR Core`);
    }

    // 2. Update status in Member 1 Core
    const approverName =
      context.approvalStatus === ApprovalStatus.AUTO_APPROVED
        ? 'AI_AUTO_APPROVER'
        : context.assignedApproverId || 'Manager';

    await this.hrCoreService.updateLeaveRequestStatus(
      leaveRequestId,
      'APPROVED',
      approverName,
      'Approved via Dayflow Orchestration Engine'
    );

    // 3. Update attendance/calendar in Member 1 Core
    const attendanceResult = await this.hrCoreService.recordAttendance({
      userId: p.userId,
      date: p.startDate,
      status: 'LEAVE',
      notes: `Approved leave: ${p.startDate} to ${p.endDate} (${p.days} days)`,
    });

    return {
      leaveRequestId,
      status: 'APPROVED',
      daysDeducted: p.days,
      newBalance: balanceResult.newBalance,
      approvedBy: approverName,
      approvalStatus: context.approvalStatus || ApprovalStatus.APPROVED,
      attendanceUpdated: attendanceResult.success,
    };
  }

  // 5. Verification
  public async verifyAction(
    context: WorkflowContext<LeaveRequestPayload, LeaveRequestResult>,
    actionResult: LeaveRequestResult
  ): Promise<boolean> {
    // Verify that the result contains expected properties and state is verified
    return (
      actionResult.status === 'APPROVED' &&
      actionResult.daysDeducted === context.event.payload.days &&
      typeof actionResult.newBalance === 'number' &&
      actionResult.attendanceUpdated === true
    );
  }

  // 6. Notification Dispatch
  public async dispatchNotifications(
    context: WorkflowContext<LeaveRequestPayload, LeaveRequestResult>
  ): Promise<void> {
    const p = context.event.payload;
    const res = context.output;

    // Send real-time SSE + In-App notification to Employee
    await this.notificationService.send({
      recipientId: p.userId,
      recipientRole: Role.EMPLOYEE,
      type: NotificationType.LEAVE_STATUS,
      title: 'Leave Request Approved',
      message: `Your leave request for ${p.days} day(s) (${p.startDate} to ${p.endDate}) was approved. Remaining balance: ${res?.newBalance ?? 'N/A'}.`,
      channels: [NotificationChannel.IN_APP, NotificationChannel.SSE_STREAM, NotificationChannel.WEBHOOK],
      data: {
        workflowId: context.workflowId,
        leaveRequestId: res?.leaveRequestId,
        status: 'APPROVED',
        newBalance: res?.newBalance,
      },
    });

    // Notify HR of the approved leave and calendar update
    await this.notificationService.send({
      recipientId: 'HR_POOL',
      recipientRole: Role.HR,
      type: NotificationType.LEAVE_STATUS,
      title: 'Employee Leave Approved',
      message: `Leave approved for ${p.userName || p.userId} (${p.days} days from ${p.startDate} to ${p.endDate}). Attendance marked.`,
      channels: [NotificationChannel.IN_APP, NotificationChannel.SSE_STREAM],
      data: {
        workflowId: context.workflowId,
        userId: p.userId,
        leaveRequestId: res?.leaveRequestId,
      },
    });
  }

  // 7. Immutable Audit Event Creation
  public async recordAuditEvent(
    context: WorkflowContext<LeaveRequestPayload, LeaveRequestResult>
  ): Promise<void> {
    const p = context.event.payload;
    const res = context.output;

    await this.auditService.recordAudit({
      userId: p.userId,
      userRole: context.user?.role || Role.EMPLOYEE,
      action: 'LEAVE_REQUEST.APPROVED_AND_EXECUTED',
      resourceType: 'leave_request',
      resourceId: res?.leaveRequestId || context.workflowId,
      oldData: {
        userId: p.userId,
        status: 'PENDING',
        requestedDays: p.days,
      },
      newData: {
        userId: p.userId,
        status: 'APPROVED',
        daysDeducted: res?.daysDeducted,
        newBalance: res?.newBalance,
        approvalType: context.approvalStatus,
      },
      ipAddress: context.event.metadata?.ipAddress,
      userAgent: context.event.metadata?.userAgent,
      status: 'SUCCESS',
      metadata: {
        workflowId: context.workflowId,
        correlationId: context.event.correlationId || context.event.metadata?.correlationId || context.workflowId,
      },
    });
  }
}
