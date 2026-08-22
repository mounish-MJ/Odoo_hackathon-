export interface AuditRecord {
  auditId: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  diff?: Record<string, { from: unknown; to: unknown }>;
  ipAddress?: string;
  userAgent?: string;
  status: 'SUCCESS' | 'FAILURE';
  failureReason?: string;
  timestamp: string; // ISO 8601
  metadata?: Record<string, unknown>;
}

export const SENSITIVE_PII_FIELDS: string[] = [
  'password',
  'password_hash',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'signature_secret',
  'bank_account_number',
  'bankAccountNumber',
  'bank_account',
  'bankAccount',
  'account_number',
  'accountNumber',
  'tax_id',
  'taxId',
  'ssn',
  'pan_number',
  'panNumber',
  'salary',
  'base_salary',
  'baseSalary',
  'net_salary',
  'netSalary',
  'credit_card',
  'creditCard',
  'mfa_secret',
  'mfaSecret',
];

export interface AuditEventContract {
  recordAudit(record: Omit<AuditRecord, 'auditId' | 'timestamp'>): Promise<AuditRecord>;
  queryAuditLogs(filters: {
    userId?: string;
    resourceType?: string;
    resourceId?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AuditRecord[]; total: number }>;
}
