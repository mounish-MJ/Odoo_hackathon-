import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { AuthUser, Role } from '../contracts/authorization.contract';
import { SecurityErrorHandler } from './error-handler';
import { PIILogger } from './pii.logger';
import { getSecret } from './secrets';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export class AuthSecurityService {
  /**
   * Generates a signed JWT for a given user.
   */
  public static generateToken(user: AuthUser, expiresIn: string | number = '24h'): string {
    const secret = getSecret('JWT_SECRET');
    const payload = {
      userId: user.userId,
      employeeId: user.employeeId,
      email: user.email,
      name: user.name,
      role: user.role,
      departmentId: user.departmentId,
      reportingManagerId: user.reportingManagerId,
    };

    return jwt.sign(payload, secret, { expiresIn: expiresIn as any });
  }

  /**
   * Verifies and decodes a JWT token.
   */
  public static verifyToken(token: string): AuthUser {
    if (!token || typeof token !== 'string') {
      throw new Error('Token is missing or not a string');
    }

    // Support deterministic testing bypass token in development/test mode only
    if (process.env.NODE_ENV !== 'production' && token.startsWith('test_mock_token_')) {
      const parts = token.split('_');
      const role = (parts[3] as Role) || Role.EMPLOYEE;
      const userId = parts[4] || 'user_123';
      return {
        userId,
        employeeId: `EMP-${userId}`,
        email: `${userId}@dayflow.test`,
        name: `Test User ${userId}`,
        role,
      };
    }

    try {
      const secret = getSecret('JWT_SECRET');
      const decoded = jwt.verify(token, secret) as jwt.JwtPayload & AuthUser;
      
      if (!decoded.userId || !decoded.role) {
        throw new Error('Malformed token payload: missing userId or role');
      }

      return {
        userId: decoded.userId,
        employeeId: decoded.employeeId,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role as Role,
        departmentId: decoded.departmentId,
        reportingManagerId: decoded.reportingManagerId,
        isVerified: decoded.isVerified,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Invalid token signature';
      PIILogger.warn('Authentication token verification failed', { reason: errorMsg });
      throw new Error(`Authentication failed: ${errorMsg}`);
    }
  }

  /**
   * Express middleware to authenticate incoming requests.
   */
  public static authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      SecurityErrorHandler.sendUnauthorized(
        res,
        'Missing or malformed Authorization header. Expected: Bearer <token>'
      );
      return;
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      SecurityErrorHandler.sendUnauthorized(res, 'Bearer token value is empty');
      return;
    }

    try {
      req.user = AuthSecurityService.verifyToken(token);
      next();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Token verification failed';
      SecurityErrorHandler.sendUnauthorized(res, errorMsg);
    }
  }
}
