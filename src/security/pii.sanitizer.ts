import { SENSITIVE_PII_FIELDS } from '../contracts/audit.contract';
import { containsSecret } from './secrets';

export class PiiSanitizer {
  private static sensitiveKeySet = new Set<string>([
    ...SENSITIVE_PII_FIELDS.map((k) => k.toLowerCase()),
    'secretkey',
    'secret_key',
    'jwt_secret',
    'apikey',
    'api_key',
    'privatekey',
    'private_key',
  ]);

  /**
   * Deeply clones and scrubs sensitive PII values from an object, replacing them with '[REDACTED]'.
   */
  public static sanitize<T>(obj: T): T {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      if (containsSecret(obj)) {
        return '[REDACTED]' as unknown as T;
      }
      return obj;
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => PiiSanitizer.sanitize(item)) as unknown as T;
    }

    const sanitizedObj: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();

      if (
        PiiSanitizer.sensitiveKeySet.has(lowerKey) ||
        lowerKey.includes('secret') ||
        lowerKey.includes('password') ||
        lowerKey.includes('token')
      ) {
        sanitizedObj[key] = '[REDACTED]';
      } else if (typeof value === 'string' && containsSecret(value)) {
        sanitizedObj[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitizedObj[key] = PiiSanitizer.sanitize(value);
      } else {
        sanitizedObj[key] = value;
      }
    }

    return sanitizedObj as T;
  }

  /**
   * Computes a shallow/deep diff between old state and new state with PII masking applied.
   */
  public static computeDiff(
    oldData?: Record<string, unknown> | null,
    newData?: Record<string, unknown> | null
  ): Record<string, { from: unknown; to: unknown }> | undefined {
    if (!oldData && !newData) return undefined;

    const safeOld = PiiSanitizer.sanitize(oldData || {});
    const safeNew = PiiSanitizer.sanitize(newData || {});

    const diff: Record<string, { from: unknown; to: unknown }> = {};
    const allKeys = new Set([...Object.keys(safeOld), ...Object.keys(safeNew)]);

    for (const key of allKeys) {
      const oldVal = safeOld[key];
      const newVal = safeNew[key];

      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        diff[key] = { from: oldVal, to: newVal };
      }
    }

    return Object.keys(diff).length > 0 ? diff : undefined;
  }
}
