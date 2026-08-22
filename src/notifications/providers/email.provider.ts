import {
  INotificationProvider,
  NotificationChannel,
  NotificationPayload,
  NotificationDeliveryResult,
} from '../../contracts/notification.contract';

export class EmailNotificationProvider implements INotificationProvider {
  public channel = NotificationChannel.EMAIL;
  private sentEmails: Array<{ to: string; subject: string; body: string; sentAt: string }> = [];

  public async send(notification: NotificationPayload): Promise<NotificationDeliveryResult> {
    try {
      // In production, connect SMTP/SES/SendGrid
      this.sentEmails.unshift({
        to: `${notification.recipientId}@dayflow.app`,
        subject: notification.title,
        body: notification.message,
        sentAt: new Date().toISOString(),
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

  public getSentEmails(): Array<{ to: string; subject: string; body: string; sentAt: string }> {
    return this.sentEmails;
  }

  public clear(): void {
    this.sentEmails = [];
  }
}
