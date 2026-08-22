import { PiiSanitizer } from '../security/pii.sanitizer';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface StructuredLogPayload {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: string;
  correlationId?: string;
  context?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

export class StructuredLogger {
  private static serviceName = 'dayflow-orchestration-platform';

  public static info(message: string, context?: Record<string, unknown>, correlationId?: string): void {
    StructuredLogger.log(LogLevel.INFO, message, context, undefined, correlationId);
  }

  public static warn(message: string, context?: Record<string, unknown>, correlationId?: string): void {
    StructuredLogger.log(LogLevel.WARN, message, context, undefined, correlationId);
  }

  public static error(message: string, error?: unknown, context?: Record<string, unknown>, correlationId?: string): void {
    const errorDetails = error instanceof Error
      ? { message: error.message, stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined }
      : error ? { message: String(error) } : undefined;

    StructuredLogger.log(LogLevel.ERROR, message, context, errorDetails, correlationId);
  }

  public static debug(message: string, context?: Record<string, unknown>, correlationId?: string): void {
    if (process.env.NODE_ENV !== 'production' && process.env.DEBUG !== 'false') {
      StructuredLogger.log(LogLevel.DEBUG, message, context, undefined, correlationId);
    }
  }

  private static log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: { message: string; stack?: string },
    correlationId?: string
  ): void {
    const sanitizedContext = context ? PiiSanitizer.sanitize(context) : undefined;
    const sanitizedMessage = PiiSanitizer.sanitize(message);

    const payload: StructuredLogPayload = {
      level,
      message: sanitizedMessage,
      timestamp: new Date().toISOString(),
      service: StructuredLogger.serviceName,
      correlationId,
      context: sanitizedContext as Record<string, unknown> | undefined,
      error,
    };

    const formattedLog = JSON.stringify(payload);

    if (level === LogLevel.ERROR) {
      console.error(formattedLog);
    } else if (level === LogLevel.WARN) {
      console.warn(formattedLog);
    } else {
      console.log(formattedLog);
    }
  }
}
