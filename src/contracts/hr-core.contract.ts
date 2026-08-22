export interface LeaveBalanceUpdateInput {
  userId: string;
  leaveTypeId: string;
  days: number; // positive to deduct, negative to restore
  reason: string;
}

export interface AttendanceUpdateInput {
  userId: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE' | 'WORK_FROM_HOME';
  checkInTime?: string;
  checkOutTime?: string;
  workingHours?: number;
  notes?: string;
}

export interface PayrollMutationInput {
  payrollId?: string;
  userId: string;
  month: number;
  year: number;
  baseSalary: number;
  hra: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  paymentStatus: 'PENDING' | 'PROCESSED' | 'PAID' | 'FAILED';
}

export interface IHRCoreService {
  // Leave operations (Member 1)
  getLeaveBalance(userId: string, leaveTypeId: string): Promise<{ available: number; used: number; total: number }>;
  deductLeaveBalance(input: LeaveBalanceUpdateInput): Promise<{ success: boolean; newBalance: number }>;
  updateLeaveRequestStatus(leaveRequestId: string, status: string, approverId?: string, comments?: string): Promise<{ success: boolean; updatedRecord: Record<string, unknown> }>;

  // Attendance operations (Member 1)
  recordAttendance(input: AttendanceUpdateInput): Promise<{ success: boolean; attendanceId: string }>;
  updateAttendanceStatus(attendanceId: string, status: string, notes?: string): Promise<{ success: boolean }>;

  // Payroll operations (Member 1)
  processPayrollMutation(input: PayrollMutationInput): Promise<{ success: boolean; payrollId: string }>;

  // User Profile queries (Member 1)
  getUserProfile(userId: string, token?: string): Promise<Record<string, unknown> | null>;
  getUserManager(userId: string, token?: string): Promise<{ managerId: string; managerName: string; managerEmail: string } | null>;

  // Additive Query operations for AI & Intelligence (Member 1 HTTP REST endpoints with Bearer JWT)
  getEmployeeAttendance?(userId: string, token?: string): Promise<AttendanceUpdateInput[]>;
  getEmployeePayrollHistory?(userId: string, token?: string): Promise<PayrollMutationInput[]>;
}
