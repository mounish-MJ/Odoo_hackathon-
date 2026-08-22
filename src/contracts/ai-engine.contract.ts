export interface LeaveRiskAssessmentInput {
  userId: string;
  leaveType: string;
  days: number;
  startDate: string;
  endDate: string;
  departmentId?: string;
  currentWorkloadScore?: number;
  recentAbsenteeismRate?: number;
}

export interface LeaveRiskAssessmentOutput {
  riskScore: number; // 0.0 (low risk) to 1.0 (critical risk)
  approvalConfidence: number; // 0.0 to 1.0
  autoApproveRecommended: boolean;
  predictedApprovalTimeHours: number;
  factors: string[];
  suggestedAction: 'AUTO_APPROVE' | 'ROUTE_MANAGER' | 'ROUTE_HR' | 'FLAG_FOR_REVIEW';
  modelVersion: string;
}

export interface AttendanceAnomalyInput {
  userId: string;
  date: string;
  checkInTime?: string;
  checkOutTime?: string;
  workingHours?: number;
  location?: { lat: number; lng: number };
  ipAddress?: string;
}

export interface AttendanceAnomalyOutput {
  isAnomaly: boolean;
  anomalyScore: number; // 0.0 to 1.0
  anomalyType?: 'UNUSUAL_HOURS' | 'SUSPICIOUS_LOCATION' | 'REPEATED_LATENESS' | 'GHOST_LOG';
  reason?: string;
  recommendedResolution: string;
}

export interface IAIEngineService {
  // AI Evaluations (Member 2)
  evaluateLeaveRisk(input: LeaveRiskAssessmentInput): Promise<LeaveRiskAssessmentOutput>;
  detectAttendanceAnomaly(input: AttendanceAnomalyInput): Promise<AttendanceAnomalyOutput>;
  calculateAttritionRisk(userId: string): Promise<{ riskScore: number; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'; drivers: string[] }>;
}
