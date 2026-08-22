import { v4 as uuidv4 } from 'uuid';
import {
  ApprovalContract,
  ApprovalRequest,
  ApprovalDecision,
  ApprovalStatus,
  ApprovalRule,
} from '../contracts/approval.contract';
import { Role } from '../contracts/authorization.contract';

export class ApprovalRouter implements ApprovalContract {
  private static instance: ApprovalRouter;
  private pendingApprovals: Map<string, ApprovalRequest> = new Map();
  private rules: Map<string, ApprovalRule> = new Map();

  constructor() {
    this.initializeDefaultRules();
  }

  public static getInstance(): ApprovalRouter {
    if (!ApprovalRouter.instance) {
      ApprovalRouter.instance = new ApprovalRouter();
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
   * Evaluates if a workflow can be AUTO_APPROVED based on AI risk score or requires routing.
   */
  public async evaluateApprovalRequirement(
    workflowType: string,
    payload: Record<string, unknown>,
    aiRiskScore = 0.5,
    aiConfidence = 0.5
  ): Promise<{ status: ApprovalStatus; reason: string; assignedRole?: Role; assignedUserId?: string }> {
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
    const assignedUserId = typeof payload.reportingManagerId === 'string' ? payload.reportingManagerId : undefined;

    return {
      status: ApprovalStatus.PENDING,
      reason: `Requires human review (Risk Score: ${(aiRiskScore * 100).toFixed(1)}%, Confidence: ${(aiConfidence * 100).toFixed(1)}%)`,
      assignedRole,
      assignedUserId,
    };
  }

  /**
   * Creates and registers a new pending approval request.
   */
  public createApprovalRequest(params: {
    workflowId: string;
    workflowType: string;
    requesterId: string;
    requesterName: string;
    assignedToRoleId: Role;
    assignedToUserId?: string;
    aiRiskScore?: number;
    aiConfidence?: number;
    aiRationale?: string;
  }): ApprovalRequest {
    const approvalId = uuidv4();
    const request: ApprovalRequest = {
      approvalId,
      workflowId: params.workflowId,
      workflowType: params.workflowType,
      requesterId: params.requesterId,
      requesterName: params.requesterName,
      assignedToRoleId: params.assignedToRoleId,
      assignedToUserId: params.assignedToUserId,
      status: ApprovalStatus.PENDING,
      aiRiskScore: params.aiRiskScore,
      aiConfidence: params.aiConfidence,
      aiRationale: params.aiRationale,
      createdAt: new Date().toISOString(),
    };

    this.pendingApprovals.set(approvalId, request);
    return request;
  }

  /**
   * Processes a manager/HR approval or rejection decision.
   */
  public async processDecision(decision: ApprovalDecision): Promise<ApprovalRequest> {
    const approval = this.pendingApprovals.get(decision.approvalId);
    if (!approval) {
      throw new Error(`Approval request with ID ${decision.approvalId} not found`);
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      throw new Error(`Approval request is already in status '${approval.status}'`);
    }

    approval.status = decision.status;
    approval.decidedAt = decision.decidedAt || new Date().toISOString();
    approval.decidedBy = decision.deciderId;
    approval.comments = decision.comments;

    return approval;
  }

  public getApproval(approvalId: string): ApprovalRequest | undefined {
    return this.pendingApprovals.get(approvalId);
  }

  public getPendingApprovals(role?: Role, userId?: string): ApprovalRequest[] {
    return Array.from(this.pendingApprovals.values()).filter((a) => {
      if (a.status !== ApprovalStatus.PENDING) return false;
      if (userId && a.assignedToUserId && a.assignedToUserId === userId) return true;
      if (role && a.assignedToRoleId === role) return true;
      return !role && !userId;
    });
  }

  public clear(): void {
    this.pendingApprovals.clear();
  }
}
