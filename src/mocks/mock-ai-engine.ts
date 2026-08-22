import {
  IAIEngineService,
  LeaveRiskAssessmentInput,
  LeaveRiskAssessmentOutput,
  AttendanceAnomalyInput,
  AttendanceAnomalyOutput,
} from '../contracts/ai-engine.contract';

export class MockAIEngineService implements IAIEngineService {
  /**
   * Predicts risk and auto-approval confidence for leave applications.
   * If days <= 2 and no peak conflict -> Low risk, High confidence (Auto-approve).
   * If days > 2 -> Medium risk (Route to manager).
   */
  public async evaluateLeaveRisk(
    input: LeaveRiskAssessmentInput
  ): Promise<LeaveRiskAssessmentOutput> {
    const isShortLeave = input.days <= 2;
    const isSick = input.leaveType === 'SICK';

    if (isShortLeave || isSick) {
      return {
        riskScore: 0.15,
        approvalConfidence: 0.92,
        autoApproveRecommended: true,
        predictedApprovalTimeHours: 0,
        factors: ['Short duration request', 'Adequate team coverage', 'Healthy leave balance'],
        suggestedAction: 'AUTO_APPROVE',
        modelVersion: 'dayflow-v2-lgbm',
      };
    }

    return {
      riskScore: 0.45,
      approvalConfidence: 0.72,
      autoApproveRecommended: false,
      predictedApprovalTimeHours: 6,
      factors: ['Multi-day leave requested', 'Manager scheduling review needed'],
      suggestedAction: 'ROUTE_MANAGER',
      modelVersion: 'dayflow-v2-lgbm',
    };
  }

  /**
   * Detects anomaly in clock-in/clock-out telemetry.
   */
  public async detectAttendanceAnomaly(
    input: AttendanceAnomalyInput
  ): Promise<AttendanceAnomalyOutput> {
    if (input.workingHours && input.workingHours > 14) {
      return {
        isAnomaly: true,
        anomalyScore: 0.88,
        anomalyType: 'UNUSUAL_HOURS',
        reason: 'Excessive continuous shift length without break log',
        recommendedResolution: 'Manager verification required',
      };
    }

    return {
      isAnomaly: false,
      anomalyScore: 0.08,
      recommendedResolution: 'Standard logging verified',
    };
  }

  public async calculateAttritionRisk(
    _userId: string
  ): Promise<{ riskScore: number; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'; drivers: string[] }> {
    return {
      riskScore: 0.22,
      riskLevel: 'LOW',
      drivers: ['High project engagement', 'Consistent attendance'],
    };
  }
}
