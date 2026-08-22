import { PiiSanitizer } from './pii.sanitizer';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export class PIILogger {
  private static logLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'INFO';
  private static suppressedInTest = process.env.NODE_ENV === 'test';

  public static info(message: string, context?: Record<string, unknown>): void {
    PIILogger.log('INFO', message, context);
  }

  public static warn(message: string, context?: Record<string, unknown>): void {
    PIILogger.log('WARN', message, context);
  }

  public static error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    const errorDetails =
      error instanceof Error
        ? { message: error.message, name: error.name }
        : typeof error === 'string'
        ? { message: error }
        : undefined;

    PIILogger.log('ERROR', message, { ...context, error: errorDetails });
  }

  public static debug(message: string, context?: Record<string, unknown>): void {
    if (PIILogger.logLevel === 'DEBUG') {
      PIILogger.log('DEBUG', message, context);
    }
  }

  private static log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (PIILogger.suppressedInTest && level !== 'ERROR') {
      return;
    }

    const timestamp = new Date().toISOString();
    const sanitizedContext = context ? PiiSanitizer.sanitize(context) : undefined;

    const logEntry = {
      timestamp,
      level,
      message,
      ...(sanitizedContext ? { context: sanitizedContext } : {}),
    };

    const output = JSON.stringify(logEntry);
    if (level === 'ERROR') {
      console.error(output);
    } else if (level === 'WARN') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }
}
