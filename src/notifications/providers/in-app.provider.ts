import {
  INotificationProvider,
  NotificationChannel,
  NotificationPayload,
  NotificationDeliveryResult,
} from '../../contracts/notification.contract';

export class InAppNotificationProvider implements INotificationProvider {
  public channel = NotificationChannel.IN_APP;
  private notifications: NotificationPayload[] = [];

  public async send(notification: NotificationPayload): Promise<NotificationDeliveryResult> {
    try {
      this.notifications.unshift({ ...notification, read: false });
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

  public getNotifications(userId: string, unreadOnly = false, limit = 20): NotificationPayload[] {
    return this.notifications
      .filter((n) => n.recipientId === userId && (!unreadOnly || !n.read))
      .slice(0, limit);
  }

  public markAsRead(notificationId: string, userId: string): boolean {
    const notif = this.notifications.find(
      (n) => n.notificationId === notificationId && n.recipientId === userId
    );
    if (notif) {
      notif.read = true;
      return true;
    }
    return false;
  }

  public markAllAsRead(userId: string): number {
    let count = 0;
    for (const n of this.notifications) {
      if (n.recipientId === userId && !n.read) {
        n.read = true;
        count++;
      }
    }
    return count;
  }

  public clear(): void {
    this.notifications = [];
  }
}
