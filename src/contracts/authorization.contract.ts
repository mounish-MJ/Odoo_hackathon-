export enum Role {
  EMPLOYEE = 'EMPLOYEE',
  MANAGER = 'MANAGER',
  HR = 'HR',
  ADMIN = 'ADMIN',
}

export interface AuthUser {
  userId: string;
  employeeId?: string;
  email: string;
  name: string;
  role: Role;
  departmentId?: string;
  reportingManagerId?: string;
  isVerified?: boolean;
}

export type ResourceAction = 'create' | 'read' | 'update' | 'delete' | 'approve' | 'reject' | 'export';

export interface ResourcePermission {
  resourceType: 'leave' | 'attendance' | 'payroll' | 'employee' | 'document' | 'audit' | 'workflow';
  action: ResourceAction;
  resourceOwnerId?: string;
}

export interface AuthorizationContract {
  checkPermission(user: AuthUser, permission: ResourcePermission): boolean;
  canAccessResource(user: AuthUser, resourceOwnerId?: string): boolean;
  hasRole(user: AuthUser, requiredRoles: Role[]): boolean;
}
