import { v4 as uuidv4 } from 'uuid';
import {
  ApprovalRouter,
  ApprovalNotFoundError,
  UnauthorizedApproverError,
  SelfApprovalForbiddenError,
  DuplicateApprovalError,
} from '../src/orchestration/approval-router';
import { ApprovalStatus } from '../src/contracts/approval.contract';
import { Role } from '../src/contracts/authorization.contract';
import { PlatformEventBus } from '../src/orchestration/event-bus';
import { StandardEvent, StandardEventType } from '../src/contracts/event.contract';

describe('Member 4 Standalone Approval Routing Component Tests', () => {
  let router: ApprovalRouter;
  let eventBus: PlatformEventBus;

  beforeEach(() => {
    eventBus = PlatformEventBus.getInstance();
    eventBus.clear();
    router = ApprovalRouter.getInstance(eventBus);
    router.clear();
  });

  describe('1. Approval Requirement Determination & Creation', () => {
    test('Correctly determines approval is required for multi-day request and emits ApprovalRequested event', async () => {
      let requestedEventEmitted: StandardEvent | null = null;
      eventBus.subscribe(StandardEventType.APPROVAL_REQUESTED, (e) => {
        requestedEventEmitted = e;
      });

      const evaluation = await router.evaluateApprovalRequirement(
        'leave-request',
        { days: 5, reportingManagerId: 'mgr_456' },
        0.45,
        0.88
      );

      expect(evaluation.status).toBe(ApprovalStatus.PENDING);
      expect(evaluation.assignedRole).toBe(Role.MANAGER);
      expect(evaluation.assignedUserId).toBe('mgr_456');

      const approval = await router.createApprovalRequest({
        workflowId: 'wf_test_001',
        workflowType: 'leave-request',
        resourceType: 'leave',
        resourceId: 'LR-001',
        correlationId: 'trace-appr-01',
        requesterId: 'emp_123',
        requesterName: 'Alice Employee',
        assignedToRoleId: Role.MANAGER,
        assignedToUserId: 'mgr_456',
        aiRiskScore: 0.45,
        aiConfidence: 0.88,
        aiRationale: 'Multi-day absence requires manager team coverage confirmation',
      });

      expect(approval.approvalId).toBeDefined();
      expect(approval.status).toBe(ApprovalStatus.PENDING);
      expect(approval.workflowId).toBe('wf_test_001');

      // Verify event emitted
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(requestedEventEmitted).not.toBeNull();
      expect((requestedEventEmitted as any).payload.approvalId).toBe(approval.approvalId);
    });

    test('Auto-approves low-risk short request (<= 2 days)', async () => {
      const evaluation = await router.evaluateApprovalRequirement(
        'leave-request',
        { days: 2 },
        0.15,
        0.95
      );

      expect(evaluation.status).toBe(ApprovalStatus.AUTO_APPROVED);
    });
  });

  describe('2. Valid Approval & Rejection Decisions', () => {
    test('Authorized manager approves request and emits ApprovalApproved event', async () => {
      let approvedEventEmitted: StandardEvent | null = null;
      eventBus.subscribe(StandardEventType.APPROVAL_APPROVED, (e) => {
        approvedEventEmitted = e;
      });

      const approval = await router.createApprovalRequest({
        workflowId: 'wf_test_002',
        workflowType: 'leave-request',
        requesterId: 'emp_123',
        assignedToRoleId: Role.MANAGER,
        assignedToUserId: 'mgr_456',
      });

      const decided = await router.processDecision({
        approvalId: approval.approvalId,
        deciderId: 'mgr_456',
        deciderRole: Role.MANAGER,
        status: ApprovalStatus.APPROVED,
        comments: 'Coverage confirmed by peer engineer',
      });

      expect(decided.status).toBe(ApprovalStatus.APPROVED);
      expect(decided.decidedBy).toBe('mgr_456');
      expect(decided.comments).toBe('Coverage confirmed by peer engineer');
      expect(decided.decidedAt).toBeDefined();

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(approvedEventEmitted).not.toBeNull();
      expect((approvedEventEmitted as any).payload.decision).toBe(ApprovalStatus.APPROVED);
    });

    test('Authorized manager rejects request with rationale and emits ApprovalRejected event', async () => {
      let rejectedEventEmitted: StandardEvent | null = null;
      eventBus.subscribe(StandardEventType.APPROVAL_REJECTED, (e) => {
        rejectedEventEmitted = e;
      });

      const approval = await router.createApprovalRequest({
        workflowId: 'wf_test_003',
        workflowType: 'leave-request',
        requesterId: 'emp_123',
        assignedToRoleId: Role.MANAGER,
        assignedToUserId: 'mgr_456',
      });

      const decided = await router.processDecision({
        approvalId: approval.approvalId,
        deciderId: 'mgr_456',
        deciderRole: Role.MANAGER,
        status: ApprovalStatus.REJECTED,
        comments: 'Team release deadline scheduled on requested dates',
      });

      expect(decided.status).toBe(ApprovalStatus.REJECTED);
      expect(decided.decidedBy).toBe('mgr_456');

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(rejectedEventEmitted).not.toBeNull();
      expect((rejectedEventEmitted as any).payload.decision).toBe(ApprovalStatus.REJECTED);
    });
  });

  describe('3. Security & Authorization Constraints', () => {
    test('Self-approval is blocked when requester attempts to approve their own request', async () => {
      const approval = await router.createApprovalRequest({
        workflowId: 'wf_test_004',
        workflowType: 'leave-request',
        requesterId: 'emp_123',
        assignedToRoleId: Role.MANAGER,
      });

      await expect(
        router.processDecision({
          approvalId: approval.approvalId,
          deciderId: 'emp_123', // Same as requester!
          deciderRole: Role.MANAGER,
          status: ApprovalStatus.APPROVED,
        })
      ).rejects.toThrow(SelfApprovalForbiddenError);
    });

    test('Employee role is blocked from approving any request', async () => {
      const approval = await router.createApprovalRequest({
        workflowId: 'wf_test_005',
        workflowType: 'leave-request',
        requesterId: 'emp_123',
        assignedToRoleId: Role.MANAGER,
      });

      await expect(
        router.processDecision({
          approvalId: approval.approvalId,
          deciderId: 'emp_999',
          deciderRole: Role.EMPLOYEE, // Unauthorized role
          status: ApprovalStatus.APPROVED,
        })
      ).rejects.toThrow(UnauthorizedApproverError);
    });

    test('Unassigned manager is blocked when request is assigned to a specific manager', async () => {
      const approval = await router.createApprovalRequest({
        workflowId: 'wf_test_006',
        workflowType: 'leave-request',
        requesterId: 'emp_123',
        assignedToRoleId: Role.MANAGER,
        assignedToUserId: 'mgr_456', // Specifically assigned to mgr_456
      });

      await expect(
        router.processDecision({
          approvalId: approval.approvalId,
          deciderId: 'mgr_999', // Different manager!
          deciderRole: Role.MANAGER,
          status: ApprovalStatus.APPROVED,
        })
      ).rejects.toThrow(UnauthorizedApproverError);
    });

    test('Admin role has universal override permission to decide assigned requests', async () => {
      const approval = await router.createApprovalRequest({
        workflowId: 'wf_test_007',
        workflowType: 'leave-request',
        requesterId: 'emp_123',
        assignedToRoleId: Role.MANAGER,
        assignedToUserId: 'mgr_456',
      });

      const decided = await router.processDecision({
        approvalId: approval.approvalId,
        deciderId: 'admin_root',
        deciderRole: Role.ADMIN,
        status: ApprovalStatus.APPROVED,
        comments: 'Admin executive approval override',
      });

      expect(decided.status).toBe(ApprovalStatus.APPROVED);
    });
  });

  describe('4. Guarding Duplicate Decisions & Invalid Requests', () => {
    test('Throws DuplicateApprovalError when attempting to decide an already-approved request', async () => {
      const approval = await router.createApprovalRequest({
        workflowId: 'wf_test_008',
        workflowType: 'leave-request',
        requesterId: 'emp_123',
        assignedToRoleId: Role.MANAGER,
        assignedToUserId: 'mgr_456',
      });

      // First decision succeeds
      await router.processDecision({
        approvalId: approval.approvalId,
        deciderId: 'mgr_456',
        deciderRole: Role.MANAGER,
        status: ApprovalStatus.APPROVED,
      });

      // Second decision fails
      await expect(
        router.processDecision({
          approvalId: approval.approvalId,
          deciderId: 'mgr_456',
          deciderRole: Role.MANAGER,
          status: ApprovalStatus.APPROVED,
        })
      ).rejects.toThrow(DuplicateApprovalError);
    });

    test('Throws ApprovalNotFoundError when approvalId does not exist', async () => {
      await expect(
        router.processDecision({
          approvalId: 'appr_nonexistent',
          deciderId: 'mgr_456',
          deciderRole: Role.MANAGER,
          status: ApprovalStatus.APPROVED,
        })
      ).rejects.toThrow(ApprovalNotFoundError);
    });
  });

  describe('5. Linkage & Frontend Querying', () => {
    test('Approval maintains permanent linkage to workflowId and is queryable by workflowId', async () => {
      const approval = await router.createApprovalRequest({
        workflowId: 'wf_linked_999',
        workflowType: 'leave-request',
        resourceType: 'leave',
        resourceId: 'LR-999',
        requesterId: 'emp_123',
        assignedToRoleId: Role.MANAGER,
      });

      const fetchedByWorkflow = router.getApprovalByWorkflowId('wf_linked_999');
      expect(fetchedByWorkflow).toBeDefined();
      expect(fetchedByWorkflow?.approvalId).toBe(approval.approvalId);
      expect(fetchedByWorkflow?.resourceId).toBe('LR-999');

      const fetchedById = router.getApprovalById(approval.approvalId);
      expect(fetchedById).toBeDefined();
      expect(fetchedById?.workflowId).toBe('wf_linked_999');
    });
  });
});
