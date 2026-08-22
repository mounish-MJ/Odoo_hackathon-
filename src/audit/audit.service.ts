import { v4 as uuidv4 } from 'uuid';
import { AuditRecord, AuditEventContract, AuditQueryFilters } from '../contracts/audit.contract';
import { IAuditStore, InMemoryAuditStore } from './audit.store';
import { PiiSanitizer } from '../security/pii.sanitizer';

export class AuditService implements AuditEventContract {
  private static instance: AuditService;
  private store: IAuditStore;

  constructor(store?: IAuditStore) {
    this.store = store || new InMemoryAuditStore();
  }

  public static getInstance(store?: IAuditStore): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService(store);
    }
    return AuditService.instance;
  }

  /**
   * Records an immutable, PII-sanitized audit log entry with calculated diffs.
   */
  public async recordAudit(
    recordData: Omit<AuditRecord, 'auditId' | 'timestamp'>
  ): Promise<AuditRecord> {
    const auditId = `aud_${uuidv4().substring(0, 8)}`;
    const timestamp = new Date().toISOString();

    // 1. Sanitize payloads to guarantee zero PII or secret leakage
    const sanitizedOld = recordData.oldData ? PiiSanitizer.sanitize(recordData.oldData) : null;
    const sanitizedNew = recordData.newData ? PiiSanitizer.sanitize(recordData.newData) : null;
    const diff = PiiSanitizer.computeDiff(sanitizedOld, sanitizedNew);

    const fullRecord: AuditRecord = {
      auditId,
      timestamp,
      userId: recordData.userId,
      userEmail: recordData.userEmail,
      userRole: recordData.userRole,
      action: recordData.action,
      resourceType: recordData.resourceType,
      resourceId: recordData.resourceId,
      source: recordData.source || 'MEMBER_4_PLATFORM',
      correlationId: recordData.correlationId,
      oldData: sanitizedOld,
      newData: sanitizedNew,
      diff,
      ipAddress: recordData.ipAddress,
      userAgent: recordData.userAgent,
      status: recordData.status || 'SUCCESS',
      failureReason: recordData.failureReason,
      metadata: recordData.metadata ? PiiSanitizer.sanitize(recordData.metadata) : undefined,
    };

    await this.store.save(fullRecord);
    return fullRecord;
  }

  /**
   * Queries the audit trail with rich filters.
   */
  public async queryAuditLogs(
    filters: AuditQueryFilters = {}
  ): Promise<{ logs: AuditRecord[]; total: number }> {
    return this.store.query(filters);
  }

  /**
   * Helper to reset or clear store (for testing).
   */
  public async clear(): Promise<void> {
    await this.store.clear();
  }
}
