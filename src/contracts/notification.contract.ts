export enum NotificationChannel {
  IN_APP = 'IN_APP',
  SSE_STREAM = 'SSE_STREAM',
  WEBHOOK = 'WEBHOOK',
  EMAIL = 'EMAIL',
}

export enum NotificationType {
  LEAVE_STATUS = 'LEAVE_STATUS',
  ATTENDANCE_ALERT = 'ATTENDANCE_ALERT',
  PAYROLL_UPDATE = 'PAYROLL_UPDATE',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
  APPROVAL_REQUEST = 'APPROVAL_REQUEST',
  ANOMALY_ALERT = 'ANOMALY_ALERT',
  WORKFLOW_STATUS = 'WORKFLOW_STATUS',
}

export interface NotificationPayload {
  notificationId?: string;
  recipientId: string;
  recipientRole?: string;
  type: NotificationType | string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  channels: NotificationChannel[];
  read?: boolean;
  createdAt?: string;
}

export interface NotificationDeliveryResult {
  channel: NotificationChannel;
  success: boolean;
  error?: string;
  timestamp: string;
}

export interface NotificationDispatchResult {
  success: boolean;
  notificationId: string;
  deliveryResults: Record<string, NotificationDeliveryResult>;
  partialFailure?: boolean;
}

export interface INotificationProvider {
  channel: NotificationChannel;
  send(notification: NotificationPayload): Promise<NotificationDeliveryResult>;
}

export interface NotificationContract {
  send(payload: NotificationPayload): Promise<NotificationDispatchResult>;
  broadcast(role: string, payload: Omit<NotificationPayload, 'recipientId'>): Promise<{ dispatchedCount: number }>;
  getUserNotifications(userId: string, unreadOnly?: boolean, limit?: number): Promise<NotificationPayload[]>;
  markAsRead(notificationId: string, userId: string): Promise<boolean>;
  markAllAsRead(userId: string): Promise<number>;
  registerProvider(provider: INotificationProvider): void;
}
