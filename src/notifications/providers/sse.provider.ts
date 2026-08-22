import {
  INotificationProvider,
  NotificationChannel,
  NotificationPayload,
  NotificationDeliveryResult,
} from '../../contracts/notification.contract';
import { SSEManager } from '../sse.manager';

export class SSENotificationProvider implements INotificationProvider {
  public channel = NotificationChannel.SSE_STREAM;
  private sseManager: SSEManager;

  constructor(sseManager?: SSEManager) {
    this.sseManager = sseManager || SSEManager.getInstance();
  }

  public async send(notification: NotificationPayload): Promise<NotificationDeliveryResult> {
    try {
      this.sseManager.sendToUser(notification.recipientId, 'notification', notification);
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
