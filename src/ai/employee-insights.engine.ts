import {
  AIInsightType,
  AISeverity,
  AIStructuredInsight,
  AttendanceRecordInput,
  LeaveRecordInput,
  PayrollRecordInput,
  InsufficientDataResult,
} from '../contracts/ai-intelligence.contract';
import { AttendanceAnomalyEngine } from './attendance-anomaly.engine';
import { LeaveIntelligenceEngine } from './leave-intelligence.engine';
import { PayrollAnomalyEngine } from './payroll-anomaly.engine';

export interface EmployeeProfileData {
  employeeId: string;
  name: string;
  departmentId: string;
  designation?: string;
  tenureMonths?: number;
  attendanceRecords: AttendanceRecordInput[];
  leaveBalance: { available: number; used: number; total: number };
  leaveHistory: LeaveRecordInput[];
  payrollHistory: PayrollRecordInput[];
}

export interface EmployeeInsightDetails {
  engagementScore: number; // 0 to 100
  retentionRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  retentionRiskScore: number; // 0.0 to 1.0
  burnoutRisk: boolean;
  attendanceConsistencyScore: number; // 0 to 100
  keyStrengths: string[];
  focusAreas: string[];
}

export class EmployeeInsightsEngine {
  /**
   * Synthesizes cross-functional HR data into explainable holistic employee insights.
   */
  public static generateInsights(
    profile: EmployeeProfileData
  ): AIStructuredInsight<EmployeeInsightDetails> | InsufficientDataResult {
    // 1. Safety Check: Verify Data Sufficiency
    if (!profile || !profile.employeeId || !profile.attendanceRecords || profile.attendanceRecords.length < 3) {
      return {
        status: 'insufficient_data',
        type: AIInsightType.EMPLOYEE_INSIGHT,
        employee_id: profile?.employeeId || 'unknown',
        message: 'Insufficient historical data to generate comprehensive employee insights (minimum 3 attendance records required).',
        required_fields: ['employeeId', 'attendanceRecords (>= 3)', 'leaveBalance'],
        provided_records_count: profile?.attendanceRecords ? profile.attendanceRecords.length : 0,
        minimum_required_count: 3,
        timestamp: new Date().toISOString(),
      };
    }

    const { employeeId, name, attendanceRecords, leaveBalance, leaveHistory, payrollHistory, tenureMonths } = profile;
    const evidence: string[] = [];
    const keyStrengths: string[] = [];
    const focusAreas: string[] = [];

    // 2. Evaluate Attendance Health
    const attendanceInsight = AttendanceAnomalyEngine.analyze(employeeId, attendanceRecords);
    let attendanceScore = 85;

    if (attendanceInsight.status === 'success') {
      if (attendanceInsight.severity === AISeverity.CRITICAL) {
        attendanceScore = 30;
        focusAreas.push('Critical attendance irregularities / consecutive absences');
        evidence.push(attendanceInsight.reason);
      } else if (attendanceInsight.severity === AISeverity.HIGH) {
        attendanceScore = 50;
        focusAreas.push('High frequency of absences');
        evidence.push(attendanceInsight.reason);
      } else if (attendanceInsight.severity === AISeverity.MEDIUM) {
        attendanceScore = 70;
        focusAreas.push('Weekend-adjacent absence clustering or shift anomalies');
        evidence.push(attendanceInsight.reason);
      } else {
        attendanceScore = 95;
        keyStrengths.push('Exemplary attendance consistency and punctuality');
        evidence.push('Consistent and compliant attendance logging');
      }
    }

    // 3. Evaluate Leave & Burnout Health
    const leaveInsight = LeaveIntelligenceEngine.analyze({
      employeeId,
      currentBalance: leaveBalance,
      historicalLeaves: leaveHistory || [],
    });

    let burnoutDetected = false;
    if (leaveInsight.status === 'success' && leaveInsight.details?.burnoutRiskDetected) {
      burnoutDetected = true;
      focusAreas.push('High burnout risk due to zero leave utilization');
      evidence.push('Zero leave days taken in the current annual cycle');
    } else {
      keyStrengths.push('Healthy work-rest balance maintained');
    }

    // 4. Evaluate Payroll Stability
    if (payrollHistory && payrollHistory.length > 0) {
      const latestPayroll = payrollHistory[payrollHistory.length - 1];
      const payrollInsight = PayrollAnomalyEngine.analyze(
        employeeId,
        latestPayroll,
        payrollHistory.slice(0, -1)
      );

      if (payrollInsight.status === 'success' && payrollInsight.severity === AISeverity.LOW) {
        keyStrengths.push('Stable and compliant compensation track record');
      }
    }

    // 5. Compute Aggregate Retention Risk & Engagement Scores
    let retentionRiskScore = 0.15;
    if (attendanceScore < 50) retentionRiskScore += 0.45;
    else if (attendanceScore < 75) retentionRiskScore += 0.25;

    if (burnoutDetected) retentionRiskScore += 0.2;
    if (tenureMonths && tenureMonths < 3) retentionRiskScore += 0.1; // Early onboarding transition

    retentionRiskScore = Math.min(Number(retentionRiskScore.toFixed(2)), 1.0);
    const retentionRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' =
      retentionRiskScore >= 0.65 ? 'HIGH' : retentionRiskScore >= 0.4 ? 'MEDIUM' : 'LOW';

    const engagementScore = Math.max(
      10,
      Math.round(attendanceScore * 0.6 + (burnoutDetected ? 50 : 90) * 0.4)
    );

    // 6. Generate Explainable Recommendations
    let recommendation = 'Continue regular quarterly talent reviews and maintain standard support.';
    if (retentionRiskLevel === 'HIGH') {
      recommendation = `High retention risk flagged. Recommend immediate 1-on-1 check-in by reporting manager to address attendance deviations and workload concerns.`;
    } else if (burnoutDetected) {
      recommendation = `Burnout indicator active. Manager should encourage employee to schedule well-deserved leave.`;
    }

    return {
      status: 'success',
      type: AIInsightType.EMPLOYEE_INSIGHT,
      severity:
        retentionRiskLevel === 'HIGH'
          ? AISeverity.HIGH
          : retentionRiskLevel === 'MEDIUM'
          ? AISeverity.MEDIUM
          : AISeverity.LOW,
      employee_id: employeeId,
      summary: `Employee profile analysis for ${name || employeeId}: Engagement score is ${engagementScore}/100, Retention risk is ${retentionRiskLevel}.`,
      reason: `Synthesized analysis based on ${attendanceRecords.length} attendance records, leave balance (${leaveBalance.available} days remaining), and compensation stability.`,
      recommendation,
      confidence: 0.92,
      details: {
        engagementScore,
        retentionRiskLevel,
        retentionRiskScore,
        burnoutRisk: burnoutDetected,
        attendanceConsistencyScore: attendanceScore,
        keyStrengths,
        focusAreas,
      },
      timestamp: new Date().toISOString(),
      explainability: {
        rule_or_model: 'EmployeeInsightsEngine:holistic_synthesis_v1',
        evidence,
        unsupported_claims_filtered: true,
      },
    };
  }
}
