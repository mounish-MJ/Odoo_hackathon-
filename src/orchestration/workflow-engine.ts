import { v4 as uuidv4 } from 'uuid';
import { EventContract, StandardEventType, EventType } from '../contracts/event.contract';
import {
  WorkflowContract,
  WorkflowContext,
  WorkflowStatus,
  WorkflowStepResult,
} from '../contracts/workflow.contract';
import { PlatformEventBus } from './event-bus';
import { ApprovalRouter } from './approval-router';
import { ApprovalStatus } from '../contracts/approval.contract';
import { IdempotencyGuard } from '../security/idempotency.guard';
import { RetryManager } from './retry-manager';

/**
 * Valid state transition rules enforcing sequential execution.
 * Prevents illegal jumps (e.g. INITIALIZED straight to EXECUTING_ACTION).
 */
export const VALID_WORKFLOW_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  [WorkflowStatus.INITIALIZED]: [WorkflowStatus.VALIDATED, WorkflowStatus.FAILED],
  [WorkflowStatus.VALIDATED]: [WorkflowStatus.PERMISSION_CHECKED, WorkflowStatus.FAILED],
  [WorkflowStatus.PERMISSION_CHECKED]: [WorkflowStatus.RISK_ASSESSED, WorkflowStatus.FAILED],
  [WorkflowStatus.RISK_ASSESSED]: [
    WorkflowStatus.AWAITING_APPROVAL,
    WorkflowStatus.EXECUTING_ACTION,
    WorkflowStatus.FAILED,
  ],
  [WorkflowStatus.AWAITING_APPROVAL]: [WorkflowStatus.EXECUTING_ACTION, WorkflowStatus.FAILED],
  [WorkflowStatus.EXECUTING_ACTION]: [WorkflowStatus.VERIFYING, WorkflowStatus.FAILED],
  [WorkflowStatus.VERIFYING]: [WorkflowStatus.NOTIFYING, WorkflowStatus.FAILED],
  [WorkflowStatus.NOTIFYING]: [WorkflowStatus.AUDITING, WorkflowStatus.FAILED],
  [WorkflowStatus.AUDITING]: [WorkflowStatus.COMPLETED, WorkflowStatus.FAILED],
  [WorkflowStatus.COMPLETED]: [],
  [WorkflowStatus.FAILED]: [WorkflowStatus.ROLLED_BACK],
  [WorkflowStatus.ROLLED_BACK]: [],
};

export class IllegalStateTransitionError extends Error {
  constructor(fromStatus: WorkflowStatus, toStatus: WorkflowStatus) {
    super(`Illegal workflow transition: Cannot transition from ${fromStatus} to ${toStatus}`);
    this.name = 'IllegalStateTransitionError';
  }
}

export class WorkflowEngine {
  private static instance: WorkflowEngine;
  private workflows: Map<string, WorkflowContract<any, any>> = new Map();
  private activeContexts: Map<string, WorkflowContext<any, any>> = new Map();
  private eventBus: PlatformEventBus;
  private approvalRouter: ApprovalRouter;

  constructor(eventBus?: PlatformEventBus, approvalRouter?: ApprovalRouter) {
    this.eventBus = eventBus || PlatformEventBus.getInstance();
    this.approvalRouter = approvalRouter || ApprovalRouter.getInstance();
    this.wireEventBusListeners();
  }

  public static getInstance(
    eventBus?: PlatformEventBus,
    approvalRouter?: ApprovalRouter
  ): WorkflowEngine {
    if (!WorkflowEngine.instance) {
      WorkflowEngine.instance = new WorkflowEngine(eventBus, approvalRouter);
    }
    return WorkflowEngine.instance;
  }

  /**
   * Registers a workflow handler by its workflow type key.
   */
  public registerWorkflow(workflow: WorkflowContract<any, any>): void {
    this.workflows.set(workflow.workflowType, workflow);
  }

  /**
   * Automatically wires event bus triggers to workflows.
   */
  private wireEventBusListeners(): void {
    this.eventBus.subscribe(EventType.LEAVE_APPLIED, async (event) => {
      await this.executeWorkflow('leave-request', event);
    });

    this.eventBus.subscribe(StandardEventType.LEAVE_REQUESTED, async (event) => {
      await this.executeWorkflow('leave-request', event);
    });

    this.eventBus.subscribe(EventType.ATTENDANCE_ANOMALY_DETECTED, async (event) => {
      await this.executeWorkflow('attendance-anomaly', event);
    });

    this.eventBus.subscribe(EventType.PAYROLL_RUN_INITIATED, async (event) => {
      await this.executeWorkflow('payroll-process', event);
    });
  }

  /**
   * Transitions workflow to the next state, validating allowed state graph.
   */
  public transitionStatus(
    context: WorkflowContext<any, any>,
    nextStatus: WorkflowStatus
  ): void {
    const allowed = VALID_WORKFLOW_TRANSITIONS[context.status] || [];
    if (!allowed.includes(nextStatus)) {
      throw new IllegalStateTransitionError(context.status, nextStatus);
    }
    context.status = nextStatus;
  }

  /**
   * The Master 8-Step Orchestration Pipeline.
   *
   * EVENT
   * → WORKFLOW SELECTION
   * → PERMISSION / RISK CHECK
   * → APPROVAL (when required)
   * → DETERMINISTIC ACTION
   * → VERIFICATION
   * → NOTIFICATION
   * → AUDIT EVENT
   */
  public async executeWorkflow<TPayload = Record<string, unknown>, TResult = unknown>(
    workflowType: string,
    event: EventContract<TPayload>
  ): Promise<WorkflowContext<TPayload, TResult>> {
    const idempotencyKey = event.idempotencyKey || event.eventId;

    // 1. Workflow-Level Idempotency Check
    if (idempotencyKey) {
      const cached = IdempotencyGuard.check(idempotencyKey);
      if (cached && cached.body) {
        const cachedContext = cached.body as WorkflowContext<TPayload, TResult>;
        return {
          ...cachedContext,
          event,
        };
      }
    }

    const workflowId = `wf_${uuidv4().substring(0, 8)}`;
    const workflow = this.workflows.get(workflowType);

    if (!workflow) {
      throw new Error(`No workflow registered for type '${workflowType}'`);
    }

    const context: WorkflowContext<TPayload, TResult> = {
      workflowId,
      workflowType,
      event,
      user: event.actor
        ? {
            userId: event.actor.userId,
            email: event.actor.email || `${event.actor.userId}@dayflow.app`,
            name: event.actor.userId,
            role: (event.actor.role as any) || 'EMPLOYEE',
          }
        : event.metadata?.userId
        ? {
            userId: event.metadata.userId,
            email: `${event.metadata.userId}@dayflow.app`,
            name: event.metadata.userId,
            role: (event.metadata.userRole as any) || 'EMPLOYEE',
          }
        : undefined,
      status: WorkflowStatus.INITIALIZED,
      stepResults: {},
      retryCount: 0,
      maxRetries: 3,
      startTime: Date.now(),
    };

    this.activeContexts.set(workflowId, context);

    try {
      // -------------------------------------------------------------
      // Step 1: Event Validation
      // -------------------------------------------------------------
      const step1Start = Date.now();
      const isValid = await workflow.validateEvent(context);
      if (!isValid) {
        throw new Error('Event validation returned false');
      }
      this.recordStep(context, '1_VALIDATION', 'SUCCESS', undefined, step1Start);
      this.transitionStatus(context, WorkflowStatus.VALIDATED);

      // -------------------------------------------------------------
      // Step 2: Permission & RBAC Check
      // -------------------------------------------------------------
      const step2Start = Date.now();
      const isAuthorized = await workflow.checkPermissions(context);
      if (!isAuthorized) {
        throw new Error('Authorization failed: Insufficient permissions for this workflow');
      }
      this.recordStep(context, '2_PERMISSION_CHECK', 'SUCCESS', undefined, step2Start);
      this.transitionStatus(context, WorkflowStatus.PERMISSION_CHECKED);

      // -------------------------------------------------------------
      // Step 3: AI Risk Check & Approval Routing
      // -------------------------------------------------------------
      const step3Start = Date.now();
      const riskEvaluation = await workflow.evaluateRisk(context);
      this.recordStep(context, '3_RISK_EVALUATION', 'SUCCESS', riskEvaluation, step3Start);
      this.transitionStatus(context, WorkflowStatus.RISK_ASSESSED);

      if (riskEvaluation.decision === 'REJECT') {
        throw new Error('Workflow rejected by policy during risk evaluation');
      }

      // If approval is required from a human, pause execution here
      if (riskEvaluation.decision === 'REQUIRE_APPROVAL') {
        this.transitionStatus(context, WorkflowStatus.AWAITING_APPROVAL);
        this.recordStep(
          context,
          '4_APPROVAL_GATE',
          'PENDING_APPROVAL',
          { approvalId: context.approvalId, approver: context.assignedApproverId },
          step3Start
        );
        return context; // Suspends here until resumed via resumeWorkflowWithApproval
      }

      // -------------------------------------------------------------
      // Step 4: Deterministic Core Action (with retry support)
      // -------------------------------------------------------------
      const step4Start = Date.now();
      this.transitionStatus(context, WorkflowStatus.EXECUTING_ACTION);

      const { result: actionResult } = await RetryManager.executeWithRetry(
        async () => {
          return await workflow.executeDeterministicAction(context);
        },
        { maxRetries: 2, initialDelayMs: 50 }
      );

      context.output = actionResult;
      this.recordStep(context, '5_DETERMINISTIC_ACTION', 'SUCCESS', actionResult, step4Start);

      // -------------------------------------------------------------
      // Step 5: Verification
      // -------------------------------------------------------------
      const step5Start = Date.now();
      this.transitionStatus(context, WorkflowStatus.VERIFYING);
      const isVerified = await workflow.verifyAction(context, actionResult);
      if (!isVerified) {
        throw new Error('Action verification failed: Core state does not match expected result');
      }
      this.recordStep(context, '6_VERIFICATION', 'SUCCESS', { isVerified }, step5Start);

      // -------------------------------------------------------------
      // Step 6: Notification Triggering
      // -------------------------------------------------------------
      const step6Start = Date.now();
      this.transitionStatus(context, WorkflowStatus.NOTIFYING);
      await workflow.dispatchNotifications(context);
      this.recordStep(context, '7_NOTIFICATION_DISPATCH', 'SUCCESS', undefined, step6Start);

      // -------------------------------------------------------------
      // Step 7: Audit Event Creation
      // -------------------------------------------------------------
      const step7Start = Date.now();
      this.transitionStatus(context, WorkflowStatus.AUDITING);
      await workflow.recordAuditEvent(context);
      this.recordStep(context, '8_AUDIT_LOGGING', 'SUCCESS', undefined, step7Start);

      // Workflow successfully completed
      this.transitionStatus(context, WorkflowStatus.COMPLETED);
      context.endTime = Date.now();

      // Save idempotency result
      if (idempotencyKey) {
        IdempotencyGuard.save(idempotencyKey, 200, {
          workflowId: context.workflowId,
          workflowType: context.workflowType,
          status: context.status,
          output: context.output,
          stepResults: context.stepResults,
        });
      }

      return context;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      const failedStep = this.getCurrentStepName(context.status);
      context.status = WorkflowStatus.FAILED;
      context.error = error;
      context.endTime = Date.now();

      // Record failed step in results
      this.recordStep(context, failedStep, 'FAILED', { error: error.message });

      // Emit ActionFailed event on event bus
      await this.eventBus.publish({
        eventId: uuidv4(),
        eventType: StandardEventType.ACTION_FAILED,
        timestamp: new Date().toISOString(),
        actor: event.actor || { userId: 'system', role: 'SYSTEM' },
        source: 'MEMBER_4_PLATFORM',
        resourceType: event.resourceType || 'workflow',
        resourceId: context.workflowId,
        correlationId: event.correlationId || uuidv4(),
        payload: {
          workflowId: context.workflowId,
          workflowType: context.workflowType,
          failedStep,
          error: error.message,
        },
      });

      if (idempotencyKey) {
        IdempotencyGuard.release(idempotencyKey);
      }

      await workflow.handleFailure(context, error);
      return context;
    }
  }

  /**
   * Resumes a paused workflow when an approval decision is made by Manager/HR.
   */
  public async resumeWorkflowWithApproval(
    approvalId: string,
    decision: 'APPROVED' | 'REJECTED',
    deciderId: string,
    comments?: string
  ): Promise<WorkflowContext<any, any>> {
    const approval = await this.approvalRouter.processDecision({
      approvalId,
      deciderId,
      deciderRole: (comments as any) || 'MANAGER',
      status: decision === 'APPROVED' ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
      comments,
      decidedAt: new Date().toISOString(),
    });

    const context = this.activeContexts.get(approval.workflowId);
    if (!context) {
      throw new Error(`Workflow context ${approval.workflowId} not found`);
    }

    const workflow = this.workflows.get(context.workflowType);
    if (!workflow) {
      throw new Error(`Workflow handler for ${context.workflowType} not found`);
    }

    if (decision === 'REJECTED') {
      this.transitionStatus(context, WorkflowStatus.FAILED);
      context.approvalStatus = ApprovalStatus.REJECTED;
      const rejectError = new Error(`Rejected by approver ${deciderId}: ${comments || 'No comments'}`);
      this.recordStep(context, '4_APPROVAL_GATE', 'FAILED', { error: rejectError.message });
      await workflow.handleFailure(context, rejectError);
      return context;
    }

    // If approved, proceed safely from AWAITING_APPROVAL to EXECUTING_ACTION
    context.approvalStatus = ApprovalStatus.APPROVED;
    context.assignedApproverId = deciderId;

    try {
      const step4Start = Date.now();
      this.transitionStatus(context, WorkflowStatus.EXECUTING_ACTION);
      const actionResult = await workflow.executeDeterministicAction(context);
      context.output = actionResult;
      this.recordStep(context, '5_DETERMINISTIC_ACTION', 'SUCCESS', actionResult, step4Start);

      const step5Start = Date.now();
      this.transitionStatus(context, WorkflowStatus.VERIFYING);
      await workflow.verifyAction(context, actionResult);
      this.recordStep(context, '6_VERIFICATION', 'SUCCESS', undefined, step5Start);

      const step6Start = Date.now();
      this.transitionStatus(context, WorkflowStatus.NOTIFYING);
      await workflow.dispatchNotifications(context);
      this.recordStep(context, '7_NOTIFICATION_DISPATCH', 'SUCCESS', undefined, step6Start);

      const step7Start = Date.now();
      this.transitionStatus(context, WorkflowStatus.AUDITING);
      await workflow.recordAuditEvent(context);
      this.recordStep(context, '8_AUDIT_LOGGING', 'SUCCESS', undefined, step7Start);

      this.transitionStatus(context, WorkflowStatus.COMPLETED);
      context.endTime = Date.now();
      return context;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      const failedStep = this.getCurrentStepName(context.status);
      context.status = WorkflowStatus.FAILED;
      context.error = error;
      context.endTime = Date.now();
      this.recordStep(context, failedStep, 'FAILED', { error: error.message });
      await workflow.handleFailure(context, error);
      return context;
    }
  }

  private getCurrentStepName(status: WorkflowStatus): string {
    switch (status) {
      case WorkflowStatus.INITIALIZED:
        return '1_VALIDATION';
      case WorkflowStatus.VALIDATED:
        return '2_PERMISSION_CHECK';
      case WorkflowStatus.PERMISSION_CHECKED:
        return '3_RISK_EVALUATION';
      case WorkflowStatus.RISK_ASSESSED:
      case WorkflowStatus.AWAITING_APPROVAL:
        return '4_APPROVAL_GATE';
      case WorkflowStatus.EXECUTING_ACTION:
        return '5_DETERMINISTIC_ACTION';
      case WorkflowStatus.VERIFYING:
        return '6_VERIFICATION';
      case WorkflowStatus.NOTIFYING:
        return '7_NOTIFICATION_DISPATCH';
      case WorkflowStatus.AUDITING:
        return '8_AUDIT_LOGGING';
      default:
        return 'WORKFLOW_EXECUTION';
    }
  }

  private recordStep(
    context: WorkflowContext<any, any>,
    stepName: string,
    status: WorkflowStepResult['status'],
    data?: unknown,
    startTime?: number
  ): void {
    context.stepResults[stepName] = {
      stepName,
      status,
      data,
      durationMs: startTime ? Date.now() - startTime : 0,
    };
  }

  public getWorkflowContext(workflowId: string): WorkflowContext<any, any> | undefined {
    return this.activeContexts.get(workflowId);
  }

  public clear(): void {
    this.activeContexts.clear();
  }
}
