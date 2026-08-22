import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { SecurityErrorHandler } from './error-handler';

export class InputValidator {
  /**
   * Express middleware generator that validates `req.body` against a Zod schema.
   */
  public static validateBody(schema: ZodSchema) {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        req.body = schema.parse(req.body);
        next();
      } catch (err: unknown) {
        if (err instanceof ZodError) {
          const details = err.errors.map((e) => ({
            field: e.path.join('.'),
            issue: e.message,
          }));
          SecurityErrorHandler.sendValidationError(
            res,
            'Request payload failed validation checks',
            details
          );
          return;
        }

        SecurityErrorHandler.sendValidationError(res, 'Malformed JSON body');
      }
    };
  }

  /**
   * Express middleware generator that validates `req.query` against a Zod schema.
   */
  public static validateQuery(schema: ZodSchema) {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        req.query = schema.parse(req.query) as any;
        next();
      } catch (err: unknown) {
        if (err instanceof ZodError) {
          const details = err.errors.map((e) => ({
            field: e.path.join('.'),
            issue: e.message,
          }));
          SecurityErrorHandler.sendValidationError(
            res,
            'Query parameters failed validation checks',
            details
          );
          return;
        }

        SecurityErrorHandler.sendValidationError(res, 'Invalid query parameters');
      }
    };
  }
}

// -------------------------------------------------------------
// Common Schemas for Orchestration Endpoints
// -------------------------------------------------------------

export const ApplyLeaveInputSchema = z.object({
  leaveTypeId: z.string().min(1, 'leaveTypeId is required'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be in YYYY-MM-DD format'),
  days: z.number().positive('days must be a positive number').max(365, 'days cannot exceed 365'),
  reason: z.string().max(500, 'reason cannot exceed 500 characters').optional(),
});

export const PublishEventInputSchema = z.object({
  eventType: z.string().min(1, 'eventType is required'),
  payload: z.record(z.unknown()),
  idempotencyKey: z.string().optional(),
});

export const ApprovalDecisionInputSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED'], {
    errorMap: () => ({ message: "decision must be either 'APPROVED' or 'REJECTED'" }),
  }),
  comments: z.string().max(500, 'comments cannot exceed 500 characters').optional(),
});

export const WebhookRegisterInputSchema = z.object({
  url: z.string().url('url must be a valid HTTP/HTTPS URL'),
  events: z.array(z.string().min(1)).min(1, 'At least one event must be subscribed'),
});
