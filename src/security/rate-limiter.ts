import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private static store = new Map<string, RateLimitRecord>();

  /**
   * Sliding window rate limiter middleware.
   * Default: 100 requests per 60 seconds per IP or User ID.
   */
  public static createLimiter(maxRequests = 100, windowMs = 60000) {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Key by user ID (if authenticated) or IP address
      const authUser = (req as { user?: { userId: string } }).user;
      const key = authUser ? `user:${authUser.userId}` : `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;

      const now = Date.now();
      let record = RateLimiter.store.get(key);

      if (!record || now > record.resetTime) {
        record = { count: 1, resetTime: now + windowMs };
        RateLimiter.store.set(key, record);
      } else {
        record.count++;
      }

      const remaining = Math.max(0, maxRequests - record.count);
      const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', resetSeconds.toString());

      if (record.count > maxRequests) {
        res.setHeader('Retry-After', resetSeconds.toString());
        res.status(429).json({
          success: false,
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: `Rate limit exceeded. Try again in ${resetSeconds} seconds.`,
          },
        });
        return;
      }

      next();
    };
  }

  public static clear(): void {
    RateLimiter.store.clear();
  }
}
