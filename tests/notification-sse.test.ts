import { NotificationService } from '../src/notifications/notification.service';
import { SSEManager } from '../src/notifications/sse.manager';
import { WebhookDispatcher } from '../src/notifications/webhook.dispatcher';
import { NotificationChannel, NotificationType } from '../src/contracts/notification.contract';

describe('Member 4 Notification & Real-Time Engine Tests', () => {
  let sseManager: SSEManager;
  let webhookDispatcher: WebhookDispatcher;
  let notifService: NotificationService;

  beforeEach(() => {
    sseManager = new SSEManager();
    webhookDispatcher = new WebhookDispatcher();
    notifService = new NotificationService(sseManager, webhookDispatcher);
  });

  test('1. Dispatches notification to In-App and manages read state', async () => {
    const res = await notifService.send({
      recipientId: 'user_100',
      type: NotificationType.LEAVE_STATUS,
      title: 'Leave Approved',
      message: 'Your leave has been approved by your manager.',
      channels: [NotificationChannel.IN_APP],
    });

    expect(res.success).toBe(true);

    const userNotifs = await notifService.getUserNotifications('user_100');
    expect(userNotifs.length).toBe(1);
    expect(userNotifs[0].read).toBe(false);

    // Mark as read
    await notifService.markAsRead(res.notificationId, 'user_100');
    const unread = await notifService.getUserNotifications('user_100', true);
    expect(unread.length).toBe(0);
  });

  test('2. Webhook Dispatcher generates HMAC-SHA256 signature and registers deliveries', async () => {
    const webhook = webhookDispatcher.registerWebhook({
      userId: 'admin_1',
      url: 'https://webhook.site/mock-test-url',
      events: ['leave.approved'],
      active: true,
    });

    expect(webhook.webhookId).toBeDefined();
    expect(webhook.signatureSecret).toMatch(/^whsec_/);

    const payload = JSON.stringify({ event: 'leave.approved', id: '123' });
    const signature = WebhookDispatcher.generateSignature(payload, webhook.signatureSecret);
    expect(signature).toBeDefined();
    expect(signature.length).toBe(64); // SHA256 hex string

    const dispatchResult = await webhookDispatcher.dispatchEvent('leave.approved', {
      leaveId: 'LR-1234',
      status: 'APPROVED',
    });

    expect(dispatchResult.dispatched).toBe(1);
    const logs = webhookDispatcher.getDeliveryLogs(webhook.webhookId);
    expect(logs.length).toBe(1);
    expect(logs[0].eventType).toBe('leave.approved');
  });
});
