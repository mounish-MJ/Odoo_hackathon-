import {
  WorkflowContract,
  WorkflowContext,
  WorkflowStatus,
} from '../../contracts/workflow.contract';
import { AuditService } from '../../audit/audit.service';
import { NotificationService } from '../../notifications/notification.service';

export abstract class BaseWorkflow<TPayload = Record<string, unknown>, TResult = unknown>
  implements WorkflowContract<TPayload, TResult>
{
  abstract workflowType: string;
  protected auditService: AuditService;
  protected notificationService: NotificationService;

  constructor(auditService?: AuditService, notificationService?: NotificationService) {
    this.auditService = auditService || AuditService.getInstance();
    this.notificationService = notificationService || NotificationService.getInstance();
  }

  // 1. Validate Event
  abstract validateEvent(context: WorkflowContext<TPayload, TResult>): Promise<boolean>;

  // 2. Check Permissions
  abstract checkPermissions(context: WorkflowContext<TPayload, TResult>): Promise<boolean>;

  // 3. Evaluate Risk / AI Assessment
  abstract evaluateRisk(context: WorkflowContext<TPayload, TResult>): Promise<{
    riskScore?: number;
    confidence?: number;
    decision: 'AUTO_PROCEED' | 'REQUIRE_APPROVAL' | 'REJECT';
  }>;

  // 4. Deterministic Core Action (Member 1 integration)
  abstract executeDeterministicAction(
    context: WorkflowContext<TPayload, TResult>
  ): Promise<TResult>;

  // 5. Verification
  abstract verifyAction(
    context: WorkflowContext<TPayload, TResult>,
    actionResult: TResult
  ): Promise<boolean>;

  // 6. Notification Triggering
  abstract dispatchNotifications(context: WorkflowContext<TPayload, TResult>): Promise<void>;

  // 7. Audit Event Creation
  abstract recordAuditEvent(context: WorkflowContext<TPayload, TResult>): Promise<void>;

  // 8. Error Handling
  public async handleFailure(
    context: WorkflowContext<TPayload, TResult>,
    error: Error
  ): Promise<void> {
    context.status = WorkflowStatus.FAILED;
    context.error = error;

    await this.auditService.recordAudit({
      userId: context.user?.userId || context.event.actor?.userId || context.event.metadata?.userId || 'system',
      userRole: context.user?.role || context.event.actor?.role || context.event.metadata?.userRole || 'SYSTEM',
      action: `${this.workflowType}.FAILED`,
      resourceType: 'workflow',
      resourceId: context.workflowId,
      oldData: context.event.payload as Record<string, unknown>,
      status: 'FAILURE',
      failureReason: error.message,
    });
  }
}
