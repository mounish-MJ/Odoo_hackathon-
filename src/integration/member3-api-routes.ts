import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthSecurityService, AuthenticatedRequest } from '../security/auth.middleware';
import { RbacSecurityGuard } from '../security/rbac.guard';
import { IdempotencyGuard } from '../security/idempotency.guard';
import {
  InputValidator,
  ApplyLeaveInputSchema,
  PublishEventInputSchema,
  ApprovalDecisionInputSchema,
  WebhookRegisterInputSchema,
} from '../security/input-validator';
import { Role } from '../contracts/authorization.contract';
import { EventContract, EventType } from '../contracts/event.contract';
import { WorkflowEngine } from '../orchestration/workflow-engine';
import { PlatformEventBus } from '../orchestration/event-bus';
import { ApprovalRouter } from '../orchestration/approval-router';
import { NotificationService } from '../notifications/notification.service';
import { SSEManager } from '../notifications/sse.manager';
import { AuditService } from '../audit/audit.service';
import { WebhookDispatcher } from '../notifications/webhook.dispatcher';
import { SecurityErrorHandler } from '../security/error-handler';

export function createPlatformRouter(
  workflowEngine: WorkflowEngine,
  eventBus: PlatformEventBus,
  approvalRouter: ApprovalRouter,
  notificationService: NotificationService,
  sseManager: SSEManager,
  auditService: AuditService,
  webhookDispatcher: WebhookDispatcher
): Router {
  const router = Router();

  // -------------------------------------------------------------
  // Real-Time Notification Stream (SSE for Member 3 Frontend)
  // -------------------------------------------------------------
  router.get('/notifications/stream', (req: Request, res: Response) => {
    const token = req.query.token as string;
    let user = { userId: 'anonymous_user', role: Role.EMPLOYEE };

    if (token) {
      try {
        user = AuthSecurityService.verifyToken(token);
      } catch {
        // Fallback for unauthenticated stream
      }
    }

    const clientId = `sse_${uuidv4().substring(0, 8)}`;
    sseManager.registerClient(clientId, user.userId, res, user.role);
  });

  // -------------------------------------------------------------
  // Event Ingestion API (Member 1, Member 2, Member 3)
  // -------------------------------------------------------------
  router.post(
    '/events/publish',
    AuthSecurityService.authenticate,
    InputValidator.validateBody(PublishEventInputSchema),
    IdempotencyGuard.middleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { eventType, payload, idempotencyKey } = req.body;

        const event: EventContract = {
          eventId: uuidv4(),
          eventType,
          producerId: req.user?.role ? `ROLE_${req.user.role}` : 'CLIENT_API',
          idempotencyKey: idempotencyKey || (req.headers['x-idempotency-key'] as string) || uuidv4(),
          timestamp: new Date().toISOString(),
          metadata: {
            correlationId: uuidv4(),
            userId: req.user?.userId,
            userRole: req.user?.role,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            timestamp: new Date().toISOString(),
            version: '1.0',
          },
          payload,
        };

        const result = await eventBus.publish(event);

        res.status(202).json({
          success: true,
          data: {
            eventId: event.eventId,
            published: result.published,
            duplicate: result.duplicate,
          },
          meta: {
            timestamp: event.timestamp,
            requestId: event.correlationId || event.metadata?.correlationId || event.eventId,
          },
        });
      } catch (err: unknown) {
        SecurityErrorHandler.sendInternalError(res, err);
      }
    }
  );

  // -------------------------------------------------------------
  // High-Level Domain Endpoints (Direct Orchestration Triggers)
  // -------------------------------------------------------------

  // Apply Leave (8-Step Orchestration Trigger with Input Validation & Resource Authorization)
  router.post(
    '/leaves/apply',
    AuthSecurityService.authenticate,
    InputValidator.validateBody(ApplyLeaveInputSchema),
    IdempotencyGuard.middleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const user = req.user!;
        const { leaveTypeId, startDate, endDate, days, reason } = req.body;

        const event: EventContract = {
          eventId: uuidv4(),
          eventType: EventType.LEAVE_APPLIED,
          producerId: 'MEMBER_3_FRONTEND',
          idempotencyKey: (req.headers['x-idempotency-key'] as string) || uuidv4(),
          timestamp: new Date().toISOString(),
          metadata: {
            correlationId: uuidv4(),
            userId: user.userId,
            userRole: user.role,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            timestamp: new Date().toISOString(),
            version: '1.0',
          },
          payload: {
            userId: user.userId,
            userName: user.name,
            userEmail: user.email,
            reportingManagerId: user.reportingManagerId,
            departmentId: user.departmentId,
            leaveTypeId,
            startDate,
            endDate,
            days: Number(days),
            reason,
          },
        };

        const context = await workflowEngine.executeWorkflow('leave-request', event);

        res.status(context.status === 'FAILED' ? 400 : 201).json({
          success: context.status !== 'FAILED',
          data: {
            workflowId: context.workflowId,
            status: context.status,
            approvalStatus: context.approvalStatus,
            approvalId: context.approvalId,
            output: context.output,
            error: context.error instanceof Error ? context.error.message : context.error,
          },
          meta: {
            correlationId: event.correlationId || event.metadata?.correlationId || event.eventId,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (err: unknown) {
        SecurityErrorHandler.sendInternalError(res, err);
      }
    }
  );

  // -------------------------------------------------------------
  // Workflow Status Query (Protected by Resource Ownership / Role)
  // -------------------------------------------------------------
  router.get(
    '/workflows/:workflowId',
    AuthSecurityService.authenticate,
    (req: AuthenticatedRequest, res: Response) => {
      const context = workflowEngine.getWorkflowContext(req.params.workflowId);
      if (!context) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Workflow context not found' },
        });
        return;
      }

      // Enforce that requester is either owner or HR/Admin/Manager
      const eventOwnerId = context.event.actor?.userId || context.event.metadata?.userId || (context.event.payload as any)?.userId;
      const isOwner = eventOwnerId === req.user?.userId;
      const isPrivileged = [Role.ADMIN, Role.HR, Role.MANAGER].includes(req.user!.role);

      if (!isOwner && !isPrivileged) {
        SecurityErrorHandler.sendForbidden(res, 'You cannot access another user workflow status');
        return;
      }

      res.json({
        success: true,
        data: {
          workflowId: context.workflowId,
          workflowType: context.workflowType,
          status: context.status,
          approvalStatus: context.approvalStatus,
          approvalId: context.approvalId,
          stepResults: context.stepResults,
          output: context.output,
          error: context.error instanceof Error ? context.error.message : context.error,
          durationMs: (context.endTime || Date.now()) - context.startTime,
        },
      });
    }
  );

  // -------------------------------------------------------------
  // Approval Routing Endpoints
  // -------------------------------------------------------------
  router.get(
    '/approvals/pending',
    AuthSecurityService.authenticate,
    RbacSecurityGuard.requireRoles(Role.MANAGER, Role.HR, Role.ADMIN),
    (req: AuthenticatedRequest, res: Response) => {
      const user = req.user!;
      const pending = approvalRouter.getPendingApprovals(
        user.role === Role.ADMIN ? undefined : user.role,
        user.role === Role.MANAGER ? user.userId : undefined
      );

      res.json({
        success: true,
        data: pending,
      });
    }
  );

  router.get(
    '/approvals/:approvalId',
    AuthSecurityService.authenticate,
    (req: AuthenticatedRequest, res: Response) => {
      const approval = approvalRouter.getApprovalById(req.params.approvalId);
      if (!approval) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Approval request not found' },
        });
        return;
      }

      // Check authorization (requester, assigned approver, or HR/Admin)
      const user = req.user!;
      const isRequester = approval.requesterId === user.userId;
      const isAssigned = approval.assignedToUserId === user.userId;
      const isPrivileged = [Role.ADMIN, Role.HR].includes(user.role);

      if (!isRequester && !isAssigned && !isPrivileged) {
        SecurityErrorHandler.sendForbidden(res, 'You cannot access another user approval record');
        return;
      }

      res.json({
        success: true,
        data: approval,
      });
    }
  );

  router.get(
    '/approvals/workflow/:workflowId',
    AuthSecurityService.authenticate,
    (req: AuthenticatedRequest, res: Response) => {
      const approval = approvalRouter.getApprovalByWorkflowId(req.params.workflowId);
      if (!approval) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'No approval linked to this workflow' },
        });
        return;
      }

      const user = req.user!;
      const isRequester = approval.requesterId === user.userId;
      const isAssigned = approval.assignedToUserId === user.userId;
      const isPrivileged = [Role.ADMIN, Role.HR].includes(user.role);

      if (!isRequester && !isAssigned && !isPrivileged) {
        SecurityErrorHandler.sendForbidden(res, 'You cannot access another user approval record');
        return;
      }

      res.json({
        success: true,
        data: approval,
      });
    }
  );

  router.post(
    '/approvals/:approvalId/decide',
    AuthSecurityService.authenticate,
    RbacSecurityGuard.requireRoles(Role.MANAGER, Role.HR, Role.ADMIN),
    InputValidator.validateBody(ApprovalDecisionInputSchema),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { approvalId } = req.params;
        const { decision, comments } = req.body;

        const resumedContext = await workflowEngine.resumeWorkflowWithApproval(
          approvalId,
          decision,
          req.user!.userId,
          comments
        );

        res.json({
          success: true,
          data: {
            workflowId: resumedContext.workflowId,
            status: resumedContext.status,
            output: resumedContext.output,
            error: resumedContext.error instanceof Error ? resumedContext.error.message : resumedContext.error,
          },
        });
      } catch (err: unknown) {
        SecurityErrorHandler.sendInternalError(res, err);
      }
    }
  );

  // -------------------------------------------------------------
  // Notification Management Endpoints (Strictly user-scoped)
  // -------------------------------------------------------------
  router.get(
    '/notifications',
    AuthSecurityService.authenticate,
    async (req: AuthenticatedRequest, res: Response) => {
      const unreadOnly = req.query.unread_only === 'true';
      const limit = parseInt(req.query.limit as string) || 20;

      const notifs = await notificationService.getUserNotifications(
        req.user!.userId,
        unreadOnly,
        limit
      );
      const unreadCount = notifs.filter((n) => !n.read).length;

      res.json({
        success: true,
        data: notifs,
        unread_count: unreadCount,
      });
    }
  );

  router.put(
    '/notifications/:notificationId/read',
    AuthSecurityService.authenticate,
    async (req: AuthenticatedRequest, res: Response) => {
      const updated = await notificationService.markAsRead(
        req.params.notificationId,
        req.user!.userId
      );
      res.json({ success: updated, message: updated ? 'Marked as read' : 'Notification not found' });
    }
  );

  router.put(
    '/notifications/read-all',
    AuthSecurityService.authenticate,
    async (req: AuthenticatedRequest, res: Response) => {
      const count = await notificationService.markAllAsRead(req.user!.userId);
      res.json({ success: true, marked_count: count });
    }
  );

  // -------------------------------------------------------------
  // Audit Trail Query (HR & Admin only)
  // -------------------------------------------------------------
  router.get(
    '/audit/logs',
    AuthSecurityService.authenticate,
    RbacSecurityGuard.requireRoles(Role.HR, Role.ADMIN),
    async (req: AuthenticatedRequest, res: Response) => {
      const { userId, resourceType, action, limit, offset } = req.query;
      const logs = await auditService.queryAuditLogs({
        userId: userId as string,
        resourceType: resourceType as string,
        action: action as string,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      });

      res.json({
        success: true,
        data: logs.logs,
        total: logs.total,
      });
    }
  );

  // -------------------------------------------------------------
  // Webhooks Management (Admin only)
  // -------------------------------------------------------------
  router.post(
    '/webhooks/register',
    AuthSecurityService.authenticate,
    RbacSecurityGuard.requireRoles(Role.ADMIN),
    InputValidator.validateBody(WebhookRegisterInputSchema),
    (req: AuthenticatedRequest, res: Response) => {
      const { url, events } = req.body;

      const webhook = webhookDispatcher.registerWebhook({
        userId: req.user!.userId,
        url,
        events,
        active: true,
      });

      res.status(201).json({
        success: true,
        data: {
          webhook_id: webhook.webhookId,
          url: webhook.url,
          events: webhook.events,
          signature_key: webhook.signatureSecret,
        },
      });
    }
  );

  return router;
}
