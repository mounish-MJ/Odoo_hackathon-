import { Role } from './authorization.contract';

export enum ApprovalStatus {
  NOT_REQUIRED = 'NOT_REQUIRED',
  PENDING = 'PENDING',
  AUTO_APPROVED = 'AUTO_APPROVED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ESCALATED = 'ESCALATED',
  EXPIRED = 'EXPIRED',
}

export interface ApprovalRule {
  ruleId: string;
  workflowType: string;
  autoApproveRiskThreshold: number; // e.g. < 0.25 risk score means auto-approve
  autoApproveConfidenceThreshold: number; // e.g. > 0.85 AI confidence
  requiresManagerApproval: boolean;
  requiresHrApproval: boolean;
  maxDaysAutoApprove?: number; // for leave: e.g. <= 2 days
}

export interface ApprovalRequest {
  approvalId: string;
  workflowId: string;
  workflowType: string;
  resourceType: string;
  resourceId: string;
  correlationId?: string;
  requesterId: string;
  requesterName: string;
  assignedToRoleId: Role;
  assignedToUserId?: string;
  status: ApprovalStatus;
  aiRiskScore?: number;
  aiConfidence?: number;
  aiRationale?: string;
  comments?: string;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
}

export interface ApprovalDecision {
  approvalId: string;
  deciderId: string;
  deciderRole: Role;
  status: ApprovalStatus.APPROVED | ApprovalStatus.REJECTED;
  comments?: string;
  decidedAt?: string;
}

export interface ApprovalRequirementEvaluation {
  status: ApprovalStatus;
  reason: string;
  assignedRole?: Role;
  assignedUserId?: string;
}

export interface ApprovalContract {
  evaluateApprovalRequirement(
    workflowType: string,
    payload: Record<string, unknown>,
    aiRiskScore?: number,
    aiConfidence?: number
  ): Promise<ApprovalRequirementEvaluation>;

  createApprovalRequest(params: {
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
  }): Promise<ApprovalRequest>;

  processDecision(decision: ApprovalDecision): Promise<ApprovalRequest>;

  getApprovalById(approvalId: string): ApprovalRequest | undefined;
  getApprovalByWorkflowId(workflowId: string): ApprovalRequest | undefined;
  getPendingApprovals(role?: Role, userId?: string): ApprovalRequest[];
}
