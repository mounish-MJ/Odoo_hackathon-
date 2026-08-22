import { EventContract } from './event.contract';
import { AuthUser } from './authorization.contract';
import { ApprovalStatus } from './approval.contract';

export enum WorkflowStatus {
  INITIALIZED = 'INITIALIZED',
  VALIDATED = 'VALIDATED',
  PERMISSION_CHECKED = 'PERMISSION_CHECKED',
  RISK_ASSESSED = 'RISK_ASSESSED',
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  EXECUTING_ACTION = 'EXECUTING_ACTION',
  VERIFYING = 'VERIFYING',
  NOTIFYING = 'NOTIFYING',
  AUDITING = 'AUDITING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  ROLLED_BACK = 'ROLLED_BACK',
}

export interface WorkflowStepResult<T = unknown> {
  stepName: string;
  status: 'SUCCESS' | 'SKIPPED' | 'FAILED' | 'PENDING_APPROVAL';
  data?: T;
  error?: string;
  durationMs: number;
}

export interface WorkflowContext<TPayload = Record<string, unknown>, TResult = unknown> {
  workflowId: string;
  workflowType: string;
  event: EventContract<TPayload>;
  user?: AuthUser;
  status: WorkflowStatus;
  approvalStatus?: ApprovalStatus;
  approvalId?: string;
  assignedApproverId?: string;
  stepResults: Record<string, WorkflowStepResult>;
  output?: TResult;
  error?: Error | string;
  retryCount: number;
  maxRetries: number;
  startTime: number;
  endTime?: number;
}

export interface WorkflowContract<TPayload = Record<string, unknown>, TResult = unknown> {
  workflowType: string;
  
  // 8-Step Lifecycle execution hooks
  validateEvent(context: WorkflowContext<TPayload, TResult>): Promise<boolean>;
  checkPermissions(context: WorkflowContext<TPayload, TResult>): Promise<boolean>;
  evaluateRisk(context: WorkflowContext<TPayload, TResult>): Promise<{ riskScore?: number; confidence?: number; decision: 'AUTO_PROCEED' | 'REQUIRE_APPROVAL' | 'REJECT' }>;
  executeDeterministicAction(context: WorkflowContext<TPayload, TResult>): Promise<TResult>;
  verifyAction(context: WorkflowContext<TPayload, TResult>, actionResult: TResult): Promise<boolean>;
  dispatchNotifications(context: WorkflowContext<TPayload, TResult>): Promise<void>;
  recordAuditEvent(context: WorkflowContext<TPayload, TResult>): Promise<void>;
  handleFailure(context: WorkflowContext<TPayload, TResult>, error: Error): Promise<void>;
}
