import { BaseWorkflow } from './base.workflow';
import { WorkflowContext } from '../../contracts/workflow.contract';
import { IHRCoreService } from '../../contracts/hr-core.contract';
import { IAIEngineService } from '../../contracts/ai-engine.contract';
import { NotificationChannel, NotificationType } from '../../contracts/notification.contract';
import { Role } from '../../contracts/authorization.contract';

export interface AttendanceAnomalyPayload {
  userId: string;
  userName?: string;
  attendanceDate: string;
  checkInTime?: string;
  checkOutTime?: string;
  workingHours?: number;
  location?: { lat: number; lng: number };
  anomalyScore?: number;
  anomalyType?: string;
  reason?: string;
}

export interface AttendanceAnomalyResult {
  attendanceId: string;
  userId: string;
  anomalyHandled: boolean;
  status: string;
  anomalyScore: number;
}

export class AttendanceAnomalyWorkflow extends BaseWorkflow<
  AttendanceAnomalyPayload,
  AttendanceAnomalyResult
> {
  public workflowType = 'attendance-anomaly';

  private hrCoreService: IHRCoreService;
  private aiEngineService: IAIEngineService;

  constructor(hrCoreService: IHRCoreService, aiEngineService: IAIEngineService) {
    super();
    this.hrCoreService = hrCoreService;
    this.aiEngineService = aiEngineService;
  }

  // 1. Validation
  public async validateEvent(
    context: WorkflowContext<AttendanceAnomalyPayload, AttendanceAnomalyResult>
  ): Promise<boolean> {
    const p = context.event.payload;
    if (!p.userId || !p.attendanceDate) {
      throw new Error('Invalid attendance anomaly event: missing userId or attendanceDate');
    }
    return true;
  }

  // 2. Permission Check
  public async checkPermissions(): Promise<boolean> {
    return true; // System-triggered AI anomaly workflow
  }

  // 3. AI Risk / Anomaly Evaluation
  public async evaluateRisk(
    context: WorkflowContext<AttendanceAnomalyPayload, AttendanceAnomalyResult>
  ): Promise<{ riskScore?: number; confidence?: number; decision: 'AUTO_PROCEED' | 'REQUIRE_APPROVAL' | 'REJECT' }> {
    const p = context.event.payload;

    let anomalyScore = p.anomalyScore;
    if (anomalyScore === undefined) {
      const aiResult = await this.aiEngineService.detectAttendanceAnomaly({
        userId: p.userId,
        date: p.attendanceDate,
        checkInTime: p.checkInTime,
        checkOutTime: p.checkOutTime,
        workingHours: p.workingHours,
        location: p.location,
      });
      anomalyScore = aiResult.anomalyScore;
      p.anomalyType = aiResult.anomalyType;
      p.reason = aiResult.reason;
    }

    if (anomalyScore > 0.7) {
      return { riskScore: anomalyScore, confidence: 0.9, decision: 'REQUIRE_APPROVAL' };
    }

    return { riskScore: anomalyScore, confidence: 0.9, decision: 'AUTO_PROCEED' };
  }

  // 4. Deterministic Core Action
  public async executeDeterministicAction(
    context: WorkflowContext<AttendanceAnomalyPayload, AttendanceAnomalyResult>
  ): Promise<AttendanceAnomalyResult> {
    const p = context.event.payload;

    const recordResult = await this.hrCoreService.recordAttendance({
      userId: p.userId,
      date: p.attendanceDate,
      status: 'PRESENT',
      checkInTime: p.checkInTime,
      checkOutTime: p.checkOutTime,
      workingHours: p.workingHours,
      notes: `Flagged anomaly: ${p.anomalyType || 'Anomaly'} (Score: ${p.anomalyScore})`,
    });

    return {
      attendanceId: recordResult.attendanceId,
      userId: p.userId,
      anomalyHandled: true,
      status: 'FLAGGED_RECORDED',
      anomalyScore: p.anomalyScore || 0.5,
    };
  }

  // 5. Verification
  public async verifyAction(
    _context: WorkflowContext<AttendanceAnomalyPayload, AttendanceAnomalyResult>,
    actionResult: AttendanceAnomalyResult
  ): Promise<boolean> {
    return actionResult.anomalyHandled && !!actionResult.attendanceId;
  }

  // 6. Notification Dispatch
  public async dispatchNotifications(
    context: WorkflowContext<AttendanceAnomalyPayload, AttendanceAnomalyResult>
  ): Promise<void> {
    const p = context.event.payload;

    // Send Alert to Manager and HR
    await this.notificationService.send({
      recipientId: 'HR_TEAM',
      recipientRole: Role.HR,
      type: NotificationType.ANOMALY_ALERT,
      title: 'Attendance Anomaly Detected',
      message: `AI detected attendance anomaly for employee ${p.userId} on ${p.attendanceDate} (${p.reason || p.anomalyType})`,
      channels: [NotificationChannel.IN_APP, NotificationChannel.SSE_STREAM],
      data: {
        userId: p.userId,
        date: p.attendanceDate,
        anomalyType: p.anomalyType,
        score: p.anomalyScore,
      },
    });
  }

  // 7. Audit Event Creation
  public async recordAuditEvent(
    context: WorkflowContext<AttendanceAnomalyPayload, AttendanceAnomalyResult>
  ): Promise<void> {
    const p = context.event.payload;

    await this.auditService.recordAudit({
      userId: p.userId,
      userRole: Role.HR,
      action: 'ATTENDANCE.ANOMALY_PROCESSED',
      resourceType: 'attendance',
      resourceId: p.userId,
      newData: {
        userId: p.userId,
        attendanceDate: p.attendanceDate,
        anomalyScore: p.anomalyScore,
        anomalyType: p.anomalyType,
      },
      status: 'SUCCESS',
      metadata: {
        workflowId: context.workflowId,
      },
    });
  }
}
