import { EventEmitter } from 'events';
import { EventContract, BaseEventSchema, EventType } from '../contracts/event.contract';
import { IdempotencyGuard } from '../security/idempotency.guard';

export type EventHandler<T = Record<string, unknown>> = (event: EventContract<T>) => Promise<void> | void;

export class PlatformEventBus {
  private static instance: PlatformEventBus;
  private emitter: EventEmitter;
  private eventHistory: EventContract<any>[] = [];

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50);
  }

  public static getInstance(): PlatformEventBus {
    if (!PlatformEventBus.instance) {
      PlatformEventBus.instance = new PlatformEventBus();
    }
    return PlatformEventBus.instance;
  }

  /**
   * Publishes an event after validating its schema and idempotency key.
   */
  public async publish<T extends Record<string, unknown> = Record<string, unknown>>(
    event: EventContract<T>
  ): Promise<{
    published: boolean;
    duplicate: boolean;
    error?: string;
  }> {
    // 1. Schema Validation
    const validation = BaseEventSchema.safeParse(event);
    if (!validation.success) {
      return {
        published: false,
        duplicate: false,
        error: `Event validation failed: ${validation.error.message}`,
      };
    }

    // 2. Idempotency Check
    if (event.idempotencyKey) {
      const cached = IdempotencyGuard.check(event.idempotencyKey);
      if (cached) {
        return { published: false, duplicate: true };
      }

      const acquired = IdempotencyGuard.acquire(event.idempotencyKey);
      if (!acquired) {
        return { published: false, duplicate: true };
      }
    }

    // Store in historical event ledger
    this.eventHistory.unshift(event);

    // 3. Dispatch to all registered listeners asynchronously with error isolation
    setImmediate(async () => {
      try {
        this.emitter.emit(event.eventType, event);
        this.emitter.emit('*', event); // Wildcard listener
      } catch (err: unknown) {
        console.error(`[EventBus] Unhandled error during event emission for ${event.eventType}:`, err);
      }
    });

    return { published: true, duplicate: false };
  }

  /**
   * Subscribes to a specific event type.
   */
  public subscribe<T = Record<string, unknown>>(
    eventType: EventType | string,
    handler: EventHandler<T>
  ): () => void {
    const wrappedHandler = async (event: EventContract<T>) => {
      try {
        await handler(event);
      } catch (err: unknown) {
        console.error(`[EventBus] Error in subscriber for ${eventType}:`, err);
      }
    };

    this.emitter.on(eventType, wrappedHandler);
    return () => {
      this.emitter.off(eventType, wrappedHandler);
    };
  }

  /**
   * Returns recent event history.
   */
  public getHistory(limit = 50): EventContract<any>[] {
    return this.eventHistory.slice(0, limit);
  }

  public getListenerCount(): number {
    return this.emitter.eventNames().length;
  }

  public clear(): void {
    this.emitter.removeAllListeners();
    this.eventHistory = [];
  }
}
