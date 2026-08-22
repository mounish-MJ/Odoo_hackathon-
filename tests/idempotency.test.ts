import { IdempotencyGuard } from '../src/security/idempotency.guard';

describe('Member 4 Security Layer — Idempotency & Replay Protection Tests', () => {
  beforeEach(() => {
    IdempotencyGuard.clear();
  });

  test('1. First attempt acquires lock, second concurrent attempt is blocked', () => {
    const key = 'idemp_key_unique_1';

    const firstAcquire = IdempotencyGuard.acquire(key);
    expect(firstAcquire).toBe(true);

    const secondAcquire = IdempotencyGuard.acquire(key);
    expect(secondAcquire).toBe(false); // Locked
  });

  test('2. Saves completed result and returns cached response on replay', () => {
    const key = 'idemp_key_unique_2';

    IdempotencyGuard.acquire(key);
    IdempotencyGuard.save(key, 200, { success: true, transactionId: 'tx_999' });

    const cached = IdempotencyGuard.check(key);
    expect(cached).toBeDefined();
    expect(cached?.statusCode).toBe(200);
    expect((cached?.body as any).transactionId).toBe('tx_999');
  });
});
