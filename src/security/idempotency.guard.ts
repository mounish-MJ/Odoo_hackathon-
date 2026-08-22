import { Request, Response, NextFunction } from 'express';

interface CachedResponse {
  statusCode: number;
  body: unknown;
  timestamp: number;
}

export class IdempotencyGuard {
  private static cache = new Map<string, CachedResponse>();
  private static inFlightKeys = new Set<string>();
  private static defaultTTLMs = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Checks if an idempotency key exists and returns cached response if completed.
   */
  public static check(key: string): CachedResponse | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check expiry
    if (Date.now() - entry.timestamp > this.defaultTTLMs) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  /**
   * Records completed result for an idempotency key.
   */
  public static save(key: string, statusCode: number, body: unknown): void {
    this.inFlightKeys.delete(key);
    this.cache.set(key, {
      statusCode,
      body,
      timestamp: Date.now(),
    });
  }

  /**
   * Marks a key as in-flight to prevent race conditions.
   */
  public static acquire(key: string): boolean {
    if (this.inFlightKeys.has(key)) {
      return false; // Already being processed
    }
    this.inFlightKeys.add(key);
    return true;
  }

  /**
   * Releases in-flight status on failure.
   */
  public static release(key: string): void {
    this.inFlightKeys.delete(key);
  }

  /**
   * Clears all cache (useful for testing).
   */
  public static clear(): void {
    this.cache.clear();
    this.inFlightKeys.clear();
  }

  /**
   * Express middleware for HTTP endpoints with X-Idempotency-Key header.
   */
  public static middleware(req: Request, res: Response, next: NextFunction): void {
    const key = req.headers['x-idempotency-key'] as string;
    if (!key) {
      next();
      return;
    }

    const cached = IdempotencyGuard.check(key);
    if (cached) {
      res.setHeader('X-Cache-Lookup', 'HIT');
      res.status(cached.statusCode).json(cached.body);
      return;
    }

    const acquired = IdempotencyGuard.acquire(key);
    if (!acquired) {
      res.status(409).json({
        success: false,
        error: {
          code: 'CONCURRENT_REQUEST',
          message: 'A request with this idempotency key is already being processed',
        },
      });
      return;
    }

    // Intercept response to cache it
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      IdempotencyGuard.save(key, res.statusCode, body);
      return originalJson(body);
    };

    next();
  }
}
