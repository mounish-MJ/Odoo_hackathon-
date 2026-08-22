import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { platformConfig, configManager } from './config/platform.config';
import { StructuredLogger } from './observability/logger';
import { HealthService } from './observability/health.service';

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
import { SecurityErrorHandler } from './security/error-handler';

// Adapters for Member 1 and Member 2
import { AdapterFactory } from './integration/adapters/adapter-factory';

// Workflows
import { LeaveRequestWorkflow } from './orchestration/workflows/leave-request.workflow';
import { AttendanceAnomalyWorkflow } from './orchestration/workflows/attendance-anomaly.workflow';
import { PayrollProcessWorkflow } from './orchestration/workflows/payroll-process.workflow';

export function createApp(): Express {
  const app = express();

  // -------------------------------------------------------------
  // Security & Tracing Middleware
  // -------------------------------------------------------------
  app.use(requestIdMiddleware);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: platformConfig.CORS_ORIGIN || '*' }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(
    RateLimiter.createLimiter(
      platformConfig.RATE_LIMIT_MAX_REQUESTS,
      platformConfig.RATE_LIMIT_WINDOW_MS
    )
  );

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
  const healthService = HealthService.getInstance();

  // Initialize Member 1 & Member 2 Adapters (Live HTTP or Mock based on env)
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
  // Liveness & Readiness Endpoints
  // -------------------------------------------------------------
  const livenessHandler = (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'HEALTHY',
      service: 'DAYFLOW Member 4 — Orchestration + Security + Platform',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      activeSSEConnections: sseManager.getActiveClientCount(),
      registeredWebhooks: webhookDispatcher.getSubscriptions().length,
    });
  };

  const readinessHandler = async (_req: Request, res: Response) => {
    try {
      const report = await healthService.getReadinessReport();
      const statusCode = report.status === 'HEALTHY' ? 200 : report.status === 'DEGRADED' ? 200 : 503;
      res.status(statusCode).json(report);
    } catch (err: unknown) {
      SecurityErrorHandler.sendInternalError(res, err);
    }
  };

  app.get('/health', livenessHandler);
  app.get('/api/v1/health', livenessHandler);

  app.get('/ready', readinessHandler);
  app.get('/api/v1/ready', readinessHandler);

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

  // -------------------------------------------------------------
  // Global 404 & Error Handling
  // -------------------------------------------------------------
  app.use((req: Request, res: Response) => {
    SecurityErrorHandler.sendNotFound(res, `Route not found: ${req.method} ${req.originalUrl}`);
  });

  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    StructuredLogger.error('Unhandled server error caught in Express middleware', err, {
      path: req.path,
      method: req.method,
    });
    SecurityErrorHandler.sendInternalError(res, err);
  });

  return app;
}

// -------------------------------------------------------------
// Standalone Server Launcher with Graceful Shutdown
// -------------------------------------------------------------
if (require.main === module) {
  try {
    // Validate config at startup
    configManager.loadAndValidateConfig();

    const app = createApp();
    const effectivePort = configManager.getEffectivePort();

    const server = app.listen(effectivePort, () => {
      StructuredLogger.info(`DAYFLOW Member 4 Orchestration Platform started successfully`, {
        port: effectivePort,
        environment: platformConfig.NODE_ENV,
        nodeVersion: process.version,
      });

      console.log(`=================================================================`);
      console.log(`🚀 DAYFLOW Member 4 — Orchestration + Security + Platform Engine`);
      console.log(`📡 Listening on:      http://localhost:${effectivePort}`);
      console.log(`⚡ Liveness Probe:   http://localhost:${effectivePort}/health`);
      console.log(`🩺 Readiness Probe:  http://localhost:${effectivePort}/ready`);
      console.log(`🔔 SSE Stream:        http://localhost:${effectivePort}/api/v1/notifications/stream`);
      console.log(`🏢 Member 1 HR URL:   ${platformConfig.MEMBER1_HR_CORE_URL}`);
      console.log(`🤖 Member 2 AI URL:   ${platformConfig.MEMBER2_AI_ENGINE_URL}`);
      console.log(`=================================================================`);
    });

    // Graceful Shutdown
    const gracefulShutdown = (signal: string) => {
      StructuredLogger.info(`Received ${signal}. Initiating graceful shutdown...`);
      server.close(() => {
        StructuredLogger.info('HTTP server closed successfully. Terminating process.');
        process.exit(0);
      });

      // Force terminate after 10s if connections refuse to drain
      setTimeout(() => {
        StructuredLogger.error('Forcefully terminating after 10s shutdown timeout.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('uncaughtException', (err: Error) => {
      StructuredLogger.error('FATAL: Uncaught Exception', err);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason: unknown) => {
      StructuredLogger.error('FATAL: Unhandled Promise Rejection', reason);
    });
  } catch (err: unknown) {
    StructuredLogger.error('FATAL: Startup initialization failed', err);
    process.exit(1);
  }
}
