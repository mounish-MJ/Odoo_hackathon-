import { v4 as uuidv4 } from 'uuid';
import {
  StandardEvent,
  StandardEventType,
  StandardEventSchema,
  AISignals,
} from '../contracts/event.contract';
import { Role } from '../contracts/authorization.contract';
import { RbacSecurityGuard } from '../security/rbac.guard';
import { IdempotencyGuard } from '../security/idempotency.guard';
import { PlatformEventBus, EventHandler } from './event-bus';
import { PIILogger } from '../security/pii.logger';

export interface IngestionResult {
  success: boolean;
  eventId: string;
  duplicate: boolean;
  error?: string;
}

export class EventIngestionService {
  private static instance: EventIngestionService;
  private eventBus: PlatformEventBus;
  private eventStore: Map<string, StandardEvent> = new Map();

  constructor(eventBus?: PlatformEventBus) {
    this.eventBus = eventBus || PlatformEventBus.getInstance();
  }

  public static getInstance(eventBus?: PlatformEventBus): EventIngestionService {
    if (!EventIngestionService.instance) {
      EventIngestionService.instance = new EventIngestionService(eventBus);
    } else if (eventBus) {
      EventIngestionService.instance.eventBus = eventBus;
    }
    return EventIngestionService.instance;
  }

  /**
   * -------------------------------------------------------------
   * 1. Ingestion Pipeline: Ingests, Validates, Authorizes & Publishes
   * -------------------------------------------------------------
   */
  public async ingestEvent(event: Partial<StandardEvent>): Promise<IngestionResult> {
    const eventId = event.eventId || uuidv4();
    const correlationId = event.correlationId || event.metadata?.correlationId || uuidv4();
    const timestamp = event.timestamp || new Date().toISOString();
    const version = event.version || '1.0';

    const normalizedEvent: StandardEvent = {
      eventId,
      eventType: event.eventType as string,
      timestamp,
      actor: event.actor as any,
      source: (event.source || event.producerId) as any,
      resourceType: event.resourceType as any,
      resourceId: event.resourceId as any,
      correlationId,
      version,
      payload: event.payload || {},
      aiSignals: event.aiSignals,
      idempotencyKey: event.idempotencyKey || eventId,
    };

    // A. Schema Validation
    const validation = StandardEventSchema.safeParse(normalizedEvent);
    if (!validation.success) {
      const errorMsg = `Event schema validation failed: ${validation.error.message}`;
      PIILogger.warn(errorMsg, { eventId, eventType: normalizedEvent.eventType });
      return { success: false, eventId, duplicate: false, error: errorMsg };
    }

    // B. Actor Authorization Check
    const actor = normalizedEvent.actor || { userId: 'anonymous', role: Role.EMPLOYEE };
    const isAuthorized = this.authorizeActorForEvent(normalizedEvent);
    if (!isAuthorized) {
      const errorMsg = `Actor '${actor.userId}' with role '${actor.role}' is unauthorized to emit '${normalizedEvent.eventType}'`;
      PIILogger.warn('Unauthorized event emission attempt blocked', {
        eventId,
        actor,
        eventType: normalizedEvent.eventType,
      });
      return { success: false, eventId, duplicate: false, error: errorMsg };
    }

    // C. Idempotency Check & Publish via Event Bus
    const publishResult = await this.eventBus.publish(normalizedEvent);
    if (!publishResult.published && publishResult.duplicate) {
      return { success: true, eventId, duplicate: true };
    }
    if (!publishResult.published && publishResult.error) {
      return { success: false, eventId, duplicate: false, error: publishResult.error };
    }

    // Save event in event store
    this.eventStore.set(eventId, Object.freeze({ ...normalizedEvent }));

    return { success: true, eventId, duplicate: false };
  }

  /**
   * -------------------------------------------------------------
   * 2. Actor Authorization Rule Evaluator
   * -------------------------------------------------------------
   */
  private authorizeActorForEvent(event: StandardEvent): boolean {
    const actor = event.actor || { userId: 'anonymous', role: Role.EMPLOYEE };
    const { role, userId } = actor;
    const eventType = event.eventType;

    // Trusted backend system producers (e.g. Member 1 HR Core, Platform)
    if (event.source === 'MEMBER_1_HR_CORE' || event.source === 'MEMBER_4_PLATFORM') {
      return true;
    }

    // Admin has universal authority
    if (role === Role.ADMIN) {
      return true;
    }

    // Event-specific rules:
    switch (eventType) {
      case StandardEventType.LEAVE_REQUESTED:
      case 'LeaveRequested':
      case 'leave.applied':
        // An employee can only request leave for themselves
        return (
          role === Role.EMPLOYEE ||
          role === Role.MANAGER ||
          role === Role.HR
        );

      case StandardEventType.LEAVE_APPROVED:
      case StandardEventType.LEAVE_REJECTED:
      case StandardEventType.APPROVAL_COMPLETED:
        // Only Manager, HR or Admin can approve/reject
        return role === Role.MANAGER || role === Role.HR;

      case StandardEventType.EMPLOYEE_UPDATED:
        // Only HR or Admin can update employee master data
        return role === Role.HR;

      case StandardEventType.ACTION_COMPLETED:
      case StandardEventType.ACTION_FAILED:
      case StandardEventType.APPROVAL_REQUESTED:
      case StandardEventType.NOTIFICATION_REQUESTED:
        // System or Manager/HR actions
        return [Role.MANAGER, Role.HR, Role.ADMIN].includes(role as Role);

      default:
        return true;
    }
  }

  /**
   * -------------------------------------------------------------
   * 3. Member 1 Publish Interface (Simple & Decoupled)
   * -------------------------------------------------------------
   */
  public async publishDomainEvent<T = Record<string, unknown>>(params: {
    eventType: StandardEventType | string;
    resourceType: string;
    resourceId: string;
    actor: { userId: string; role: string; email?: string };
    payload: T;
    correlationId?: string;
    idempotencyKey?: string;
  }): Promise<IngestionResult> {
    return this.ingestEvent({
      eventId: uuidv4(),
      eventType: params.eventType,
      source: 'MEMBER_1_HR_CORE',
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      actor: params.actor,
      payload: params.payload as Record<string, unknown>,
      correlationId: params.correlationId || uuidv4(),
      idempotencyKey: params.idempotencyKey,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * -------------------------------------------------------------
   * 4. Member 2 AI Signals Hook
   * Attaches AI signals strictly as metadata. Cannot bypass auth/approval.
   * -------------------------------------------------------------
   */
  public attachAISignals(event: StandardEvent, aiSignals: AISignals): StandardEvent {
    return {
      ...event,
      aiSignals: {
        ...aiSignals,
        timestamp: aiSignals.timestamp || new Date().toISOString(),
      },
    };
  }

  /**
   * -------------------------------------------------------------
   * 5. Member 3 Read & Subscribe Interface
   * -------------------------------------------------------------
   */
  public subscribeToEvent(
    eventType: StandardEventType | string,
    handler: EventHandler
  ): () => void {
    return this.eventBus.subscribe(eventType, handler);
  }

  public getEvent(eventId: string): StandardEvent | undefined {
    return this.eventStore.get(eventId);
  }

  public getEventsByCorrelationId(correlationId: string): StandardEvent[] {
    return Array.from(this.eventStore.values()).filter(
      (e) => e.correlationId === correlationId
    );
  }

  public getEventsByResource(resourceType: string, resourceId: string): StandardEvent[] {
    return Array.from(this.eventStore.values()).filter(
      (e) => e.resourceType === resourceType && e.resourceId === resourceId
    );
  }

  public clear(): void {
    this.eventStore.clear();
  }
}
