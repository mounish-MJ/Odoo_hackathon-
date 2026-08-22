import { v4 as uuidv4 } from 'uuid';
import {
  NotificationContract,
  NotificationPayload,
  NotificationChannel,
  NotificationDispatchResult,
  NotificationDeliveryResult,
  INotificationProvider,
} from '../contracts/notification.contract';
import { InAppNotificationProvider } from './providers/in-app.provider';
import { SSENotificationProvider } from './providers/sse.provider';
import { WebhookNotificationProvider } from './providers/webhook.provider';
import { EmailNotificationProvider } from './providers/email.provider';
import { SSEManager } from './sse.manager';
import { WebhookDispatcher } from './webhook.dispatcher';
import { PiiSanitizer } from '../security/pii.sanitizer';
import { AuditService } from '../audit/audit.service';

export class NotificationService implements NotificationContract {
  private static instance: NotificationService;
  private providers: Map<NotificationChannel, INotificationProvider> = new Map();
  private inAppProvider: InAppNotificationProvider;
  private sseManager: SSEManager;
  private webhookDispatcher: WebhookDispatcher;
  private auditService: AuditService;

  constructor(
    sseManager?: SSEManager,
    webhookDispatcher?: WebhookDispatcher,
    auditService?: AuditService
  ) {
    this.sseManager = sseManager || SSEManager.getInstance();
    this.webhookDispatcher = webhookDispatcher || WebhookDispatcher.getInstance();
    this.auditService = auditService || AuditService.getInstance();

    this.inAppProvider = new InAppNotificationProvider();
    this.registerProvider(this.inAppProvider);
    this.registerProvider(new SSENotificationProvider(this.sseManager));
    this.registerProvider(new WebhookNotificationProvider(this.webhookDispatcher));
    this.registerProvider(new EmailNotificationProvider());
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  public registerProvider(provider: INotificationProvider): void {
    this.providers.set(provider.channel, provider);
  }

  /**
   * Dispatches a notification across specified channels with PII scrubbing and error isolation.
   */
  public async send(payload: NotificationPayload): Promise<NotificationDispatchResult> {
    const notificationId = payload.notificationId || `notif_${uuidv4().substring(0, 8)}`;
    const createdAt = payload.createdAt || new Date().toISOString();

    // 1. Scrub PII from payload data
    const sanitizedData = payload.data ? (PiiSanitizer.sanitize(payload.data) as Record<string, unknown>) : undefined;

    const fullNotification: NotificationPayload = {
      ...payload,
      notificationId,
      data: sanitizedData,
      read: false,
      createdAt,
    };

    const deliveryResults: Record<string, NotificationDeliveryResult> = {};
    let overallSuccess = true;
    let hasFailure = false;

    // 2. Dispatch in parallel across requested channels
    for (const channel of payload.channels) {
      const provider = this.providers.get(channel);
      if (!provider) {
        deliveryResults[channel] = {
          channel,
          success: false,
          error: `Provider for channel '${channel}' is not registered`,
          timestamp: new Date().toISOString(),
        };
        hasFailure = true;
        overallSuccess = false;
        continue;
      }

      try {
        const result = await provider.send(fullNotification);
        deliveryResults[channel] = result;
        if (!result.success) {
          hasFailure = true;
          overallSuccess = false;
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        deliveryResults[channel] = {
          channel,
          success: false,
          error: errorMsg,
          timestamp: new Date().toISOString(),
        };
        hasFailure = true;
        overallSuccess = false;
      }
    }

    // 3. Record audit event if any delivery channel experienced an issue
    if (hasFailure) {
      await this.auditService.recordAudit({
        userId: payload.recipientId,
        userRole: payload.recipientRole || 'SYSTEM',
        action: 'NOTIFICATION.DELIVERY_PARTIAL_FAILURE',
        resourceType: 'notification',
        resourceId: notificationId,
        oldData: { notificationId, channels: payload.channels },
        newData: { deliveryResults },
        status: 'FAILURE',
        failureReason: 'One or more notification channels failed delivery',
      });
    }

    return {
      success: overallSuccess,
      notificationId,
      deliveryResults,
      partialFailure: hasFailure,
    };
  }

  /**
   * Broadcasts notification to all users of a specific role.
   */
  public async broadcast(
    role: string,
    payload: Omit<NotificationPayload, 'recipientId'>
  ): Promise<{ dispatchedCount: number }> {
    const sseSent = this.sseManager.broadcastToRole(role, 'broadcast_alert', payload);

    await this.webhookDispatcher.dispatchEvent(`broadcast.${role.toLowerCase()}`, {
      role,
      title: payload.title,
      message: payload.message,
      data: payload.data ? PiiSanitizer.sanitize(payload.data) : undefined,
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
    return this.inAppProvider.getNotifications(userId, unreadOnly, limit);
  }

  /**
   * Marks a single notification as read.
   */
  public async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    return this.inAppProvider.markAsRead(notificationId, userId);
  }

  /**
   * Marks all notifications as read for a given user.
   */
  public async markAllAsRead(userId: string): Promise<number> {
    return this.inAppProvider.markAllAsRead(userId);
  }

  public clear(): void {
    this.inAppProvider.clear();
  }
}
