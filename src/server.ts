import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import { PlatformEventBus } from './orchestration/event-bus';
import { WorkflowEngine } from './orchestration/workflow-engine';
import { ApprovalRouter } from './orchestration/approval-router';
import { NotificationService } from './notifications/notification.service';
import { EventNotificationOrchestrator } from './notifications/event-notification.orchestrator';
import { SSEManager } from './notifications/sse.manager';
import { AuditService } from './audit/audit.service';
import { EventAuditOrchestrator } from './audit/event-audit.orchestrator';
import { WebhookDispatcher } from './notifications/webhook.dispatcher';
import { RateLimiter } from './security/rate-limiter';
import { requestIdMiddleware } from './security/request-id.middleware';
import { createPlatformRouter } from './integration/member3-api-routes';

// Adapters for Member 1 and Member 2
import { AdapterFactory } from './integration/adapters/adapter-factory';

// Workflows
import { LeaveRequestWorkflow } from './orchestration/workflows/leave-request.workflow';
import { AttendanceAnomalyWorkflow } from './orchestration/workflows/attendance-anomaly.workflow';
import { PayrollProcessWorkflow } from './orchestration/workflows/payroll-process.workflow';

dotenv.config();

export function createApp(): Express {
  const app = express();

  // -------------------------------------------------------------
  // Security & Tracing Middleware
  // -------------------------------------------------------------
  app.use(requestIdMiddleware);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(RateLimiter.createLimiter(100, 60000));

  // -------------------------------------------------------------
  // Initialize Core Singletons & Services
  // -------------------------------------------------------------
  const eventBus = PlatformEventBus.getInstance();
  const approvalRouter = ApprovalRouter.getInstance(eventBus);
  const auditService = AuditService.getInstance();
  const eventAuditOrchestrator = EventAuditOrchestrator.getInstance(eventBus, auditService);
  const sseManager = SSEManager.getInstance();
  const webhookDispatcher = WebhookDispatcher.getInstance();
  const notificationService = NotificationService.getInstance();
  const eventNotificationOrchestrator = EventNotificationOrchestrator.getInstance(eventBus, notificationService);
  const workflowEngine = WorkflowEngine.getInstance(eventBus, approvalRouter);

  // Initialize Member 1 & Member 2 Adapters (Mock or Live HTTP based on config)
  const hrCoreService = AdapterFactory.createHRCoreService();
  const aiEngineService = AdapterFactory.createAIEngineService();

  // Register Workflows
  workflowEngine.registerWorkflow(
    new LeaveRequestWorkflow(hrCoreService, aiEngineService, approvalRouter)
  );
  workflowEngine.registerWorkflow(
    new AttendanceAnomalyWorkflow(hrCoreService, aiEngineService)
  );
  workflowEngine.registerWorkflow(
    new PayrollProcessWorkflow(hrCoreService)
  );

  // -------------------------------------------------------------
  // Health & Diagnostic Endpoints
  // -------------------------------------------------------------
  const healthHandler = (_req: Request, res: Response) => {
    res.json({
      status: 'HEALTHY',
      service: 'DAYFLOW Member 4 — Orchestration + Security + Platform',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      activeSSEConnections: sseManager.getActiveClientCount(),
      registeredWebhooks: webhookDispatcher.getSubscriptions().length,
    });
  };

  app.get('/health', healthHandler);
  app.get('/api/v1/health', healthHandler);

  // -------------------------------------------------------------
  // Mount Main Platform API Router
  // -------------------------------------------------------------
  const platformRouter = createPlatformRouter(
    workflowEngine,
    eventBus,
    approvalRouter,
    notificationService,
    sseManager,
    auditService,
    webhookDispatcher
  );

  app.use('/api/v1', platformRouter);

  return app;
}

// Start standalone server if run directly
if (require.main === module) {
  const app = createApp();
  const PORT = process.env.PORT || 4000;
  const server = app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 DAYFLOW Member 4 Orchestration Platform Active`);
    console.log(`📡 Listening on: http://localhost:${PORT}`);
    console.log(`⚡ Health Check: http://localhost:${PORT}/api/v1/health`);
    console.log(`🔔 SSE Stream:   http://localhost:${PORT}/api/v1/notifications/stream`);
    console.log(`=======================================================`);
  });

  process.on('SIGTERM', () => {
    server.close(() => {
      console.log('Server gracefully terminated');
    });
  });
}
