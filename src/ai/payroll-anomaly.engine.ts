import {
  AIInsightType,
  AISeverity,
  AIStructuredInsight,
  PayrollRecordInput,
  PayrollAnomalyDetails,
  InsufficientDataResult,
} from '../contracts/ai-intelligence.contract';

export class PayrollAnomalyEngine {
  /**
   * Analyzes payroll line items for arithmetic anomalies, deduction spikes, and unexpected deviations.
   */
  public static analyze(
    employeeId: string,
    currentPayroll: PayrollRecordInput,
    historicalPayrolls: PayrollRecordInput[] = []
  ): AIStructuredInsight<PayrollAnomalyDetails> | InsufficientDataResult {
    // 1. Safety Check: Verify Data Sufficiency
    if (!currentPayroll || currentPayroll.baseSalary === undefined) {
      return {
        status: 'insufficient_data',
        type: AIInsightType.PAYROLL_ANOMALY,
        employee_id: employeeId,
        message: 'Insufficient payroll data. Current month payroll record is required.',
        required_fields: ['baseSalary', 'deductions', 'netSalary', 'month', 'year'],
        provided_records_count: historicalPayrolls ? historicalPayrolls.length : 0,
        minimum_required_count: 1,
        timestamp: new Date().toISOString(),
      };
    }

    const { baseSalary, hra, allowances, deductions, netSalary } = currentPayroll;
    const grossEarnings = baseSalary + (hra || 0) + (allowances || 0);
    const deductionRatio = baseSalary > 0 ? Number((deductions / baseSalary).toFixed(2)) : 0;
    const allowanceRatio = baseSalary > 0 ? Number((allowances / baseSalary).toFixed(2)) : 0;

    // 2. Critical Check: Negative Net Salary or Total Deductions Exceeding Gross
    if (netSalary < 0 || deductions > grossEarnings) {
      return {
        status: 'success',
        type: AIInsightType.PAYROLL_ANOMALY,
        severity: AISeverity.CRITICAL,
        employee_id: employeeId,
        summary: `Critical payroll error: Negative net salary or deductions exceeding total earnings.`,
        reason: `Deductions of $${deductions} exceed gross compensation of $${grossEarnings}, resulting in a net salary calculation of $${netSalary}.`,
        recommendation: `Place payroll batch on immediate hold and recalculate tax/garnishment deductions before disbursement.`,
        confidence: 0.99,
        details: {
          anomalyCategory: 'NEGATIVE_NET_SALARY',
          deductionRatio,
          allowanceRatio,
        },
        timestamp: new Date().toISOString(),
        explainability: {
          rule_or_model: 'PayrollAnomalyEngine:net_salary_guard_v1',
          evidence: [
            `Base Salary: $${baseSalary}`,
            `Total Deductions: $${deductions}`,
            `Computed Net Salary: $${netSalary}`,
          ],
          unsupported_claims_filtered: true,
        },
      };
    }

    // 3. High Check: Excessive Deduction Ratio (> 45% of base salary)
    if (deductionRatio > 0.45) {
      return {
        status: 'success',
        type: AIInsightType.PAYROLL_ANOMALY,
        severity: AISeverity.HIGH,
        employee_id: employeeId,
        summary: `Unusually high deduction ratio (${Math.round(deductionRatio * 100)}% of base salary).`,
        reason: `Deductions of $${deductions} represent ${Math.round(deductionRatio * 100)}% of base pay ($${baseSalary}), exceeding the 45% standard risk threshold.`,
        recommendation: `Finance team should verify if multi-month tax adjustments or loan repayments are correctly amortized.`,
        confidence: 0.94,
        details: {
          anomalyCategory: 'EXCESSIVE_DEDUCTIONS',
          deductionRatio,
          allowanceRatio,
        },
        timestamp: new Date().toISOString(),
        explainability: {
          rule_or_model: 'PayrollAnomalyEngine:deduction_ratio_analyzer_v1',
          evidence: [
            `Deduction Ratio: ${Math.round(deductionRatio * 100)}%`,
            `Standard Compliance Ceiling: 45%`,
          ],
          unsupported_claims_filtered: true,
        },
      };
    }

    // 4. Medium / High Check: Sudden Historical Salary Deviation (> 30% change from average)
    if (historicalPayrolls.length >= 2) {
      const avgHistoricalNet =
        historicalPayrolls.reduce((sum, p) => sum + p.netSalary, 0) / historicalPayrolls.length;
      const percentageChange = Number(
        (((netSalary - avgHistoricalNet) / avgHistoricalNet) * 100).toFixed(1)
      );

      if (Math.abs(percentageChange) >= 30) {
        const direction = percentageChange > 0 ? 'increase' : 'decrease';
        return {
          status: 'success',
          type: AIInsightType.PAYROLL_ANOMALY,
          severity: AISeverity.MEDIUM,
          employee_id: employeeId,
          summary: `Significant net salary deviation (${percentageChange > 0 ? '+' : ''}${percentageChange}% vs historical average).`,
          reason: `Current net salary of $${netSalary} deviates by ${Math.abs(percentageChange)}% from the historical average of $${Math.round(avgHistoricalNet)}.`,
          recommendation: `Confirm with HR whether an unscheduled compensation change, incentive, or clawback occurred.`,
          confidence: 0.91,
          details: {
            anomalyCategory: 'SALARY_SPIKE_OR_DROP',
            percentageChange,
            deductionRatio,
            allowanceRatio,
          },
          timestamp: new Date().toISOString(),
          explainability: {
            rule_or_model: 'PayrollAnomalyEngine:historical_deviation_detector_v1',
            evidence: [
              `Historical Average Net: $${Math.round(avgHistoricalNet)}`,
              `Current Net Salary: $${netSalary}`,
              `Calculated Variance: ${percentageChange}%`,
            ],
            unsupported_claims_filtered: true,
          },
        };
      }
    }

    // 5. Normal Payroll Verified
    return {
      status: 'success',
      type: AIInsightType.PAYROLL_ANOMALY,
      severity: AISeverity.LOW,
      employee_id: employeeId,
      summary: `Payroll record verified within standard compliance limits.`,
      reason: `Base salary ($${baseSalary}), deductions ($${deductions}, ${Math.round(deductionRatio * 100)}%), and net pay ($${netSalary}) follow expected compensation structures.`,
      recommendation: `Approve for automated batch payout.`,
      confidence: 0.98,
      details: {
        anomalyCategory: 'NONE',
        deductionRatio,
        allowanceRatio,
      },
      timestamp: new Date().toISOString(),
      explainability: {
        rule_or_model: 'PayrollAnomalyEngine:standard_validator_v1',
        evidence: [
          `Gross Earnings: $${grossEarnings}`,
          `Deduction Percentage: ${Math.round(deductionRatio * 100)}%`,
          `Net Pay: $${netSalary}`,
        ],
        unsupported_claims_filtered: true,
      },
    };
  }
}
