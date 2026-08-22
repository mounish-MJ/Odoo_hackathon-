import { AuditService } from '../src/audit/audit.service';
import { InMemoryAuditStore } from '../src/audit/audit.store';

describe('Member 4 Audit & Compliance Layer Tests', () => {
  let auditService: AuditService;

  beforeEach(() => {
    auditService = new AuditService(new InMemoryAuditStore());
  });

  test('1. Records immutable audit log, computes deep diff, and redacts PII', async () => {
    const oldData = {
      status: 'PENDING',
      salary: 100000,
      notes: 'Initial state',
    };

    const newData = {
      status: 'APPROVED',
      salary: 110000,
      notes: 'Updated salary and status',
    };

    const record = await auditService.recordAudit({
      userId: 'user_456',
      userRole: 'ADMIN',
      action: 'PAYROLL.SALARY_REVISION',
      resourceType: 'payroll',
      resourceId: 'pay_789',
      oldData,
      newData,
      status: 'SUCCESS',
    });

    expect(record.auditId).toBeDefined();
    expect(record.oldData?.salary).toBe('[REDACTED]');
    expect(record.newData?.salary).toBe('[REDACTED]');
    expect(record.diff).toBeDefined();
    expect(record.diff?.status).toEqual({ from: 'PENDING', to: 'APPROVED' });

    // Query audit logs
    const results = await auditService.queryAuditLogs({
      userId: 'user_456',
      resourceType: 'payroll',
    });

    expect(results.total).toBe(1);
    expect(results.logs[0].action).toBe('PAYROLL.SALARY_REVISION');
  });
});
