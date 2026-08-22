import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { Role, ResourceAction } from '../contracts/authorization.contract';
import { SecurityErrorHandler } from './error-handler';
import { PIILogger } from './pii.logger';

export interface ResourceAccessContext {
  requesterId: string;
  requesterRole: Role;
  resourceType: 'leave' | 'attendance' | 'payroll' | 'employee' | 'document' | 'audit' | 'workflow';
  resourceId?: string;
  resourceOwnerId?: string;
  action: ResourceAction;
}

export class RbacSecurityGuard {
  /**
   * Middleware requiring user to hold at least one of the specified roles.
   */
  public static requireRoles(...roles: Role[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        SecurityErrorHandler.sendUnauthorized(res, 'Authentication required');
        return;
      }

      if (!roles.includes(req.user.role)) {
        PIILogger.warn('RBAC role check failed', {
          userId: req.user.userId,
          userRole: req.user.role,
          requiredRoles: roles,
          path: req.path,
        });

        SecurityErrorHandler.sendForbidden(
          res,
          `Forbidden: Role '${req.user.role}' is not authorized to access this resource`
        );
        return;
      }

      next();
    };
  }

  /**
   * Middleware enforcing Resource-Level Authorization (Ownership or Admin/HR privilege).
   * Ensures Employee A cannot access Employee B's private resources.
   */
  public static enforceResourceAuthorization(
    resourceType: ResourceAccessContext['resourceType'],
    action: ResourceAction,
    resolveOwnerId: (req: AuthenticatedRequest) => string | undefined,
    resolveResourceId?: (req: AuthenticatedRequest) => string | undefined
  ) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        SecurityErrorHandler.sendUnauthorized(res, 'Authentication required');
        return;
      }

      const resourceOwnerId = resolveOwnerId(req);
      const resourceId = resolveResourceId ? resolveResourceId(req) : req.params.id || 'N/A';

      const accessContext: ResourceAccessContext = {
        requesterId: req.user.userId,
        requesterRole: req.user.role,
        resourceType,
        resourceId,
        resourceOwnerId,
        action,
      };

      const isAuthorized = RbacSecurityGuard.evaluateResourceAccess(accessContext);

      if (!isAuthorized) {
        PIILogger.warn('Resource ownership violation blocked', {
          requesterId: req.user.userId,
          requesterRole: req.user.role,
          resourceType,
          resourceId,
          resourceOwnerId,
          action,
        });

        SecurityErrorHandler.sendForbidden(
          res,
          `Access Denied: You do not have permission to ${action} this ${resourceType} resource`
        );
        return;
      }

      next();
    };
  }

  /**
   * Core deterministic rule evaluation answering the 4 security questions:
   * 1. Who is the requester (identity + role)?
   * 2. What resource are they touching?
   * 3. Do they own it or have an administrative role?
   * 4. What operation are they attempting?
   */
  public static evaluateResourceAccess(ctx: ResourceAccessContext): boolean {
    // 1. ADMIN has complete system-wide authorization
    if (ctx.requesterRole === Role.ADMIN) {
      return true;
    }

    // 2. HR role has broad access across employee HR records (leave, attendance, payroll, documents)
    if (ctx.requesterRole === Role.HR) {
      return true;
    }

    // 3. MANAGER role can read team resources and approve/reject leave/attendance
    if (ctx.requesterRole === Role.MANAGER) {
      if (ctx.action === 'read' || ctx.action === 'approve' || ctx.action === 'reject') {
        return ['leave', 'attendance', 'workflow', 'employee'].includes(ctx.resourceType);
      }
      // Managers can manage their own personal records as well
      if (ctx.resourceOwnerId && ctx.resourceOwnerId === ctx.requesterId) {
        return true;
      }
      return false;
    }

    // 4. EMPLOYEE role — Strictly restricted to own resources and specific domain operations
    if (ctx.requesterRole === Role.EMPLOYEE) {
      // Creation: Employees can only create their own leave requests or attendance logs
      if (ctx.action === 'create') {
        const allowedTypes = ['leave', 'attendance'];
        if (allowedTypes.includes(ctx.resourceType)) {
          if (!ctx.resourceOwnerId || ctx.resourceOwnerId === ctx.requesterId) {
            return true;
          }
        }
        return false;
      }

      // Reading or updating existing resources requires ownership
      if (ctx.action === 'read' || ctx.action === 'update') {
        if (ctx.resourceOwnerId && ctx.resourceOwnerId === ctx.requesterId) {
          return true;
        }
        return false;
      }

      // Employees cannot approve, reject, or delete records
      return false;
    }

    return false;
  }

  /**
   * Helper method for service-level checks.
   */
  public static canExecuteAction(
    user: { role: Role; userId: string },
    permission: { resourceType: ResourceAccessContext['resourceType']; action: ResourceAction; resourceOwnerId?: string }
  ): boolean {
    return RbacSecurityGuard.evaluateResourceAccess({
      requesterId: user.userId,
      requesterRole: user.role,
      resourceType: permission.resourceType,
      resourceOwnerId: permission.resourceOwnerId,
      action: permission.action,
    });
  }
}
