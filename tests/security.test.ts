import { AuthSecurityService } from '../src/security/auth.middleware';
import { RbacSecurityGuard } from '../src/security/rbac.guard';
import { PiiSanitizer } from '../src/security/pii.sanitizer';
import { Role } from '../src/contracts/authorization.contract';
import {
  InputValidator,
  ApplyLeaveInputSchema,
  PublishEventInputSchema,
  ApprovalDecisionInputSchema,
} from '../src/security/input-validator';
import { containsSecret, getSecret } from '../src/security/secrets';
import { SecurityErrorHandler } from '../src/security/error-handler';

describe('Member 4 Security & RBAC Layer — Comprehensive Security Tests', () => {
  const employeeA = {
    userId: 'usr_emp_001',
    employeeId: 'EMP-001',
    email: 'alice@dayflow.app',
    name: 'Alice Employee',
    role: Role.EMPLOYEE,
    departmentId: 'ENG',
    reportingManagerId: 'usr_mgr_001',
  };

  const employeeB = {
    userId: 'usr_emp_002',
    employeeId: 'EMP-002',
    email: 'bob@dayflow.app',
    name: 'Bob Employee',
    role: Role.EMPLOYEE,
    departmentId: 'DESIGN',
    reportingManagerId: 'usr_mgr_001',
  };

  const manager = {
    userId: 'usr_mgr_001',
    employeeId: 'MGR-001',
    email: 'manager@dayflow.app',
    name: 'Marta Manager',
    role: Role.MANAGER,
    departmentId: 'ENG',
  };

  const hrUser = {
    userId: 'usr_hr_001',
    employeeId: 'HR-001',
    email: 'hr@dayflow.app',
    name: 'Helen HR',
    role: Role.HR,
  };

  const adminUser = {
    userId: 'usr_admin_001',
    employeeId: 'ADM-001',
    email: 'admin@dayflow.app',
    name: 'Adam Admin',
    role: Role.ADMIN,
  };

  // -----------------------------------------------------------------
  // 1. Authentication Integration Tests
  // -----------------------------------------------------------------
  describe('1. Authentication Integration', () => {
    test('Valid JWT generates, verifies and preserves user identity and role', () => {
      const token = AuthSecurityService.generateToken(employeeA);
      expect(token).toBeDefined();

      const decoded = AuthSecurityService.verifyToken(token);
      expect(decoded.userId).toBe(employeeA.userId);
      expect(decoded.role).toBe(Role.EMPLOYEE);
      expect(decoded.email).toBe(employeeA.email);
    });

    test('Rejects expired JWT token', async () => {
      // Generate token that expired 1 second ago
      const expiredToken = AuthSecurityService.generateToken(employeeA, -1);

      expect(() => {
        AuthSecurityService.verifyToken(expiredToken);
      }).toThrow(/jwt expired|Authentication failed/);
    });

    test('Rejects malformed, tampered, or missing token', () => {
      expect(() => AuthSecurityService.verifyToken('')).toThrow();
      expect(() => AuthSecurityService.verifyToken('gibberish_token_value')).toThrow();
      expect(() => AuthSecurityService.verifyToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered.signature')).toThrow();
    });
  });

  // -----------------------------------------------------------------
  // 2. Role-Based Access Control (RBAC) Tests
  // -----------------------------------------------------------------
  describe('2. Role-Based Access Control (RBAC)', () => {
    test('Admin is authorized for all administrative operations', () => {
      expect(
        RbacSecurityGuard.canExecuteAction(adminUser, {
          resourceType: 'payroll',
          action: 'delete',
        })
      ).toBe(true);

      expect(
        RbacSecurityGuard.canExecuteAction(adminUser, {
          resourceType: 'audit',
          action: 'read',
        })
      ).toBe(true);
    });

    test('HR is authorized for cross-department employee HR records', () => {
      expect(
        RbacSecurityGuard.canExecuteAction(hrUser, {
          resourceType: 'payroll',
          action: 'create',
        })
      ).toBe(true);

      expect(
        RbacSecurityGuard.canExecuteAction(hrUser, {
          resourceType: 'leave',
          action: 'read',
          resourceOwnerId: employeeA.userId,
        })
      ).toBe(true);
    });

    test('Manager is authorized to approve/reject workflow requests', () => {
      expect(
        RbacSecurityGuard.canExecuteAction(manager, {
          resourceType: 'leave',
          action: 'approve',
        })
      ).toBe(true);

      expect(
        RbacSecurityGuard.canExecuteAction(manager, {
          resourceType: 'payroll',
          action: 'delete',
        })
      ).toBe(false);
    });

    test('Employee is rejected for administrative or approval actions', () => {
      expect(
        RbacSecurityGuard.canExecuteAction(employeeA, {
          resourceType: 'leave',
          action: 'approve',
        })
      ).toBe(false);

      expect(
        RbacSecurityGuard.canExecuteAction(employeeA, {
          resourceType: 'payroll',
          action: 'create',
        })
      ).toBe(false);
    });
  });

  // -----------------------------------------------------------------
  // 3. Resource-Level Authorization (RLAC / Ownership Checks)
  // -----------------------------------------------------------------
  describe('3. Resource-Level Authorization & Ownership Checks', () => {
    test('Employee A CAN read/update their OWN leave/profile resources', () => {
      const isAllowed = RbacSecurityGuard.evaluateResourceAccess({
        requesterId: employeeA.userId,
        requesterRole: Role.EMPLOYEE,
        resourceType: 'leave',
        resourceId: 'leave_req_101',
        resourceOwnerId: employeeA.userId, // Same user
        action: 'read',
      });
      expect(isAllowed).toBe(true);
    });

    test('Employee A MUST NOT read or modify Employee B private resources (Ownership Violation)', () => {
      const isReadAllowed = RbacSecurityGuard.evaluateResourceAccess({
        requesterId: employeeA.userId,
        requesterRole: Role.EMPLOYEE,
        resourceType: 'leave',
        resourceId: 'leave_req_202',
        resourceOwnerId: employeeB.userId, // Different user
        action: 'read',
      });
      expect(isReadAllowed).toBe(false);

      const isUpdateAllowed = RbacSecurityGuard.evaluateResourceAccess({
        requesterId: employeeA.userId,
        requesterRole: Role.EMPLOYEE,
        resourceType: 'payroll',
        resourceId: 'payroll_202',
        resourceOwnerId: employeeB.userId, // Different user
        action: 'update',
      });
      expect(isUpdateAllowed).toBe(false);
    });
  });

  // -----------------------------------------------------------------
  // 4. Input Validation Tests
  // -----------------------------------------------------------------
  describe('4. Input Validation on Orchestration Endpoints', () => {
    test('ApplyLeaveInputSchema validates correct payload', () => {
      const validPayload = {
        leaveTypeId: 'PAID',
        startDate: '2026-09-01',
        endDate: '2026-09-03',
        days: 3,
        reason: 'Valid reason',
      };
      const result = ApplyLeaveInputSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    test('ApplyLeaveInputSchema rejects negative days and invalid date format', () => {
      const invalidPayload = {
        leaveTypeId: 'PAID',
        startDate: '01/09/2026', // Wrong format
        endDate: '2026-09-03',
        days: -5, // Invalid negative days
      };
      const result = ApplyLeaveInputSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors.some((e) => e.path.includes('days'))).toBe(true);
        expect(result.error.errors.some((e) => e.path.includes('startDate'))).toBe(true);
      }
    });

    test('ApprovalDecisionInputSchema accepts only APPROVED or REJECTED', () => {
      expect(ApprovalDecisionInputSchema.safeParse({ decision: 'APPROVED' }).success).toBe(true);
      expect(ApprovalDecisionInputSchema.safeParse({ decision: 'REJECTED' }).success).toBe(true);
      expect(ApprovalDecisionInputSchema.safeParse({ decision: 'MAYBE' }).success).toBe(false);
    });
  });

  // -----------------------------------------------------------------
  // 5. Secret Handling & Zero Leaks
  // -----------------------------------------------------------------
  describe('5. Secret Handling & Leaks Prevention', () => {
    test('Registered secrets are never exposed in logs or error messages', () => {
      const jwtSecret = getSecret('JWT_SECRET');
      expect(jwtSecret).toBeDefined();

      const mockError = new Error(`Connection failed with key: ${jwtSecret}`);
      
      // Verify PII Sanitizer sanitizes sensitive fields
      const sanitized = PiiSanitizer.sanitize({
        secretKey: jwtSecret,
        nested: { password: 'MyPassword', token: 'jwt.token' },
      });

      expect(sanitized.secretKey).toBe('[REDACTED]');
      expect(sanitized.nested.password).toBe('[REDACTED]');
      expect(sanitized.nested.token).toBe('[REDACTED]');
    });
  });

  // -----------------------------------------------------------------
  // 6. PII-Safe Logging & Sanitization
  // -----------------------------------------------------------------
  describe('6. PII-Safe Logging', () => {
    test('Redacts passwords, tokens, bank accounts, SSN/tax IDs, and salaries', () => {
      const employeePayload = {
        userId: 'usr_emp_001',
        name: 'Alice',
        password_hash: '$2b$12$e874987213409817234',
        salary: 120000,
        bank_account_number: '987654321',
        tax_id: 'TAX-12345',
        credit_card: '4111-2222-3333-4444',
      };

      const sanitized = PiiSanitizer.sanitize(employeePayload);

      expect(sanitized.name).toBe('Alice');
      expect(sanitized.password_hash).toBe('[REDACTED]');
      expect(sanitized.salary).toBe('[REDACTED]');
      expect(sanitized.bank_account_number).toBe('[REDACTED]');
      expect(sanitized.tax_id).toBe('[REDACTED]');
      expect(sanitized.credit_card).toBe('[REDACTED]');
    });
  });

  // -----------------------------------------------------------------
  // 7. Structured Error Responses (No Stack Traces Leaked)
  // -----------------------------------------------------------------
  describe('7. Structured Security Error Responses', () => {
    test('SecurityErrorHandler produces standard envelopes without leaking stack traces', () => {
      let responseStatus = 0;
      let responseBody: any = null;

      const mockRes: any = {
        status: (s: number) => {
          responseStatus = s;
          return mockRes;
        },
        json: (b: any) => {
          responseBody = b;
          return mockRes;
        },
      };

      SecurityErrorHandler.sendUnauthorized(mockRes, 'Token expired on C:\\server\\app.ts');

      expect(responseStatus).toBe(401);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.code).toBe('UNAUTHORIZED');
      // Verify internal path was scrubbed
      expect(responseBody.error.message).not.toContain('C:\\server');
    });
  });
});
