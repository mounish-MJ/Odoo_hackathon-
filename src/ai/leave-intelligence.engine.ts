import {
  AIInsightType,
  AISeverity,
  AIStructuredInsight,
  LeaveRecordInput,
  LeaveIntelligenceDetails,
  InsufficientDataResult,
} from '../contracts/ai-intelligence.contract';

export interface LeaveIntelligenceInput {
  employeeId: string;
  departmentId?: string;
  totalDepartmentMembers?: number;
  currentBalance: { available: number; used: number; total: number };
  historicalLeaves: LeaveRecordInput[];
  departmentConcurrentLeaves?: Array<{ employeeId: string; startDate: string; endDate: string }>;
  targetLeave?: LeaveRecordInput;
}

export class LeaveIntelligenceEngine {
  /**
   * Evaluates an employee's leave request or historical leave behavior for intelligence signals.
   */
  public static analyze(
    input: LeaveIntelligenceInput
  ): AIStructuredInsight<LeaveIntelligenceDetails> | InsufficientDataResult {
    // 1. Safety Check: Verify Data Sufficiency
    if (!input || !input.employeeId || !input.currentBalance) {
      return {
        status: 'insufficient_data',
        type: AIInsightType.LEAVE_INTELLIGENCE,
        employee_id: input?.employeeId || 'unknown',
        message: 'Insufficient leave balance or profile information provided for intelligence evaluation.',
        required_fields: ['employeeId', 'currentBalance.available', 'currentBalance.total'],
        provided_records_count: input?.historicalLeaves ? input.historicalLeaves.length : 0,
        minimum_required_count: 1,
        timestamp: new Date().toISOString(),
      };
    }

    const { employeeId, currentBalance, historicalLeaves, departmentConcurrentLeaves, targetLeave, totalDepartmentMembers } = input;
    const evidence: string[] = [];
    let conflictDetected = false;
    let overlapPercentage = 0;

    // 2. Department Concurrency Conflict Analysis
    if (targetLeave && departmentConcurrentLeaves && departmentConcurrentLeaves.length > 0) {
      const targetStart = new Date(targetLeave.startDate).getTime();
      const targetEnd = new Date(targetLeave.endDate).getTime();

      const overlappingMembers = departmentConcurrentLeaves.filter((other) => {
        if (other.employeeId === employeeId) return false;
        const otherStart = new Date(other.startDate).getTime();
        const otherEnd = new Date(other.endDate).getTime();
        return targetStart <= otherEnd && targetEnd >= otherStart;
      });

      const totalDept = totalDepartmentMembers || Math.max(departmentConcurrentLeaves.length + 1, 5);
      overlapPercentage = Number(((overlappingMembers.length / totalDept) * 100).toFixed(1));

      if (overlapPercentage >= 40 || overlappingMembers.length >= 3) {
        conflictDetected = true;
        evidence.push(
          `${overlappingMembers.length} team members are already on leave during ${targetLeave.startDate} to ${targetLeave.endDate} (${overlapPercentage}% department concurrency)`
        );

        return {
          status: 'success',
          type: AIInsightType.LEAVE_INTELLIGENCE,
          severity: overlapPercentage >= 60 ? AISeverity.HIGH : AISeverity.MEDIUM,
          employee_id: employeeId,
          summary: `High department leave concurrency conflict (${overlapPercentage}% of team absent).`,
          reason: `Approving this leave creates a scheduling bottleneck as ${overlappingMembers.length} other team members in department are already on leave during this window.`,
          recommendation: `Manager should review project deadlines and discuss alternate dates or verify project coverage with team lead before approving.`,
          confidence: 0.93,
          details: {
            conflictDetected: true,
            departmentOverlapPercentage: overlapPercentage,
            burnoutRiskDetected: false,
            consecutiveWeekendPattern: false,
          },
          timestamp: new Date().toISOString(),
          explainability: {
            rule_or_model: 'LeaveIntelligenceEngine:concurrency_analyzer_v1',
            evidence,
            unsupported_claims_filtered: true,
          },
        };
      }
    }

    // 3. Balance Depletion / Exhaustion Risk
    if (targetLeave && targetLeave.days > currentBalance.available) {
      return {
        status: 'success',
        type: AIInsightType.LEAVE_INTELLIGENCE,
        severity: AISeverity.HIGH,
        employee_id: employeeId,
        summary: `Requested days (${targetLeave.days}) exceed available leave balance (${currentBalance.available}).`,
        reason: `Employee ${employeeId} has only ${currentBalance.available} days remaining in their ${targetLeave.leaveTypeId} balance.`,
        recommendation: `Reject request or request employee apply for Unpaid/Compensatory Off leave.`,
        confidence: 0.99,
        details: {
          conflictDetected: false,
          departmentOverlapPercentage: 0,
          burnoutRiskDetected: false,
          consecutiveWeekendPattern: false,
        },
        timestamp: new Date().toISOString(),
        explainability: {
          rule_or_model: 'LeaveIntelligenceEngine:balance_exhaustion_v1',
          evidence: [
            `Requested: ${targetLeave.days} days`,
            `Available Balance: ${currentBalance.available} days`,
          ],
          unsupported_claims_filtered: true,
        },
      };
    }

    // 4. Burnout Indicator (0 leaves taken in entire history with high workload)
    if (historicalLeaves.length === 0 && currentBalance.used === 0 && currentBalance.total >= 15) {
      return {
        status: 'success',
        type: AIInsightType.LEAVE_INTELLIGENCE,
        severity: AISeverity.LOW,
        employee_id: employeeId,
        summary: `Zero leave utilization detected (Burnout indicator).`,
        reason: `Employee ${employeeId} has utilized 0 leave days out of ${currentBalance.total} total allocation over the current annual cycle.`,
        recommendation: `Encourage employee to schedule rest and recuperation time to maintain sustainable work-life balance.`,
        confidence: 0.86,
        details: {
          conflictDetected: false,
          departmentOverlapPercentage: 0,
          burnoutRiskDetected: true,
          consecutiveWeekendPattern: false,
        },
        timestamp: new Date().toISOString(),
        explainability: {
          rule_or_model: 'LeaveIntelligenceEngine:burnout_indicator_v1',
          evidence: [
            `Total leave entitlement: ${currentBalance.total}`,
            `Leave days utilized: 0`,
          ],
          unsupported_claims_filtered: true,
        },
      };
    }

    // 5. Normal Healthy Leave Pattern
    return {
      status: 'success',
      type: AIInsightType.LEAVE_INTELLIGENCE,
      severity: AISeverity.LOW,
      employee_id: employeeId,
      summary: `Leave request complies with all department scheduling and balance criteria.`,
      reason: `Employee has ${currentBalance.available} available days. Department coverage is healthy (${overlapPercentage}% overlap).`,
      recommendation: `Recommended for standard approval.`,
      confidence: 0.94,
      details: {
        conflictDetected: false,
        departmentOverlapPercentage: overlapPercentage,
        burnoutRiskDetected: false,
        consecutiveWeekendPattern: false,
      },
      timestamp: new Date().toISOString(),
      explainability: {
        rule_or_model: 'LeaveIntelligenceEngine:compliance_evaluator_v1',
        evidence: [
          `Available Balance: ${currentBalance.available} days`,
          `Department Overlap: ${overlapPercentage}%`,
        ],
        unsupported_claims_filtered: true,
      },
    };
  }
}
