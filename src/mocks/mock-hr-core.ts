import {
  IHRCoreService,
  LeaveBalanceUpdateInput,
  AttendanceUpdateInput,
  PayrollMutationInput,
} from '../contracts/hr-core.contract';

export class MockHRCoreService implements IHRCoreService {
  private leaveBalances = new Map<string, { available: number; used: number; total: number }>();
  private attendanceRecords = new Map<string, any>();
  private payrollRecords = new Map<string, any>();
  private users = new Map<string, any>();

  constructor() {
    this.seedDefaultData();
  }

  private seedDefaultData(): void {
    // Seed default employee balances
    this.leaveBalances.set('user_123:PAID', { available: 15, used: 3, total: 18 });
    this.leaveBalances.set('user_123:SICK', { available: 10, used: 2, total: 12 });
    this.leaveBalances.set('emp_demo_1:PAID', { available: 12, used: 6, total: 18 });
    this.leaveBalances.set('emp_demo_2:PAID', { available: 20, used: 0, total: 20 });

    this.users.set('user_123', {
      userId: 'user_123',
      name: 'John Doe',
      email: 'john.doe@dayflow.app',
      role: 'EMPLOYEE',
      departmentId: 'dept_engineering',
      reportingManagerId: 'mgr_456',
    });
  }

  public async getLeaveBalance(
    userId: string,
    leaveTypeId: string
  ): Promise<{ available: number; used: number; total: number }> {
    const key = `${userId}:${leaveTypeId}`;
    return this.leaveBalances.get(key) || { available: 15, used: 0, total: 15 };
  }

  public async deductLeaveBalance(
    input: LeaveBalanceUpdateInput
  ): Promise<{ success: boolean; newBalance: number }> {
    const key = `${input.userId}:${input.leaveTypeId}`;
    const current = this.leaveBalances.get(key) || { available: 15, used: 0, total: 15 };

    if (current.available < input.days) {
      return { success: false, newBalance: current.available };
    }

    const updated = {
      available: current.available - input.days,
      used: current.used + input.days,
      total: current.total,
    };
    this.leaveBalances.set(key, updated);
    return { success: true, newBalance: updated.available };
  }

  public async updateLeaveRequestStatus(
    leaveRequestId: string,
    status: string,
    approverId?: string,
    comments?: string
  ): Promise<{ success: boolean; updatedRecord: Record<string, unknown> }> {
    const record = {
      leaveRequestId,
      status,
      approverId,
      comments,
      updatedAt: new Date().toISOString(),
    };
    return { success: true, updatedRecord: record };
  }

  public async recordAttendance(
    input: AttendanceUpdateInput
  ): Promise<{ success: boolean; attendanceId: string }> {
    const attendanceId = `att_${Date.now()}`;
    this.attendanceRecords.set(attendanceId, { ...input, attendanceId });
    return { success: true, attendanceId };
  }

  public async updateAttendanceStatus(
    attendanceId: string,
    status: string,
    notes?: string
  ): Promise<{ success: boolean }> {
    const existing = this.attendanceRecords.get(attendanceId);
    if (existing) {
      existing.status = status;
      existing.notes = notes;
    }
    return { success: true };
  }

  public async processPayrollMutation(
    input: PayrollMutationInput
  ): Promise<{ success: boolean; payrollId: string }> {
    const payrollId = input.payrollId || `pay_${Date.now()}_${input.userId}`;
    this.payrollRecords.set(payrollId, { ...input, payrollId });
    return { success: true, payrollId };
  }

  public async getUserProfile(userId: string): Promise<Record<string, unknown> | null> {
    return this.users.get(userId) || null;
  }

  public async getUserManager(
    userId: string
  ): Promise<{ managerId: string; managerName: string; managerEmail: string } | null> {
    return {
      managerId: 'mgr_456',
      managerName: 'Sarah Jenkins',
      managerEmail: 'sarah.jenkins@dayflow.app',
    };
  }
}
