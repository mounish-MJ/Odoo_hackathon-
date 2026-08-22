export enum AIInsightType {
  ATTENDANCE_ANOMALY = 'attendance_anomaly',
  LEAVE_INTELLIGENCE = 'leave_intelligence',
  PAYROLL_ANOMALY = 'payroll_anomaly',
  EMPLOYEE_INSIGHT = 'employee_insight',
}

export enum AISeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface AIStructuredInsight<TDetails = Record<string, unknown>> {
  status: 'success' | 'insufficient_data' | 'fallback';
  type: AIInsightType;
  severity: AISeverity;
  employee_id: string;
  summary: string;
  reason: string;
  recommendation: string;
  confidence: number; // 0.0 to 1.0
  details?: TDetails;
  timestamp: string;
  explainability: {
    rule_or_model: string;
    evidence: string[];
    unsupported_claims_filtered: boolean;
  };
}

export interface InsufficientDataResult {
  status: 'insufficient_data';
  type: AIInsightType;
  employee_id: string;
  message: string;
  required_fields: string[];
  provided_records_count: number;
  minimum_required_count: number;
  timestamp: string;
}

export interface AttendanceRecordInput {
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE' | 'WORK_FROM_HOME';
  checkInTime?: string; // e.g. "09:15"
  checkOutTime?: string; // e.g. "18:00"
  workingHours?: number;
  notes?: string;
}

export interface AttendanceAnomalyDetails {
  anomalyCategory: 'UNUSUAL_HOURS' | 'REPEATED_LATENESS' | 'CONSECUTIVE_ABSENCES' | 'MONDAY_FRIDAY_PATTERN' | 'NONE';
  flaggedDates: string[];
  totalAbsences: number;
  avgWorkingHours: number;
  lateArrivalCount: number;
}

export interface LeaveRecordInput {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
  reason?: string;
}

export interface LeaveIntelligenceDetails {
  conflictDetected: boolean;
  departmentOverlapPercentage: number;
  burnoutRiskDetected: boolean;
  projectedDepletionDate?: string;
  consecutiveWeekendPattern: boolean;
}

export interface PayrollRecordInput {
  month: number;
  year: number;
  baseSalary: number;
  hra: number;
  allowances: number;
  deductions: number;
  netSalary: number;
}

export interface PayrollAnomalyDetails {
  anomalyCategory: 'SALARY_SPIKE_OR_DROP' | 'EXCESSIVE_DEDUCTIONS' | 'NEGATIVE_NET_SALARY' | 'DISPROPORTIONATE_ALLOWANCES' | 'NONE';
  percentageChange?: number;
  deductionRatio?: number;
  allowanceRatio?: number;
}
