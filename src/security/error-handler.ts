import { Response } from 'express';
import { PIILogger } from './pii.logger';

export interface SecurityErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field?: string; issue: string }>;
  };
}

export class SecurityErrorHandler {
  /**
   * Returns 401 Unauthorized with safe, sanitized message.
   */
  public static sendUnauthorized(res: Response, message = 'Authentication required'): void {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: SecurityErrorHandler.sanitizeMessage(message),
      },
    });
  }

  /**
   * Returns 403 Forbidden with safe message.
   */
  public static sendForbidden(res: Response, message = 'Access denied'): void {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: SecurityErrorHandler.sanitizeMessage(message),
      },
    });
  }

  /**
   * Returns 404 Not Found with safe message.
   */
  public static sendNotFound(res: Response, message = 'Resource not found'): void {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: SecurityErrorHandler.sanitizeMessage(message),
      },
    });
  }

  /**
   * Returns 400 Bad Request with field-level validation issues.
   */
  public static sendValidationError(
    res: Response,
    message: string,
    details?: Array<{ field?: string; issue: string }>
  ): void {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: SecurityErrorHandler.sanitizeMessage(message),
        details,
      },
    });
  }

  /**
   * Returns 500 Internal Server Error without leaking internal stack traces.
   */
  public static sendInternalError(res: Response, err: unknown): void {
    const errorMsg = err instanceof Error ? err.message : String(err);
    PIILogger.error('Internal server exception occurred', err);

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected internal error occurred. Please try again later.',
      },
    });
  }

  private static sanitizeMessage(msg: string): string {
    // Strip file paths, memory addresses, or raw SQL if accidentally included
    return msg
      .replace(/([C-Z]:\\[^\s]+|\/[a-zA-Z0-9_\-\.\/]+)/g, '[REDACTED_PATH]')
      .replace(/SELECT\s.+FROM\s/gi, '[REDACTED_QUERY]')
      .trim();
  }
}
