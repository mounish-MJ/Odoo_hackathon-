import {
  AIInsightType,
  AISeverity,
  AIStructuredInsight,
  AttendanceRecordInput,
  AttendanceAnomalyDetails,
  LeaveIntelligenceDetails,
  PayrollRecordInput,
  PayrollAnomalyDetails,
  InsufficientDataResult,
} from '../contracts/ai-intelligence.contract';
import { AttendanceAnomalyEngine } from './attendance-anomaly.engine';
import { LeaveIntelligenceEngine, LeaveIntelligenceInput } from './leave-intelligence.engine';
import { PayrollAnomalyEngine } from './payroll-anomaly.engine';
import { EmployeeInsightsEngine, EmployeeProfileData, EmployeeInsightDetails } from './employee-insights.engine';

export class AIOrchestratorService {
  private static instance: AIOrchestratorService;

  public static getInstance(): AIOrchestratorService {
    if (!AIOrchestratorService.instance) {
      AIOrchestratorService.instance = new AIOrchestratorService();
    }
    return AIOrchestratorService.instance;
  }

  /**
   * 1. Attendance Anomaly Analysis with Deterministic Fallback Protection
   */
  public analyzeAttendance(
    employeeId: string,
    records: AttendanceRecordInput[]
  ): AIStructuredInsight<AttendanceAnomalyDetails> | InsufficientDataResult {
    try {
      return AttendanceAnomalyEngine.analyze(employeeId, records);
    } catch (err: any) {
      // Deterministic Fallback
      return {
        status: 'fallback',
        type: AIInsightType.ATTENDANCE_ANOMALY,
        severity: AISeverity.LOW,
        employee_id: employeeId,
        summary: 'Deterministic attendance fallback applied due to engine exception.',
        reason: `Engine caught exception: ${err.message}. Defaulted to safe baseline status.`,
        recommendation: 'Manual HR review recommended.',
        confidence: 0.5,
        details: {
          anomalyCategory: 'NONE',
          flaggedDates: [],
          totalAbsences: 0,
          avgWorkingHours: 8,
          lateArrivalCount: 0,
        },
        timestamp: new Date().toISOString(),
        explainability: {
          rule_or_model: 'AIOrchestratorService:deterministic_attendance_fallback',
          evidence: ['Fallback activated to prevent system failure'],
          unsupported_claims_filtered: true,
        },
      };
    }
  }

  /**
   * Fetches attendance records directly from Member 1 REST API using Bearer JWT and executes AI evaluation.
   * Ensures 100% database isolation without direct DB access.
   */
  public async analyzeAttendanceViaMember1REST(
    employeeId: string,
    hrCoreService: import('../contracts/hr-core.contract').IHRCoreService,
    token?: string
  ): Promise<AIStructuredInsight<AttendanceAnomalyDetails> | InsufficientDataResult> {
    if (hrCoreService.getEmployeeAttendance) {
      const records = await hrCoreService.getEmployeeAttendance(employeeId, token);
      return this.analyzeAttendance(employeeId, records);
    }
    return this.analyzeAttendance(employeeId, []);
  }

  /**
   * 2. Leave Intelligence Analysis with Concurrency and Burnout Evaluation
   */
  public analyzeLeaves(
    input: LeaveIntelligenceInput
  ): AIStructuredInsight<LeaveIntelligenceDetails> | InsufficientDataResult {
    try {
      return LeaveIntelligenceEngine.analyze(input);
    } catch (err: any) {
      return {
        status: 'fallback',
        type: AIInsightType.LEAVE_INTELLIGENCE,
        severity: AISeverity.LOW,
        employee_id: input?.employeeId || 'unknown',
        summary: 'Deterministic leave intelligence fallback applied.',
        reason: `Engine caught exception: ${err.message}.`,
        recommendation: 'Verify leave balances manually with HR.',
        confidence: 0.5,
        details: {
          conflictDetected: false,
          departmentOverlapPercentage: 0,
          burnoutRiskDetected: false,
          consecutiveWeekendPattern: false,
        },
        timestamp: new Date().toISOString(),
        explainability: {
          rule_or_model: 'AIOrchestratorService:deterministic_leave_fallback',
          evidence: ['Fallback activated'],
          unsupported_claims_filtered: true,
        },
      };
    }
  }

  /**
   * 3. Payroll Anomaly Detection with Deduction Ratio & Negative Net Pay Guards
   */
  public analyzePayroll(
    employeeId: string,
    currentPayroll: PayrollRecordInput,
    historicalPayrolls: PayrollRecordInput[] = []
  ): AIStructuredInsight<PayrollAnomalyDetails> | InsufficientDataResult {
    try {
      return PayrollAnomalyEngine.analyze(employeeId, currentPayroll, historicalPayrolls);
    } catch (err: any) {
      return {
        status: 'fallback',
        type: AIInsightType.PAYROLL_ANOMALY,
        severity: AISeverity.LOW,
        employee_id: employeeId,
        summary: 'Deterministic payroll fallback applied.',
        reason: `Engine caught exception: ${err.message}.`,
        recommendation: 'Finance manual audit recommended.',
        confidence: 0.5,
        details: {
          anomalyCategory: 'NONE',
        },
        timestamp: new Date().toISOString(),
        explainability: {
          rule_or_model: 'AIOrchestratorService:deterministic_payroll_fallback',
          evidence: ['Fallback activated'],
          unsupported_claims_filtered: true,
        },
      };
    }
  }

  /**
   * 4. Employee Insights Synthesis
   */
  public generateEmployeeInsights(
    profile: EmployeeProfileData
  ): AIStructuredInsight<EmployeeInsightDetails> | InsufficientDataResult {
    try {
      return EmployeeInsightsEngine.generateInsights(profile);
    } catch (err: any) {
      return {
        status: 'fallback',
        type: AIInsightType.EMPLOYEE_INSIGHT,
        severity: AISeverity.LOW,
        employee_id: profile?.employeeId || 'unknown',
        summary: 'Deterministic employee insight fallback applied.',
        reason: `Engine caught exception: ${err.message}.`,
        recommendation: 'Standard talent review recommended.',
        confidence: 0.5,
        details: {
          engagementScore: 75,
          retentionRiskLevel: 'LOW',
          retentionRiskScore: 0.25,
          burnoutRisk: false,
          attendanceConsistencyScore: 80,
          keyStrengths: ['Standard performance baseline'],
          focusAreas: [],
        },
        timestamp: new Date().toISOString(),
        explainability: {
          rule_or_model: 'AIOrchestratorService:deterministic_insight_fallback',
          evidence: ['Fallback activated'],
          unsupported_claims_filtered: true,
        },
      };
    }
  }
}
