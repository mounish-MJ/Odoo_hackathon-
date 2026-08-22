import { v4 as uuidv4 } from 'uuid';
import { EventContract, EventType } from '../contracts/event.contract';
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

    this.eventBus.subscribe(EventType.ATTENDANCE_ANOMALY_DETECTED, async (event) => {
      await this.executeWorkflow('attendance-anomaly', event);
    });

    this.eventBus.subscribe(EventType.PAYROLL_RUN_INITIATED, async (event) => {
      await this.executeWorkflow('payroll-process', event);
    });
  }

  /**
   * The Master 8-Step Orchestration Pipeline.
   *
   * Event
   * → Workflow Selection
   * → Permission / Risk Check
   * → Approval when required
   * → Deterministic Action
   * → Verification
   * → Notification
   * → Audit Event
   */
  public async executeWorkflow<TPayload = Record<string, unknown>, TResult = unknown>(
    workflowType: string,
    event: EventContract<TPayload>
  ): Promise<WorkflowContext<TPayload, TResult>> {
    const workflowId = `wf_${uuidv4().substring(0, 8)}`;
    const workflow = this.workflows.get(workflowType);

    if (!workflow) {
      throw new Error(`No workflow registered for type '${workflowType}'`);
    }

    const context: WorkflowContext<TPayload, TResult> = {
      workflowId,
      workflowType,
      event,
      user: event.metadata.userId
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
      context.status = WorkflowStatus.VALIDATED;

      // -------------------------------------------------------------
      // Step 2: Permission & RBAC Check
      // -------------------------------------------------------------
      const step2Start = Date.now();
      const isAuthorized = await workflow.checkPermissions(context);
      if (!isAuthorized) {
        throw new Error('Authorization failed: Insufficient permissions for this workflow');
      }
      this.recordStep(context, '2_PERMISSION_CHECK', 'SUCCESS', undefined, step2Start);
      context.status = WorkflowStatus.PERMISSION_CHECKED;

      // -------------------------------------------------------------
      // Step 3: AI Risk Check & Approval Routing
      // -------------------------------------------------------------
      const step3Start = Date.now();
      const riskEvaluation = await workflow.evaluateRisk(context);
      this.recordStep(context, '3_RISK_EVALUATION', 'SUCCESS', riskEvaluation, step3Start);
      context.status = WorkflowStatus.RISK_ASSESSED;

      if (riskEvaluation.decision === 'REJECT') {
        throw new Error('Workflow rejected by policy during risk evaluation');
      }

      // If approval is required from a human, pause execution here
      if (riskEvaluation.decision === 'REQUIRE_APPROVAL') {
        context.status = WorkflowStatus.AWAITING_APPROVAL;
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
      context.status = WorkflowStatus.EXECUTING_ACTION;

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
      context.status = WorkflowStatus.VERIFYING;
      const isVerified = await workflow.verifyAction(context, actionResult);
      if (!isVerified) {
        throw new Error('Action verification failed: Core state does not match expected result');
      }
      this.recordStep(context, '6_VERIFICATION', 'SUCCESS', { isVerified }, step5Start);

      // -------------------------------------------------------------
      // Step 6: Notification Triggering
      // -------------------------------------------------------------
      const step6Start = Date.now();
      context.status = WorkflowStatus.NOTIFYING;
      await workflow.dispatchNotifications(context);
      this.recordStep(context, '7_NOTIFICATION_DISPATCH', 'SUCCESS', undefined, step6Start);

      // -------------------------------------------------------------
      // Step 7: Audit Event Creation
      // -------------------------------------------------------------
      const step7Start = Date.now();
      context.status = WorkflowStatus.AUDITING;
      await workflow.recordAuditEvent(context);
      this.recordStep(context, '8_AUDIT_LOGGING', 'SUCCESS', undefined, step7Start);

      // Workflow successfully completed
      context.status = WorkflowStatus.COMPLETED;
      context.endTime = Date.now();

      // Save idempotency result if key was provided
      if (event.idempotencyKey) {
        IdempotencyGuard.save(event.idempotencyKey, 200, {
          workflowId: context.workflowId,
          status: context.status,
          output: context.output,
        });
      }

      return context;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      context.status = WorkflowStatus.FAILED;
      context.error = error;
      context.endTime = Date.now();

      if (event.idempotencyKey) {
        IdempotencyGuard.release(event.idempotencyKey);
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
      context.status = WorkflowStatus.FAILED;
      context.approvalStatus = ApprovalStatus.REJECTED;
      const rejectError = new Error(`Rejected by approver ${deciderId}: ${comments || 'No comments'}`);
      await workflow.handleFailure(context, rejectError);
      return context;
    }

    // If approved, execute remaining pipeline steps (Action -> Verify -> Notify -> Audit)
    context.approvalStatus = ApprovalStatus.APPROVED;
    context.assignedApproverId = deciderId;

    try {
      const step4Start = Date.now();
      context.status = WorkflowStatus.EXECUTING_ACTION;
      const actionResult = await workflow.executeDeterministicAction(context);
      context.output = actionResult;
      this.recordStep(context, '5_DETERMINISTIC_ACTION', 'SUCCESS', actionResult, step4Start);

      const step5Start = Date.now();
      context.status = WorkflowStatus.VERIFYING;
      await workflow.verifyAction(context, actionResult);
      this.recordStep(context, '6_VERIFICATION', 'SUCCESS', undefined, step5Start);

      const step6Start = Date.now();
      context.status = WorkflowStatus.NOTIFYING;
      await workflow.dispatchNotifications(context);
      this.recordStep(context, '7_NOTIFICATION_DISPATCH', 'SUCCESS', undefined, step6Start);

      const step7Start = Date.now();
      context.status = WorkflowStatus.AUDITING;
      await workflow.recordAuditEvent(context);
      this.recordStep(context, '8_AUDIT_LOGGING', 'SUCCESS', undefined, step7Start);

      context.status = WorkflowStatus.COMPLETED;
      context.endTime = Date.now();
      return context;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      context.status = WorkflowStatus.FAILED;
      context.error = error;
      await workflow.handleFailure(context, error);
      return context;
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
