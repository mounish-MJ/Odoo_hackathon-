import { v4 as uuidv4 } from 'uuid';
import {
  ApprovalContract,
  ApprovalRequest,
  ApprovalDecision,
  ApprovalStatus,
  ApprovalRule,
  ApprovalRequirementEvaluation,
} from '../contracts/approval.contract';
import { Role } from '../contracts/authorization.contract';
import { PlatformEventBus } from './event-bus';
import { StandardEventType } from '../contracts/event.contract';

export class ApprovalNotFoundError extends Error {
  constructor(approvalId: string) {
    super(`Approval request with ID '${approvalId}' was not found`);
    this.name = 'ApprovalNotFoundError';
  }
}

export class UnauthorizedApproverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedApproverError';
  }
}

export class SelfApprovalForbiddenError extends Error {
  constructor(requesterId: string) {
    super(`Self-approval forbidden: User '${requesterId}' cannot approve their own privileged request`);
    this.name = 'SelfApprovalForbiddenError';
  }
}

export class DuplicateApprovalError extends Error {
  constructor(approvalId: string, currentStatus: ApprovalStatus) {
    super(`Approval request '${approvalId}' is already finalized in status '${currentStatus}'`);
    this.name = 'DuplicateApprovalError';
  }
}

export class ApprovalRouter implements ApprovalContract {
  private static instance: ApprovalRouter;
  private approvals: Map<string, ApprovalRequest> = new Map();
  private workflowApprovalIndex: Map<string, string> = new Map(); // workflowId -> approvalId
  private rules: Map<string, ApprovalRule> = new Map();
  private eventBus: PlatformEventBus;

  constructor(eventBus?: PlatformEventBus) {
    this.eventBus = eventBus || PlatformEventBus.getInstance();
    this.initializeDefaultRules();
  }

  public static getInstance(eventBus?: PlatformEventBus): ApprovalRouter {
    if (!ApprovalRouter.instance) {
      ApprovalRouter.instance = new ApprovalRouter(eventBus);
    }
    return ApprovalRouter.instance;
  }

  private initializeDefaultRules(): void {
    // Default Leave Approval Rule
    this.rules.set('leave-request', {
      ruleId: 'rule-leave-default',
      workflowType: 'leave-request',
      autoApproveRiskThreshold: 0.25, // Risk <= 25%
      autoApproveConfidenceThreshold: 0.85, // AI confidence >= 85%
      requiresManagerApproval: true,
      requiresHrApproval: false,
      maxDaysAutoApprove: 2, // Max 2 days for auto-approval
    });

    // Default Payroll Processing Rule
    this.rules.set('payroll-process', {
      ruleId: 'rule-payroll-default',
      workflowType: 'payroll-process',
      autoApproveRiskThreshold: 0.05,
      autoApproveConfidenceThreshold: 0.95,
      requiresManagerApproval: false,
      requiresHrApproval: true,
    });
  }

  /**
   * Sets custom approval evaluation rule for a workflow type.
   */
  public registerRule(rule: ApprovalRule): void {
    this.rules.set(rule.workflowType, rule);
  }

  /**
   * Evaluates if a workflow can be AUTO_APPROVED based on AI risk score or requires routing.
   */
  public async evaluateApprovalRequirement(
    workflowType: string,
    payload: Record<string, unknown>,
    aiRiskScore = 0.5,
    aiConfidence = 0.5
  ): Promise<ApprovalRequirementEvaluation> {
    const rule = this.rules.get(workflowType);

    if (!rule) {
      return {
        status: ApprovalStatus.PENDING,
        reason: 'No auto-approval rule defined. Requires Manager approval.',
        assignedRole: Role.MANAGER,
      };
    }

    const daysRequested = typeof payload.days === 'number' ? payload.days : 1;

    // Check Auto-Approval eligibility
    const qualifiesForAutoApproval =
      aiRiskScore <= rule.autoApproveRiskThreshold &&
      aiConfidence >= rule.autoApproveConfidenceThreshold &&
      (!rule.maxDaysAutoApprove || daysRequested <= rule.maxDaysAutoApprove);

    if (qualifiesForAutoApproval) {
      return {
        status: ApprovalStatus.AUTO_APPROVED,
        reason: `Auto-approved by AI Engine (Risk Score: ${(aiRiskScore * 100).toFixed(1)}%, Confidence: ${(aiConfidence * 100).toFixed(1)}%)`,
      };
    }

    // Otherwise route to Manager or HR
    const assignedRole = rule.requiresHrApproval ? Role.HR : Role.MANAGER;
    const assignedUserId =
      typeof payload.reportingManagerId === 'string'
        ? payload.reportingManagerId
        : undefined;

    return {
      status: ApprovalStatus.PENDING,
      reason: `Requires human review (Risk Score: ${(aiRiskScore * 100).toFixed(1)}%, Confidence: ${(aiConfidence * 100).toFixed(1)}%)`,
      assignedRole,
      assignedUserId,
    };
  }

  /**
   * Creates and registers a new pending approval request linked to workflow & resource.
   */
  public async createApprovalRequest(params: {
    workflowId: string;
    workflowType: string;
    resourceType?: string;
    resourceId?: string;
    correlationId?: string;
    requesterId: string;
    requesterName?: string;
    assignedToRoleId: Role;
    assignedToUserId?: string;
    aiRiskScore?: number;
    aiConfidence?: number;
    aiRationale?: string;
  }): Promise<ApprovalRequest> {
    const approvalId = `appr_${uuidv4().substring(0, 8)}`;
    const request: ApprovalRequest = {
      approvalId,
      workflowId: params.workflowId,
      workflowType: params.workflowType,
      resourceType: params.resourceType || 'workflow',
      resourceId: params.resourceId || params.workflowId,
      correlationId: params.correlationId,
      requesterId: params.requesterId,
      requesterName: params.requesterName || params.requesterId,
      assignedToRoleId: params.assignedToRoleId,
      assignedToUserId: params.assignedToUserId,
      status: ApprovalStatus.PENDING,
      aiRiskScore: params.aiRiskScore,
      aiConfidence: params.aiConfidence,
      aiRationale: params.aiRationale,
      createdAt: new Date().toISOString(),
    };

    this.approvals.set(approvalId, request);
    this.workflowApprovalIndex.set(params.workflowId, approvalId);

    // Emit ApprovalRequested event
    await this.eventBus.publish({
      eventId: uuidv4(),
      eventType: StandardEventType.APPROVAL_REQUESTED,
      timestamp: request.createdAt,
      actor: { userId: params.requesterId, role: Role.EMPLOYEE },
      source: 'MEMBER_4_PLATFORM',
      resourceType: request.resourceType,
      resourceId: request.resourceId,
      correlationId: params.correlationId || uuidv4(),
      payload: {
        approvalId,
        workflowId: params.workflowId,
        workflowType: params.workflowType,
        requesterId: params.requesterId,
        assignedToRoleId: params.assignedToRoleId,
        assignedToUserId: params.assignedToUserId,
        aiRiskScore: params.aiRiskScore,
      },
    });

    return request;
  }

  /**
   * Processes a manager/HR approval or rejection decision with strict authorization & self-approval checks.
   */
  public async processDecision(decision: ApprovalDecision): Promise<ApprovalRequest> {
    const approval = this.approvals.get(decision.approvalId);
    if (!approval) {
      throw new ApprovalNotFoundError(decision.approvalId);
    }

    // 1. Duplicate Decision Check
    if (approval.status !== ApprovalStatus.PENDING) {
      throw new DuplicateApprovalError(decision.approvalId, approval.status);
    }

    // 2. Self-Approval Enforcement (Employees/Requesters cannot approve their own requests)
    if (
      approval.requesterId === decision.deciderId &&
      decision.deciderRole !== Role.ADMIN
    ) {
      throw new SelfApprovalForbiddenError(approval.requesterId);
    }

    // 3. Approver Role Authorization Check
    if (decision.deciderRole === Role.EMPLOYEE) {
      throw new UnauthorizedApproverError(
        'Employees are not authorized to approve or reject workflow requests'
      );
    }

    // If assigned to a specific manager, verify decider is that manager or Admin/HR
    if (
      approval.assignedToUserId &&
      decision.deciderId !== approval.assignedToUserId &&
      decision.deciderRole !== Role.ADMIN &&
      decision.deciderRole !== Role.HR
    ) {
      throw new UnauthorizedApproverError(
        `User '${decision.deciderId}' is not the assigned approver for this request`
      );
    }

    // 4. Record Decision
    approval.status = decision.status;
    approval.decidedAt = decision.decidedAt || new Date().toISOString();
    approval.decidedBy = decision.deciderId;
    approval.comments = decision.comments;

    // 5. Emit ApprovalApproved or ApprovalRejected Event
    const eventType =
      decision.status === ApprovalStatus.APPROVED
        ? StandardEventType.APPROVAL_APPROVED
        : StandardEventType.APPROVAL_REJECTED;

    await this.eventBus.publish({
      eventId: uuidv4(),
      eventType,
      timestamp: approval.decidedAt,
      actor: { userId: decision.deciderId, role: decision.deciderRole },
      source: 'MEMBER_4_PLATFORM',
      resourceType: approval.resourceType,
      resourceId: approval.resourceId,
      correlationId: approval.correlationId || uuidv4(),
      payload: {
        approvalId: approval.approvalId,
        workflowId: approval.workflowId,
        decision: decision.status,
        decidedBy: decision.deciderId,
        comments: decision.comments,
      },
    });

    return approval;
  }

  public getApprovalById(approvalId: string): ApprovalRequest | undefined {
    return this.approvals.get(approvalId);
  }

  public getApprovalByWorkflowId(workflowId: string): ApprovalRequest | undefined {
    const approvalId = this.workflowApprovalIndex.get(workflowId);
    return approvalId ? this.approvals.get(approvalId) : undefined;
  }

  public getPendingApprovals(role?: Role, userId?: string): ApprovalRequest[] {
    return Array.from(this.approvals.values()).filter((req) => {
      if (req.status !== ApprovalStatus.PENDING) return false;
      if (role && req.assignedToRoleId !== role && role !== Role.ADMIN) return false;
      if (userId && req.assignedToUserId && req.assignedToUserId !== userId) return false;
      return true;
    });
  }

  public clear(): void {
    this.approvals.clear();
    this.workflowApprovalIndex.clear();
  }
}
