import { v4 as uuidv4 } from 'uuid';
import { NotificationService } from '../src/notifications/notification.service';
import { EventNotificationOrchestrator } from '../src/notifications/event-notification.orchestrator';
import { PlatformEventBus } from '../src/orchestration/event-bus';
import {
  NotificationChannel,
  NotificationType,
  INotificationProvider,
} from '../src/contracts/notification.contract';
import { StandardEventType, StandardEvent } from '../src/contracts/event.contract';
import { Role } from '../src/contracts/authorization.contract';

describe('Member 4 Event-Driven Notification Component Tests', () => {
  let notificationService: NotificationService;
  let eventBus: PlatformEventBus;
  let orchestrator: EventNotificationOrchestrator;

  beforeEach(() => {
    eventBus = PlatformEventBus.getInstance();
    eventBus.clear();
    notificationService = NotificationService.getInstance();
    notificationService.clear();
    orchestrator = EventNotificationOrchestrator.getInstance(eventBus, notificationService);
    orchestrator.wireEventListeners();
  });

  afterEach(() => {
    orchestrator.unbind();
  });

  describe('1. Event-Driven Notification Triggers', () => {
    test('LeaveApproved event automatically triggers in-app notification for employee', async () => {
      const leaveApprovedEvent: StandardEvent = {
        eventId: uuidv4(),
        eventType: StandardEventType.LEAVE_APPROVED,
        timestamp: new Date().toISOString(),
        actor: { userId: 'mgr_456', role: Role.MANAGER },
        source: 'MEMBER_4_PLATFORM',
        resourceType: 'leave',
        resourceId: 'LR-101',
        correlationId: 'trace-notif-01',
        payload: {
          userId: 'user_emp_1',
          leaveRequestId: 'LR-101',
          daysDeducted: 3,
          newBalance: 12,
          approvedBy: 'Jane Manager',
        },
      };

      await eventBus.publish(leaveApprovedEvent);

      // Wait for event listener execution
      await new Promise((resolve) => setTimeout(resolve, 60));

      const notifs = await notificationService.getUserNotifications('user_emp_1');
      expect(notifs.length).toBe(1);
      expect(notifs[0].title).toBe('Leave Request Approved');
      expect(notifs[0].message).toContain('LR-101');
      expect(notifs[0].message).toContain('3 days');
    });

    test('LeaveRejected event automatically triggers in-app notification with rejection reason', async () => {
      const leaveRejectedEvent: StandardEvent = {
        eventId: uuidv4(),
        eventType: StandardEventType.LEAVE_REJECTED,
        timestamp: new Date().toISOString(),
        actor: { userId: 'mgr_456', role: Role.MANAGER },
        source: 'MEMBER_4_PLATFORM',
        resourceType: 'leave',
        resourceId: 'LR-102',
        correlationId: 'trace-notif-02',
        payload: {
          userId: 'user_emp_2',
          leaveRequestId: 'LR-102',
          rejectedBy: 'Jane Manager',
          reason: 'Critical sprint release',
        },
      };

      await eventBus.publish(leaveRejectedEvent);

      await new Promise((resolve) => setTimeout(resolve, 60));

      const notifs = await notificationService.getUserNotifications('user_emp_2');
      expect(notifs.length).toBe(1);
      expect(notifs[0].title).toBe('Leave Request Rejected');
      expect(notifs[0].message).toContain('Critical sprint release');
    });

    test('ApprovalRequested event automatically alerts assigned manager', async () => {
      const approvalReqEvent: StandardEvent = {
        eventId: uuidv4(),
        eventType: StandardEventType.APPROVAL_REQUESTED,
        timestamp: new Date().toISOString(),
        actor: { userId: 'user_emp_3', role: Role.EMPLOYEE },
        source: 'MEMBER_4_PLATFORM',
        resourceType: 'approval',
        resourceId: 'appr_555',
        correlationId: 'trace-notif-03',
        payload: {
          approvalId: 'appr_555',
          workflowId: 'wf_555',
          requesterId: 'user_emp_3',
          assignedToUserId: 'mgr_lead',
          assignedToRoleId: Role.MANAGER,
        },
      };

      await eventBus.publish(approvalReqEvent);

      await new Promise((resolve) => setTimeout(resolve, 60));

      const notifs = await notificationService.getUserNotifications('mgr_lead');
      expect(notifs.length).toBe(1);
      expect(notifs[0].title).toBe('Approval Required');
      expect(notifs[0].message).toContain('user_emp_3');
    });
  });

  describe('2. PII Scrubbing on Notification Payloads', () => {
    test('Automatically redacts passwords, bank accounts, SSN, and salaries in notification data', async () => {
      const dispatchResult = await notificationService.send({
        recipientId: 'emp_privacy',
        type: NotificationType.PAYROLL_UPDATE,
        title: 'Payroll Generated',
        message: 'Your monthly statement is ready',
        channels: [NotificationChannel.IN_APP],
        data: {
          accountNumber: '123456789012',
          bankAccount: 'US89370400440532013000',
          salary: 85000,
          password: 'SecretPassword123!',
          department: 'Engineering',
        },
      });

      expect(dispatchResult.success).toBe(true);

      const notifs = await notificationService.getUserNotifications('emp_privacy');
      expect(notifs.length).toBe(1);
      expect(notifs[0].data?.accountNumber).toBe('[REDACTED]');
      expect(notifs[0].data?.bankAccount).toBe('[REDACTED]');
      expect(notifs[0].data?.salary).toBe('[REDACTED]');
      expect(notifs[0].data?.password).toBe('[REDACTED]');
      expect(notifs[0].data?.department).toBe('Engineering');
    });
  });

  describe('3. Pluggable Providers & Channel Failure Isolation', () => {
    test('Allows registering a custom third-party notification provider', async () => {
      let customProviderCalled = false;

      const customProvider: INotificationProvider = {
        channel: 'SLACK' as any,
        send: async () => {
          customProviderCalled = true;
          return {
            channel: 'SLACK' as any,
            success: true,
            timestamp: new Date().toISOString(),
          };
        },
      };

      notificationService.registerProvider(customProvider);

      await notificationService.send({
        recipientId: 'emp_slack',
        type: NotificationType.SYSTEM_ALERT,
        title: 'Slack Alert',
        message: 'Broadcast to Slack',
        channels: [NotificationChannel.IN_APP, 'SLACK' as any],
      });

      expect(customProviderCalled).toBe(true);
    });

    test('Provider failure records partialFailure and does not throw or crash workflow', async () => {
      const failingProvider: INotificationProvider = {
        channel: 'SMS' as any,
        send: async () => {
          throw new Error('SMS Gateway connection timed out');
        },
      };

      notificationService.registerProvider(failingProvider);

      const result = await notificationService.send({
        recipientId: 'emp_sms',
        type: NotificationType.SYSTEM_ALERT,
        title: 'SMS Alert',
        message: 'Critical ping',
        channels: [NotificationChannel.IN_APP, 'SMS' as any],
      });

      expect(result.success).toBe(false);
      expect(result.partialFailure).toBe(true);
      expect(result.deliveryResults[NotificationChannel.IN_APP].success).toBe(true);
      expect(result.deliveryResults['SMS'].success).toBe(false);
      expect(result.deliveryResults['SMS'].error).toContain('SMS Gateway connection timed out');
    });
  });

  describe('4. In-App Notification Read State Management', () => {
    test('Manages read states: unread filtering, mark single read, mark all read', async () => {
      await notificationService.send({
        recipientId: 'user_inbox',
        type: NotificationType.SYSTEM_ALERT,
        title: 'Alert 1',
        message: 'Msg 1',
        channels: [NotificationChannel.IN_APP],
      });

      await notificationService.send({
        recipientId: 'user_inbox',
        type: NotificationType.SYSTEM_ALERT,
        title: 'Alert 2',
        message: 'Msg 2',
        channels: [NotificationChannel.IN_APP],
      });

      let unread = await notificationService.getUserNotifications('user_inbox', true);
      expect(unread.length).toBe(2);

      // Mark single as read
      await notificationService.markAsRead(unread[0].notificationId!, 'user_inbox');
      unread = await notificationService.getUserNotifications('user_inbox', true);
      expect(unread.length).toBe(1);

      // Mark all as read
      await notificationService.markAllAsRead('user_inbox');
      unread = await notificationService.getUserNotifications('user_inbox', true);
      expect(unread.length).toBe(0);
    });
  });
});
