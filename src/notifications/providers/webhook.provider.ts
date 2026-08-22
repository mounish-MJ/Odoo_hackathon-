import {
  INotificationProvider,
  NotificationChannel,
  NotificationPayload,
  NotificationDeliveryResult,
} from '../../contracts/notification.contract';
import { WebhookDispatcher } from '../webhook.dispatcher';

export class WebhookNotificationProvider implements INotificationProvider {
  public channel = NotificationChannel.WEBHOOK;
  private webhookDispatcher: WebhookDispatcher;

  constructor(webhookDispatcher?: WebhookDispatcher) {
    this.webhookDispatcher = webhookDispatcher || WebhookDispatcher.getInstance();
  }

  public async send(notification: NotificationPayload): Promise<NotificationDeliveryResult> {
    try {
      await this.webhookDispatcher.dispatchEvent(notification.type, {
        notificationId: notification.notificationId,
        recipientId: notification.recipientId,
        title: notification.title,
        message: notification.message,
        data: notification.data,
      });
      return {
        channel: this.channel,
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (err: unknown) {
      return {
        channel: this.channel,
        success: false,
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      };
    }
  }
}
