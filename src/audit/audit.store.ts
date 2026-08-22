import { AuditRecord } from '../contracts/audit.contract';

export interface IAuditStore {
  save(record: AuditRecord): Promise<void>;
  query(filters: {
    userId?: string;
    resourceType?: string;
    resourceId?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AuditRecord[]; total: number }>;
  clear(): Promise<void>;
}

export class InMemoryAuditStore implements IAuditStore {
  private records: AuditRecord[] = [];

  public async save(record: AuditRecord): Promise<void> {
    // Immutable append
    this.records.unshift(Object.freeze({ ...record }));
  }

  public async query(filters: {
    userId?: string;
    resourceType?: string;
    resourceId?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AuditRecord[]; total: number }> {
    let filtered = [...this.records];

    if (filters.userId) {
      filtered = filtered.filter((r) => r.userId === filters.userId);
    }
    if (filters.resourceType) {
      filtered = filtered.filter((r) => r.resourceType.toLowerCase() === filters.resourceType?.toLowerCase());
    }
    if (filters.resourceId) {
      filtered = filtered.filter((r) => r.resourceId === filters.resourceId);
    }
    if (filters.action) {
      filtered = filtered.filter((r) => r.action.toLowerCase().includes(filters.action?.toLowerCase() || ''));
    }
    if (filters.startDate) {
      filtered = filtered.filter((r) => new Date(r.timestamp) >= new Date(filters.startDate!));
    }
    if (filters.endDate) {
      filtered = filtered.filter((r) => new Date(r.timestamp) <= new Date(filters.endDate!));
    }

    const total = filtered.length;
    const offset = filters.offset || 0;
    const limit = filters.limit || 50;
    const paginated = filtered.slice(offset, offset + limit);

    return { logs: paginated, total };
  }

  public async clear(): Promise<void> {
    this.records = [];
  }
}
