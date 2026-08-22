import { PlatformEventBus } from '../orchestration/event-bus';
import { AuditService } from './audit.service';
import { StandardEventType, StandardEvent } from '../contracts/event.contract';

export class EventAuditOrchestrator {
  private static instance: EventAuditOrchestrator;
  private eventBus: PlatformEventBus;
  private auditService: AuditService;
  private unbindFunctions: (() => void)[] = [];

  constructor(eventBus?: PlatformEventBus, auditService?: AuditService) {
    this.eventBus = eventBus || PlatformEventBus.getInstance();
    this.auditService = auditService || AuditService.getInstance();
    this.wireEventListeners();
  }

  public static getInstance(
    eventBus?: PlatformEventBus,
    auditService?: AuditService
  ): EventAuditOrchestrator {
    if (!EventAuditOrchestrator.instance) {
      EventAuditOrchestrator.instance = new EventAuditOrchestrator(eventBus, auditService);
    }
    return EventAuditOrchestrator.instance;
  }

  public unbind(): void {
    for (const fn of this.unbindFunctions) {
      try {
        fn();
      } catch {
        // Safe disposal
      }
    }
    this.unbindFunctions = [];
  }

  /**
   * Wires domain events to automatic audit log creation.
   */
  public wireEventListeners(): void {
    this.unbind();

    // 1. Leave Requested
    this.unbindFunctions.push(
      this.eventBus.subscribe(
        StandardEventType.LEAVE_REQUESTED,
        async (event: StandardEvent<any>) => {
          await this.auditService.recordAudit({
            userId: event.actor?.userId,
            userRole: event.actor?.role,
            action: 'LEAVE_REQUESTED',
            resourceType: event.resourceType || 'leave',
            resourceId: event.resourceId,
            source: event.source,
            correlationId: event.correlationId,
            newData: event.payload,
            status: 'SUCCESS',
          });
        }
      )
    );

    // 2. Leave Approved
    this.unbindFunctions.push(
      this.eventBus.subscribe(
        StandardEventType.LEAVE_APPROVED,
        async (event: StandardEvent<any>) => {
          await this.auditService.recordAudit({
            userId: event.actor?.userId,
            userRole: event.actor?.role,
            action: 'LEAVE_APPROVED',
            resourceType: event.resourceType || 'leave',
            resourceId: event.resourceId,
            source: event.source,
            correlationId: event.correlationId,
            newData: event.payload,
            status: 'SUCCESS',
          });
        }
      )
    );

    // 3. Leave Rejected
    this.unbindFunctions.push(
      this.eventBus.subscribe(
        StandardEventType.LEAVE_REJECTED,
        async (event: StandardEvent<any>) => {
          await this.auditService.recordAudit({
            userId: event.actor?.userId,
            userRole: event.actor?.role,
            action: 'LEAVE_REJECTED',
            resourceType: event.resourceType || 'leave',
            resourceId: event.resourceId,
            source: event.source,
            correlationId: event.correlationId,
            newData: event.payload,
            status: 'SUCCESS',
          });
        }
      )
    );

    // 4. Approval Requested
    this.unbindFunctions.push(
      this.eventBus.subscribe(
        StandardEventType.APPROVAL_REQUESTED,
        async (event: StandardEvent<any>) => {
          await this.auditService.recordAudit({
            userId: event.actor?.userId,
            userRole: event.actor?.role,
            action: 'APPROVAL_CREATED',
            resourceType: event.resourceType || 'approval',
            resourceId: event.resourceId,
            source: event.source,
            correlationId: event.correlationId,
            newData: event.payload,
            status: 'SUCCESS',
          });
        }
      )
    );

    // 5. Approval Approved / Rejected
    this.unbindFunctions.push(
      this.eventBus.subscribe(
        StandardEventType.APPROVAL_APPROVED,
        async (event: StandardEvent<any>) => {
          await this.auditService.recordAudit({
            userId: event.actor?.userId,
            userRole: event.actor?.role,
            action: 'APPROVAL_DECIDED',
            resourceType: event.resourceType || 'approval',
            resourceId: event.resourceId,
            source: event.source,
            correlationId: event.correlationId,
            newData: event.payload,
            status: 'SUCCESS',
          });
        }
      )
    );

    this.unbindFunctions.push(
      this.eventBus.subscribe(
        StandardEventType.APPROVAL_REJECTED,
        async (event: StandardEvent<any>) => {
          await this.auditService.recordAudit({
            userId: event.actor?.userId,
            userRole: event.actor?.role,
            action: 'APPROVAL_DECIDED',
            resourceType: event.resourceType || 'approval',
            resourceId: event.resourceId,
            source: event.source,
            correlationId: event.correlationId,
            newData: event.payload,
            status: 'SUCCESS',
          });
        }
      )
    );

    // 6. Action Completed
    this.unbindFunctions.push(
      this.eventBus.subscribe(
        StandardEventType.ACTION_COMPLETED,
        async (event: StandardEvent<any>) => {
          await this.auditService.recordAudit({
            userId: event.actor?.userId,
            userRole: event.actor?.role,
            action: 'HR_ACTION_EXECUTED',
            resourceType: event.resourceType || 'workflow',
            resourceId: event.resourceId,
            source: event.source,
            correlationId: event.correlationId,
            newData: event.payload,
            status: 'SUCCESS',
          });
        }
      )
    );

    // 7. Action Failed
    this.unbindFunctions.push(
      this.eventBus.subscribe(
        StandardEventType.ACTION_FAILED,
        async (event: StandardEvent<any>) => {
          await this.auditService.recordAudit({
            userId: event.actor?.userId,
            userRole: event.actor?.role,
            action: 'HR_ACTION_FAILED',
            resourceType: event.resourceType || 'workflow',
            resourceId: event.resourceId,
            source: event.source,
            correlationId: event.correlationId,
            newData: event.payload,
            status: 'FAILURE',
            failureReason: event.payload?.error || 'Action failed',
          });
        }
      )
    );

    // 8. Notification Generated
    this.unbindFunctions.push(
      this.eventBus.subscribe(
        StandardEventType.NOTIFICATION_REQUESTED,
        async (event: StandardEvent<any>) => {
          await this.auditService.recordAudit({
            userId: event.actor?.userId,
            userRole: event.actor?.role,
            action: 'NOTIFICATION_GENERATED',
            resourceType: 'notification',
            resourceId: event.resourceId,
            source: event.source,
            correlationId: event.correlationId,
            newData: event.payload,
            status: 'SUCCESS',
          });
        }
      )
    );
  }
}
