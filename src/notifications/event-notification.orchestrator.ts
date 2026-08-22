import { PlatformEventBus } from '../orchestration/event-bus';
import { NotificationService } from './notification.service';
import { StandardEventType, StandardEvent } from '../contracts/event.contract';
import { NotificationChannel, NotificationType } from '../contracts/notification.contract';
import { Role } from '../contracts/authorization.contract';

export class EventNotificationOrchestrator {
  private static instance: EventNotificationOrchestrator;
  private eventBus: PlatformEventBus;
  private notificationService: NotificationService;
  private unbindFunctions: (() => void)[] = [];

  constructor(
    eventBus?: PlatformEventBus,
    notificationService?: NotificationService
  ) {
    this.eventBus = eventBus || PlatformEventBus.getInstance();
    this.notificationService = notificationService || NotificationService.getInstance();
    this.wireEventListeners();
  }

  public static getInstance(
    eventBus?: PlatformEventBus,
    notificationService?: NotificationService
  ): EventNotificationOrchestrator {
    if (!EventNotificationOrchestrator.instance) {
      EventNotificationOrchestrator.instance = new EventNotificationOrchestrator(
        eventBus,
        notificationService
      );
    }
    return EventNotificationOrchestrator.instance;
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
   * Wires domain events to appropriate notification dispatches.
   */
  public wireEventListeners(): void {
    this.unbind();

    // 1. Generic NotificationRequested Event
    this.unbindFunctions.push(
      this.eventBus.subscribe(
        StandardEventType.NOTIFICATION_REQUESTED,
        async (event: StandardEvent<any>) => {
          const p = event.payload;
          await this.notificationService.send({
            recipientId: p.recipientId,
            recipientRole: p.recipientRole,
            type: p.type || NotificationType.SYSTEM_ALERT,
            title: p.title || 'System Notification',
            message: p.message || '',
            data: p.data,
            channels: p.channels || [NotificationChannel.IN_APP, NotificationChannel.SSE_STREAM],
          });
        }
      )
    );

    // 2. Leave Approved -> Notify Employee & HR
    this.unbindFunctions.push(
      this.eventBus.subscribe(
        StandardEventType.LEAVE_APPROVED,
        async (event: StandardEvent<any>) => {
          const p = event.payload;
          await this.notificationService.send({
            recipientId: p.userId,
            recipientRole: Role.EMPLOYEE,
            type: NotificationType.LEAVE_STATUS,
            title: 'Leave Request Approved',
            message: `Your leave request ${p.leaveRequestId || ''} for ${p.daysDeducted || ''} days has been approved.`,
            channels: [NotificationChannel.IN_APP, NotificationChannel.SSE_STREAM, NotificationChannel.EMAIL],
            data: {
              leaveRequestId: p.leaveRequestId,
              newBalance: p.newBalance,
              approvedBy: p.approvedBy,
            },
          });
        }
      )
    );

    // 3. Leave Rejected -> Notify Employee with Reason
    this.unbindFunctions.push(
      this.eventBus.subscribe(
        StandardEventType.LEAVE_REJECTED,
        async (event: StandardEvent<any>) => {
          const p = event.payload;
          await this.notificationService.send({
            recipientId: p.userId,
            recipientRole: Role.EMPLOYEE,
            type: NotificationType.LEAVE_STATUS,
            title: 'Leave Request Rejected',
            message: `Your leave request ${p.leaveRequestId || ''} was rejected. Reason: ${p.reason || 'No comments provided'}.`,
            channels: [NotificationChannel.IN_APP, NotificationChannel.SSE_STREAM, NotificationChannel.EMAIL],
            data: {
              leaveRequestId: p.leaveRequestId,
              rejectedBy: p.rejectedBy,
              reason: p.reason,
            },
          });
        }
      )
    );

    // 4. Approval Requested -> Notify Manager
    this.unbindFunctions.push(
      this.eventBus.subscribe(
        StandardEventType.APPROVAL_REQUESTED,
        async (event: StandardEvent<any>) => {
          const p = event.payload;
          await this.notificationService.send({
            recipientId: p.assignedToUserId || 'MANAGER_POOL',
            recipientRole: p.assignedToRoleId || Role.MANAGER,
            type: NotificationType.APPROVAL_REQUEST,
            title: 'Approval Required',
            message: `Action requires your review for requester ${p.requesterId || 'Employee'}.`,
            channels: [NotificationChannel.IN_APP, NotificationChannel.SSE_STREAM],
            data: {
              approvalId: p.approvalId,
              workflowId: p.workflowId,
              requesterId: p.requesterId,
              aiRiskScore: p.aiRiskScore,
            },
          });
        }
      )
    );

    // 5. Action Failed -> Notify Affected User & HR
    this.unbindFunctions.push(
      this.eventBus.subscribe(
        StandardEventType.ACTION_FAILED,
        async (event: StandardEvent<any>) => {
          const p = event.payload;
          await this.notificationService.send({
            recipientId: event.actor?.userId || 'system',
            recipientRole: event.actor?.role || Role.EMPLOYEE,
            type: NotificationType.SYSTEM_ALERT,
            title: 'Workflow Execution Failed',
            message: `Operation '${p.workflowType || 'workflow'}' encountered an error: ${p.error || 'Unknown failure'}.`,
            channels: [NotificationChannel.IN_APP, NotificationChannel.SSE_STREAM],
            data: {
              workflowId: p.workflowId,
              failedStep: p.failedStep,
            },
          });
        }
      )
    );
  }
}
