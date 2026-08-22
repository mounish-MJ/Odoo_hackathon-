export interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  backoffFactor: number;
  shouldRetry?: (error: unknown) => boolean;
}

export class RetryManager {
  /**
   * Executes an asynchronous task with exponential backoff retries.
   */
  public static async executeWithRetry<T>(
    task: (attempt: number) => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<{ result: T; attempts: number }> {
    const maxRetries = options.maxRetries ?? 3;
    const initialDelayMs = options.initialDelayMs ?? 100;
    const backoffFactor = options.backoffFactor ?? 2;
    const shouldRetry = options.shouldRetry ?? (() => true);

    let lastError: unknown;
    let delay = initialDelayMs;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const result = await task(attempt);
        return { result, attempts: attempt };
      } catch (err: unknown) {
        lastError = err;

        if (attempt > maxRetries || !shouldRetry(err)) {
          break;
        }

        // Wait with exponential backoff
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= backoffFactor;
      }
    }

    throw lastError;
  }
}
