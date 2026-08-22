import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface RequestWithId extends Request {
  id?: string;
  correlationId?: string;
}

/**
 * Middleware that extracts or assigns a unique Request / Correlation ID.
 * Sets the 'X-Request-Id' and 'X-Correlation-Id' response headers.
 */
export function requestIdMiddleware(req: RequestWithId, res: Response, next: NextFunction): void {
  const incomingId = (req.headers['x-request-id'] || req.headers['x-correlation-id']) as string;
  const requestId = incomingId || `req_${uuidv4().substring(0, 12)}`;

  req.id = requestId;
  req.correlationId = requestId;

  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Correlation-Id', requestId);

  next();
}
