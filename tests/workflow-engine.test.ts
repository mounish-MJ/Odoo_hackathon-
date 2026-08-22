import { v4 as uuidv4 } from 'uuid';
import {
  WorkflowEngine,
  VALID_WORKFLOW_TRANSITIONS,
  IllegalStateTransitionError,
} from '../src/orchestration/workflow-engine';
import { BaseWorkflow } from '../src/orchestration/workflows/base.workflow';
import {
  WorkflowContext,
  WorkflowStatus,
} from '../src/contracts/workflow.contract';
import { StandardEvent, StandardEventType } from '../src/contracts/event.contract';
import { IdempotencyGuard } from '../src/security/idempotency.guard';
import { PlatformEventBus } from '../src/orchestration/event-bus';

describe('Member 4 Core Workflow Orchestration Engine Tests', () => {
  let engine: WorkflowEngine;
  let eventBus: PlatformEventBus;

  beforeEach(() => {
    eventBus = PlatformEventBus.getInstance();
    eventBus.clear();
    IdempotencyGuard.clear();
    engine = WorkflowEngine.getInstance();
    engine.clear();
  });

  describe('1. Reusable Workflow Mechanism', () => {
    test('Agnostic engine executes arbitrary registered custom workflow through all 8 steps', async () => {
      class CustomTestWorkflow extends BaseWorkflow<
        { dataKey: string },
        { processed: boolean }
      > {
        workflowType = 'custom-test-workflow';

        async validateEvent(context: WorkflowContext<{ dataKey: string }, { processed: boolean }>): Promise<boolean> {
          return Boolean(context.event.payload.dataKey);
        }

        async checkPermissions(context: WorkflowContext<{ dataKey: string }, { processed: boolean }>): Promise<boolean> {
          return context.event.actor?.role === 'ADMIN' || context.event.actor?.role === 'HR';
        }

        async evaluateRisk(): Promise<{ decision: 'AUTO_PROCEED' }> {
          return { decision: 'AUTO_PROCEED' };
        }

        async executeDeterministicAction(
          context: WorkflowContext<{ dataKey: string }, { processed: boolean }>
        ): Promise<{ processed: boolean }> {
          return { processed: true };
        }

        async verifyAction(
          context: WorkflowContext<{ dataKey: string }, { processed: boolean }>,
          actionResult: { processed: boolean }
        ): Promise<boolean> {
          return actionResult.processed === true;
        }

        async dispatchNotifications(): Promise<void> {}
        async recordAuditEvent(): Promise<void> {}
      }

      const customWorkflow = new CustomTestWorkflow();
      engine.registerWorkflow(customWorkflow);

      const event: StandardEvent<{ dataKey: string }> = {
        eventId: uuidv4(),
        eventType: StandardEventType.ACTION_COMPLETED,
        timestamp: new Date().toISOString(),
        actor: { userId: 'admin_001', role: 'ADMIN' },
        source: 'MEMBER_4_PLATFORM',
        resourceType: 'workflow',
        resourceId: 'res_001',
        correlationId: 'trace-test-01',
        version: '1.0',
        payload: { dataKey: 'valid_data' },
      };

      const result = await engine.executeWorkflow('custom-test-workflow', event);

      expect(result.status).toBe(WorkflowStatus.COMPLETED);
      expect(result.output).toEqual({ processed: true });
      expect(result.stepResults['1_VALIDATION'].status).toBe('SUCCESS');
      expect(result.stepResults['2_PERMISSION_CHECK'].status).toBe('SUCCESS');
      expect(result.stepResults['3_RISK_EVALUATION'].status).toBe('SUCCESS');
      expect(result.stepResults['5_DETERMINISTIC_ACTION'].status).toBe('SUCCESS');
      expect(result.stepResults['6_VERIFICATION'].status).toBe('SUCCESS');
      expect(result.stepResults['7_NOTIFICATION_DISPATCH'].status).toBe('SUCCESS');
      expect(result.stepResults['8_AUDIT_LOGGING'].status).toBe('SUCCESS');
    });
  });

  describe('2. Safe State Transitions Graph', () => {
    test('Throws IllegalStateTransitionError when attempting to jump directly to privileged action', () => {
      const dummyContext: any = {
        status: WorkflowStatus.INITIALIZED,
      };

      expect(() => {
        engine.transitionStatus(dummyContext, WorkflowStatus.EXECUTING_ACTION);
      }).toThrow(IllegalStateTransitionError);
    });

    test('Allows strictly sequential progression through validated state graph', () => {
      const dummyContext: any = {
        status: WorkflowStatus.INITIALIZED,
      };

      expect(() => {
        engine.transitionStatus(dummyContext, WorkflowStatus.VALIDATED);
        engine.transitionStatus(dummyContext, WorkflowStatus.PERMISSION_CHECKED);
        engine.transitionStatus(dummyContext, WorkflowStatus.RISK_ASSESSED);
        engine.transitionStatus(dummyContext, WorkflowStatus.EXECUTING_ACTION);
        engine.transitionStatus(dummyContext, WorkflowStatus.VERIFYING);
        engine.transitionStatus(dummyContext, WorkflowStatus.NOTIFYING);
        engine.transitionStatus(dummyContext, WorkflowStatus.AUDITING);
        engine.transitionStatus(dummyContext, WorkflowStatus.COMPLETED);
      }).not.toThrow();

      expect(dummyContext.status).toBe(WorkflowStatus.COMPLETED);
    });
  });

  describe('3. Workflow-Level Idempotency', () => {
    test('Replaying an event with the same idempotency key returns cached output without re-executing action', async () => {
      let executionCount = 0;

      class IdempotentWorkflow extends BaseWorkflow<Record<string, unknown>, { count: number }> {
        workflowType = 'idempotent-test';

        async validateEvent(): Promise<boolean> {
          return true;
        }
        async checkPermissions(): Promise<boolean> {
          return true;
        }
        async evaluateRisk(): Promise<{ decision: 'AUTO_PROCEED' }> {
          return { decision: 'AUTO_PROCEED' };
        }
        async executeDeterministicAction(): Promise<{ count: number }> {
          executionCount += 1;
          return { count: executionCount };
        }
        async verifyAction(): Promise<boolean> {
          return true;
        }
        async dispatchNotifications(): Promise<void> {}
        async recordAuditEvent(): Promise<void> {}
      }

      engine.registerWorkflow(new IdempotentWorkflow());

      const idempotencyKey = 'idem-workflow-key-100';
      const event: StandardEvent = {
        eventId: uuidv4(),
        idempotencyKey,
        eventType: StandardEventType.ACTION_COMPLETED,
        timestamp: new Date().toISOString(),
        actor: { userId: 'admin_1', role: 'ADMIN' },
        source: 'MEMBER_4_PLATFORM',
        resourceType: 'workflow',
        resourceId: 'res_100',
        correlationId: 'trace-idem-01',
        version: '1.0',
        payload: { sample: 'data' },
      };

      // First run: executes deterministic action
      const firstRun = await engine.executeWorkflow('idempotent-test', event);
      expect(firstRun.status).toBe(WorkflowStatus.COMPLETED);
      expect(firstRun.output).toEqual({ count: 1 });
      expect(executionCount).toBe(1);

      // Second run: replaying same event returns cached output without incrementing count
      const secondRun = await engine.executeWorkflow('idempotent-test', event);
      expect(secondRun.status).toBe(WorkflowStatus.COMPLETED);
      expect(secondRun.output).toEqual({ count: 1 });
      expect(executionCount).toBe(1); // Action was NOT re-executed!
    });
  });

  describe('4. Failure Handling & Diagnostic Context', () => {
    test('On deterministic action failure, preserves error, marks FAILED, and emits ActionFailed event', async () => {
      let failureEventEmitted: StandardEvent | null = null;
      eventBus.subscribe(StandardEventType.ACTION_FAILED, (e) => {
        failureEventEmitted = e;
      });

      class FailingWorkflow extends BaseWorkflow<Record<string, unknown>, unknown> {
        workflowType = 'failing-test';

        async validateEvent(): Promise<boolean> {
          return true;
        }
        async checkPermissions(): Promise<boolean> {
          return true;
        }
        async evaluateRisk(): Promise<{ decision: 'AUTO_PROCEED' }> {
          return { decision: 'AUTO_PROCEED' };
        }
        async executeDeterministicAction(): Promise<unknown> {
          throw new Error('Database connection timeout during mutation');
        }
        async verifyAction(): Promise<boolean> {
          return true;
        }
        async dispatchNotifications(): Promise<void> {}
        async recordAuditEvent(): Promise<void> {}
      }

      engine.registerWorkflow(new FailingWorkflow());

      const event: StandardEvent = {
        eventId: uuidv4(),
        eventType: StandardEventType.ACTION_COMPLETED,
        timestamp: new Date().toISOString(),
        actor: { userId: 'user_fail', role: 'EMPLOYEE' },
        source: 'MEMBER_4_PLATFORM',
        resourceType: 'workflow',
        resourceId: 'res_fail_01',
        correlationId: 'trace-fail-01',
        version: '1.0',
        payload: {},
      };

      const result = await engine.executeWorkflow('failing-test', event);

      expect(result.status).toBe(WorkflowStatus.FAILED);
      expect(result.error).toBeDefined();
      expect(result.error?.toString()).toContain('Database connection timeout during mutation');
      expect(result.stepResults['5_DETERMINISTIC_ACTION'].status).toBe('FAILED');

      // Allow tick for event bus dispatch
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(failureEventEmitted).not.toBeNull();
      expect((failureEventEmitted as any).payload.error).toContain('Database connection timeout');
    });

    test('On permission check failure, immediately halts and does NOT execute privileged action', async () => {
      let actionExecuted = false;

      class UnauthorizedWorkflow extends BaseWorkflow<Record<string, unknown>, unknown> {
        workflowType = 'unauthorized-test';

        async validateEvent(): Promise<boolean> {
          return true;
        }
        async checkPermissions(): Promise<boolean> {
          return false; // Forbidden!
        }
        async evaluateRisk(): Promise<{ decision: 'AUTO_PROCEED' }> {
          return { decision: 'AUTO_PROCEED' };
        }
        async executeDeterministicAction(): Promise<unknown> {
          actionExecuted = true;
          return { done: true };
        }
        async verifyAction(): Promise<boolean> {
          return true;
        }
        async dispatchNotifications(): Promise<void> {}
        async recordAuditEvent(): Promise<void> {}
      }

      engine.registerWorkflow(new UnauthorizedWorkflow());

      const event: StandardEvent = {
        eventId: uuidv4(),
        eventType: StandardEventType.ACTION_COMPLETED,
        timestamp: new Date().toISOString(),
        actor: { userId: 'unauthorized_user', role: 'EMPLOYEE' },
        source: 'MEMBER_4_PLATFORM',
        resourceType: 'workflow',
        resourceId: 'res_unauth_01',
        correlationId: 'trace-unauth-01',
        version: '1.0',
        payload: {},
      };

      const result = await engine.executeWorkflow('unauthorized-test', event);

      expect(result.status).toBe(WorkflowStatus.FAILED);
      expect(result.error?.toString()).toContain('Insufficient permissions');
      expect(actionExecuted).toBe(false);
    });
  });
});
