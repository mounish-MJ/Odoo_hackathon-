import { v4 as uuidv4 } from 'uuid';
import {
  NotificationContract,
  NotificationPayload,
  NotificationChannel,
} from '../contracts/notification.contract';
import { SSEManager } from './sse.manager';
import { WebhookDispatcher } from './webhook.dispatcher';

export class NotificationService implements NotificationContract {
  private static instance: NotificationService;
  private notifications: NotificationPayload[] = [];
  private sseManager: SSEManager;
  private webhookDispatcher: WebhookDispatcher;

  constructor(sseManager?: SSEManager, webhookDispatcher?: WebhookDispatcher) {
    this.sseManager = sseManager || SSEManager.getInstance();
    this.webhookDispatcher = webhookDispatcher || WebhookDispatcher.getInstance();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Dispatches a notification across specified channels (In-App, SSE real-time stream, Webhooks).
   */
  public async send(
    payload: NotificationPayload
  ): Promise<{ success: boolean; notificationId: string }> {
    const notificationId = payload.notificationId || uuidv4();
    const createdAt = payload.createdAt || new Date().toISOString();

    const fullNotification: NotificationPayload = {
      ...payload,
      notificationId,
      read: false,
      createdAt,
    };

    // 1. In-App persistence
    if (payload.channels.includes(NotificationChannel.IN_APP)) {
      this.notifications.unshift(fullNotification);
    }

    // 2. Real-time push via SSE to Member 3 Frontend
    if (payload.channels.includes(NotificationChannel.SSE_STREAM)) {
      this.sseManager.sendToUser(payload.recipientId, 'notification', fullNotification);
    }

    // 3. Webhook Dispatch if enabled
    if (payload.channels.includes(NotificationChannel.WEBHOOK)) {
      await this.webhookDispatcher.dispatchEvent(payload.type, {
        notificationId,
        recipientId: payload.recipientId,
        title: payload.title,
        message: payload.message,
        data: payload.data,
      });
    }

    return { success: true, notificationId };
  }

  /**
   * Broadcasts notification to all users of a specific role.
   */
  public async broadcast(
    role: string,
    payload: Omit<NotificationPayload, 'recipientId'>
  ): Promise<{ dispatchedCount: number }> {
    // Push via SSE to all matching role clients
    const sseSent = this.sseManager.broadcastToRole(role, 'broadcast_alert', payload);

    // Also trigger webhook for role alert
    await this.webhookDispatcher.dispatchEvent(`broadcast.${role.toLowerCase()}`, {
      role,
      title: payload.title,
      message: payload.message,
      data: payload.data,
    });

    return { dispatchedCount: sseSent };
  }

  /**
   * Queries in-app notifications for a specific user.
   */
  public async getUserNotifications(
    userId: string,
    unreadOnly = false,
    limit = 20
  ): Promise<NotificationPayload[]> {
    return this.notifications
      .filter((n) => n.recipientId === userId && (!unreadOnly || !n.read))
      .slice(0, limit);
  }

  /**
   * Marks a single notification as read.
   */
  public async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const notif = this.notifications.find(
      (n) => n.notificationId === notificationId && n.recipientId === userId
    );
    if (notif) {
      notif.read = true;
      return true;
    }
    return false;
  }

  /**
   * Marks all notifications as read for a given user.
   */
  public async markAllAsRead(userId: string): Promise<number> {
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
