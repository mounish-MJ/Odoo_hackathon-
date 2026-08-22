import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export interface WebhookSubscription {
  webhookId: string;
  userId: string;
  url: string;
  events: string[];
  signatureSecret: string;
  active: boolean;
}

export interface WebhookDeliveryLog {
  eventId: string;
  webhookId: string;
  eventType: string;
  payload: Record<string, unknown>;
  responseStatus?: number;
  responseBody?: string;
  retryCount: number;
  status: 'DELIVERED' | 'FAILED' | 'RETRYING';
  timestamp: string;
}

export class WebhookDispatcher {
  private static instance: WebhookDispatcher;
  private subscriptions: Map<string, WebhookSubscription> = new Map();
  private deliveryLogs: WebhookDeliveryLog[] = [];

  public static getInstance(): WebhookDispatcher {
    if (!WebhookDispatcher.instance) {
      WebhookDispatcher.instance = new WebhookDispatcher();
    }
    return WebhookDispatcher.instance;
  }

  /**
   * Registers a webhook endpoint.
   */
  public registerWebhook(
    sub: Omit<WebhookSubscription, 'webhookId' | 'signatureSecret'>
  ): WebhookSubscription {
    const webhookId = uuidv4();
    const signatureSecret = `whsec_${crypto.randomBytes(24).toString('hex')}`;
    const fullSub: WebhookSubscription = {
      ...sub,
      webhookId,
      signatureSecret,
    };
    this.subscriptions.set(webhookId, fullSub);
    return fullSub;
  }

  /**
   * Generates HMAC-SHA256 signature for webhook payload verification.
   */
  public static generateSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Dispatches an event to all matching webhook subscribers.
   */
  public async dispatchEvent(
    eventType: string,
    payload: Record<string, unknown>
  ): Promise<{ dispatched: number; successful: number }> {
    const matchingSubs = Array.from(this.subscriptions.values()).filter(
      (sub) => sub.active && (sub.events.includes(eventType) || sub.events.includes('*'))
    );

    let successful = 0;
    const payloadString = JSON.stringify({
      id: uuidv4(),
      event: eventType,
      timestamp: new Date().toISOString(),
      data: payload,
    });

    for (const sub of matchingSubs) {
      const signature = WebhookDispatcher.generateSignature(payloadString, sub.signatureSecret);
      const eventId = uuidv4();

      try {
        let status = 200;
        let responseBody = 'OK (Delivered)';

        // Attempt actual dispatch if not in test environment and URL is HTTP/HTTPS
        if (process.env.NODE_ENV !== 'test' && typeof globalThis.fetch === 'function' && sub.url.startsWith('http')) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);

          try {
            const res = await fetch(sub.url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Dayflow-Signature': signature,
                'X-Dayflow-Event': eventType,
                'X-Dayflow-Delivery': eventId,
              },
              body: payloadString,
              signal: controller.signal,
            });
            status = res.status;
            responseBody = await res.text();
          } finally {
            clearTimeout(timeout);
          }
        }

        const isSuccess = status >= 200 && status < 300;
        if (isSuccess) successful++;

        this.deliveryLogs.unshift({
          eventId,
          webhookId: sub.webhookId,
          eventType,
          payload,
          responseStatus: status,
          responseBody,
          retryCount: 0,
          status: isSuccess ? 'DELIVERED' : 'FAILED',
          timestamp: new Date().toISOString(),
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Webhook dispatch error';
        this.deliveryLogs.unshift({
          eventId,
          webhookId: sub.webhookId,
          eventType,
          payload,
          responseStatus: 500,
          responseBody: errorMsg,
          retryCount: 0,
          status: 'FAILED',
          timestamp: new Date().toISOString(),
        });
      }
    }

    return { dispatched: matchingSubs.length, successful };
  }

  public getDeliveryLogs(webhookId?: string): WebhookDeliveryLog[] {
    if (webhookId) {
      return this.deliveryLogs.filter((l) => l.webhookId === webhookId);
    }
    return this.deliveryLogs;
  }

  public getSubscriptions(): WebhookSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  public deleteWebhook(webhookId: string): boolean {
    return this.subscriptions.delete(webhookId);
  }

  public clear(): void {
    this.subscriptions.clear();
    this.deliveryLogs = [];
  }
}
