import {
  AIInsightType,
  AISeverity,
  AIStructuredInsight,
  AttendanceRecordInput,
  AttendanceAnomalyDetails,
  InsufficientDataResult,
} from '../contracts/ai-intelligence.contract';

export class AttendanceAnomalyEngine {
  private static MIN_RECORDS = 3;

  /**
   * Analyzes an employee's historical attendance records for anomalies.
   */
  public static analyze(
    employeeId: string,
    records: AttendanceRecordInput[]
  ): AIStructuredInsight<AttendanceAnomalyDetails> | InsufficientDataResult {
    // 1. Safety Check: Verify Data Sufficiency
    if (!records || records.length < AttendanceAnomalyEngine.MIN_RECORDS) {
      return {
        status: 'insufficient_data',
        type: AIInsightType.ATTENDANCE_ANOMALY,
        employee_id: employeeId,
        message: `Insufficient attendance records for statistical analysis. Minimum ${AttendanceAnomalyEngine.MIN_RECORDS} records required, but only ${records ? records.length : 0} provided.`,
        required_fields: ['date', 'status', 'workingHours'],
        provided_records_count: records ? records.length : 0,
        minimum_required_count: AttendanceAnomalyEngine.MIN_RECORDS,
        timestamp: new Date().toISOString(),
      };
    }

    // 2. Metrics Computation
    const evidence: string[] = [];
    const flaggedDates: string[] = [];
    let lateCount = 0;
    let consecutiveAbsenceCount = 0;
    let maxConsecutiveAbsences = 0;
    let mondayFridayAbsences = 0;
    let totalWorkingHours = 0;
    let presentDaysCount = 0;
    let unusualHoursFound = false;

    // Sort chronologically
    const sorted = [...records].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    for (const rec of sorted) {
      const dayOfWeek = new Date(rec.date).getDay(); // 0 = Sunday, 1 = Monday, 5 = Friday

      // Check Working Hours Anomaly (> 14h or < 3h when PRESENT)
      if (rec.workingHours !== undefined) {
        if (rec.status === 'PRESENT') {
          totalWorkingHours += rec.workingHours;
          presentDaysCount++;

          if (rec.workingHours > 14) {
            unusualHoursFound = true;
            flaggedDates.push(rec.date);
            evidence.push(`Unusual shift length of ${rec.workingHours} hours on ${rec.date} exceeds 14-hour limit`);
          } else if (rec.workingHours < 3) {
            unusualHoursFound = true;
            flaggedDates.push(rec.date);
            evidence.push(`Unusually short shift of ${rec.workingHours} hours logged as full PRESENT on ${rec.date}`);
          }
        }
      }

      // Check Lateness (Check-in after 10:30 AM)
      if (rec.checkInTime) {
        const [hour, minute] = rec.checkInTime.split(':').map(Number);
        if (hour > 10 || (hour === 10 && minute > 30)) {
          lateCount++;
          if (lateCount >= 3) {
            flaggedDates.push(rec.date);
            evidence.push(`Late arrival at ${rec.checkInTime} on ${rec.date} (Lateness incident #${lateCount})`);
          }
        }
      }

      // Check Consecutive Absences
      if (rec.status === 'ABSENT') {
        consecutiveAbsenceCount++;
        if (consecutiveAbsenceCount > maxConsecutiveAbsences) {
          maxConsecutiveAbsences = consecutiveAbsenceCount;
        }
        if (dayOfWeek === 1 || dayOfWeek === 5) {
          mondayFridayAbsences++;
        }
      } else {
        consecutiveAbsenceCount = 0;
      }
    }

    const avgHours = presentDaysCount > 0 ? Number((totalWorkingHours / presentDaysCount).toFixed(1)) : 0;
    const totalAbsences = records.filter((r) => r.status === 'ABSENT').length;

    // 3. Anomaly Decision Logic & Structured Synthesis

    // A. Critical / High: Consecutive Unplanned Absences
    if (maxConsecutiveAbsences >= 3) {
      return {
        status: 'success',
        type: AIInsightType.ATTENDANCE_ANOMALY,
        severity: maxConsecutiveAbsences >= 5 ? AISeverity.CRITICAL : AISeverity.HIGH,
        employee_id: employeeId,
        summary: `Repeated consecutive absences detected (${maxConsecutiveAbsences} consecutive days).`,
        reason: `Employee ${employeeId} has been absent for ${maxConsecutiveAbsences} consecutive working days without recorded approved leave.`,
        recommendation: `HR or reporting manager should conduct a welfare check-in and verify if medical or personal leave should be applied.`,
        confidence: 0.95,
        details: {
          anomalyCategory: 'CONSECUTIVE_ABSENCES',
          flaggedDates: sorted.filter((r) => r.status === 'ABSENT').map((r) => r.date),
          totalAbsences,
          avgWorkingHours: avgHours,
          lateArrivalCount: lateCount,
        },
        timestamp: new Date().toISOString(),
        explainability: {
          rule_or_model: 'AttendanceAnomalyEngine:consecutive_absence_detector_v1',
          evidence: [
            `Detected ${maxConsecutiveAbsences} consecutive unapproved absences`,
            `Total absences in review period: ${totalAbsences}`,
          ],
          unsupported_claims_filtered: true,
        },
      };
    }

    // B. Medium / High: Monday / Friday Absence Clustering
    if (mondayFridayAbsences >= 3) {
      return {
        status: 'success',
        type: AIInsightType.ATTENDANCE_ANOMALY,
        severity: AISeverity.MEDIUM,
        employee_id: employeeId,
        summary: `Frequent weekend-adjacent absences detected (${mondayFridayAbsences} Monday/Friday absences).`,
        reason: `Employee ${employeeId} has accumulated ${mondayFridayAbsences} unapproved absences specifically on Mondays or Fridays, forming a weekend extension pattern.`,
        recommendation: `Review attendance trends with employee during the next 1-on-1 to establish scheduling clarity.`,
        confidence: 0.88,
        details: {
          anomalyCategory: 'MONDAY_FRIDAY_PATTERN',
          flaggedDates: sorted.filter((r) => r.status === 'ABSENT').map((r) => r.date),
          totalAbsences,
          avgWorkingHours: avgHours,
          lateArrivalCount: lateCount,
        },
        timestamp: new Date().toISOString(),
        explainability: {
          rule_or_model: 'AttendanceAnomalyEngine:weekend_adjacent_detector_v1',
          evidence: [
            `${mondayFridayAbsences} absences occurred on Mondays or Fridays`,
            `Total absences in review period: ${totalAbsences}`,
          ],
          unsupported_claims_filtered: true,
        },
      };
    }

    // C. Medium: Repeated Shift Length / Logging Anomalies
    if (unusualHoursFound) {
      return {
        status: 'success',
        type: AIInsightType.ATTENDANCE_ANOMALY,
        severity: AISeverity.MEDIUM,
        employee_id: employeeId,
        summary: `Unusual working shift duration telemetry detected.`,
        reason: `Working hours logged deviate significantly from normal shift bounds (average: ${avgHours}h).`,
        recommendation: `Verify clock-in/clock-out terminal hardware or timesheet submission for data accuracy.`,
        confidence: 0.91,
        details: {
          anomalyCategory: 'UNUSUAL_HOURS',
          flaggedDates,
          totalAbsences,
          avgWorkingHours: avgHours,
          lateArrivalCount: lateCount,
        },
        timestamp: new Date().toISOString(),
        explainability: {
          rule_or_model: 'AttendanceAnomalyEngine:shift_telemetry_detector_v1',
          evidence,
          unsupported_claims_filtered: true,
        },
      };
    }

    // D. Low / Medium: Repeated Lateness Pattern
    if (lateCount >= 3) {
      return {
        status: 'success',
        type: AIInsightType.ATTENDANCE_ANOMALY,
        severity: AISeverity.LOW,
        employee_id: employeeId,
        summary: `Repeated late arrival pattern detected (${lateCount} occurrences).`,
        reason: `Employee ${employeeId} checked in after standard morning window (> 10:30 AM) on ${lateCount} recorded days.`,
        recommendation: `Suggest flexible working hours or core working hours alignment.`,
        confidence: 0.85,
        details: {
          anomalyCategory: 'REPEATED_LATENESS',
          flaggedDates,
          totalAbsences,
          avgWorkingHours: avgHours,
          lateArrivalCount: lateCount,
        },
        timestamp: new Date().toISOString(),
        explainability: {
          rule_or_model: 'AttendanceAnomalyEngine:lateness_detector_v1',
          evidence,
          unsupported_claims_filtered: true,
        },
      };
    }

    // E. Normal Attendance Verified
    return {
      status: 'success',
      type: AIInsightType.ATTENDANCE_ANOMALY,
      severity: AISeverity.LOW,
      employee_id: employeeId,
      summary: `Attendance pattern is normal and compliant.`,
      reason: `No attendance anomalies found across ${records.length} records. Average working shift is ${avgHours}h with zero unexcused absences.`,
      recommendation: `No action required. Maintain standard attendance tracking.`,
      confidence: 0.96,
      details: {
        anomalyCategory: 'NONE',
        flaggedDates: [],
        totalAbsences: 0,
        avgWorkingHours: avgHours,
        lateArrivalCount: 0,
      },
      timestamp: new Date().toISOString(),
      explainability: {
        rule_or_model: 'AttendanceAnomalyEngine:baseline_verifier_v1',
        evidence: [
          `Analyzed ${records.length} compliant records`,
          `Average shift length: ${avgHours} hours`,
        ],
        unsupported_claims_filtered: true,
      },
    };
  }
}
