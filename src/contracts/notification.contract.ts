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

export interface NotificationContract {
  send(payload: NotificationPayload): Promise<{ success: boolean; notificationId: string }>;
  broadcast(role: string, payload: Omit<NotificationPayload, 'recipientId'>): Promise<{ dispatchedCount: number }>;
  getUserNotifications(userId: string, unreadOnly?: boolean, limit?: number): Promise<NotificationPayload[]>;
  markAsRead(notificationId: string, userId: string): Promise<boolean>;
  markAllAsRead(userId: string): Promise<number>;
}
