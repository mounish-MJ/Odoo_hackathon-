import { BaseWorkflow } from './base.workflow';
import { WorkflowContext } from '../../contracts/workflow.contract';
import { IHRCoreService } from '../../contracts/hr-core.contract';
import { NotificationChannel, NotificationType } from '../../contracts/notification.contract';
import { Role } from '../../contracts/authorization.contract';
import { RbacSecurityGuard } from '../../security/rbac.guard';

export interface PayrollProcessPayload {
  month: number;
  year: number;
  initiatedByUserId: string;
  departmentId?: string;
  employees?: Array<{
    userId: string;
    baseSalary: number;
    hra: number;
    allowances: number;
    deductions: number;
  }>;
}

export interface PayrollProcessResult {
  batchId: string;
  month: number;
  year: number;
  processedCount: number;
  totalDisbursement: number;
  status: string;
}

export class PayrollProcessWorkflow extends BaseWorkflow<
  PayrollProcessPayload,
  PayrollProcessResult
> {
  public workflowType = 'payroll-process';

  private hrCoreService: IHRCoreService;

  constructor(hrCoreService: IHRCoreService) {
    super();
    this.hrCoreService = hrCoreService;
  }

  // 1. Validation
  public async validateEvent(
    context: WorkflowContext<PayrollProcessPayload, PayrollProcessResult>
  ): Promise<boolean> {
    const p = context.event.payload;
    if (!p.month || !p.year || p.month < 1 || p.month > 12) {
      throw new Error('Invalid payroll month or year');
    }
    return true;
  }

  // 2. Permission Check (HR / Admin only)
  public async checkPermissions(
    context: WorkflowContext<PayrollProcessPayload, PayrollProcessResult>
  ): Promise<boolean> {
    const user = context.user || {
      userId: context.event.payload.initiatedByUserId,
      email: '',
      name: '',
      role: Role.HR,
    };

    return RbacSecurityGuard.canExecuteAction(user, {
      resourceType: 'payroll',
      action: 'create',
    });
  }

  // 3. Risk Evaluation
  public async evaluateRisk(
    context: WorkflowContext<PayrollProcessPayload, PayrollProcessResult>
  ): Promise<{ riskScore?: number; confidence?: number; decision: 'AUTO_PROCEED' | 'REQUIRE_APPROVAL' | 'REJECT' }> {
    const p = context.event.payload;
    // Check if payroll payload contains negative numbers
    if (p.employees) {
      const hasNegative = p.employees.some((e) => e.baseSalary < 0 || e.deductions < 0);
      if (hasNegative) {
        return { riskScore: 0.95, confidence: 1.0, decision: 'REJECT' };
      }
    }
    return { riskScore: 0.05, confidence: 0.98, decision: 'AUTO_PROCEED' };
  }

  // 4. Deterministic Core Action (Member 1 Payroll Processing)
  public async executeDeterministicAction(
    context: WorkflowContext<PayrollProcessPayload, PayrollProcessResult>
  ): Promise<PayrollProcessResult> {
    const p = context.event.payload;
    const batchId = `PAY-BATCH-${p.year}-${String(p.month).padStart(2, '0')}`;

    let processedCount = 0;
    let totalDisbursement = 0;

    const employees = p.employees || [
      { userId: 'emp_demo_1', baseSalary: 60000, hra: 24000, allowances: 5000, deductions: 4000 },
      { userId: 'emp_demo_2', baseSalary: 75000, hra: 30000, allowances: 6000, deductions: 5000 },
    ];

    for (const emp of employees) {
      const netSalary = emp.baseSalary + emp.hra + emp.allowances - emp.deductions;
      await this.hrCoreService.processPayrollMutation({
        userId: emp.userId,
        month: p.month,
        year: p.year,
        baseSalary: emp.baseSalary,
        hra: emp.hra,
        allowances: emp.allowances,
        deductions: emp.deductions,
        netSalary,
        paymentStatus: 'PROCESSED',
      });
      processedCount++;
      totalDisbursement += netSalary;
    }

    return {
      batchId,
      month: p.month,
      year: p.year,
      processedCount,
      totalDisbursement,
      status: 'PROCESSED',
    };
  }

  // 5. Verification
  public async verifyAction(
    _context: WorkflowContext<PayrollProcessPayload, PayrollProcessResult>,
    actionResult: PayrollProcessResult
  ): Promise<boolean> {
    return actionResult.processedCount > 0 && actionResult.status === 'PROCESSED';
  }

  // 6. Notification Dispatch
  public async dispatchNotifications(
    context: WorkflowContext<PayrollProcessPayload, PayrollProcessResult>
  ): Promise<void> {
    const p = context.event.payload;
    const res = context.output;

    // Send broadcast alert to HR & Admin
    await this.notificationService.broadcast(Role.HR, {
      type: NotificationType.PAYROLL_UPDATE,
      title: `Payroll Processed for ${p.month}/${p.year}`,
      message: `Batch ${res?.batchId} processed successfully for ${res?.processedCount} employees. Total: $${res?.totalDisbursement?.toLocaleString()}`,
      channels: [NotificationChannel.IN_APP, NotificationChannel.SSE_STREAM],
      data: {
        batchId: res?.batchId,
        month: p.month,
        year: p.year,
        count: res?.processedCount,
      },
    });
  }

  // 7. Audit Event Creation (with PII-safe masking)
  public async recordAuditEvent(
    context: WorkflowContext<PayrollProcessPayload, PayrollProcessResult>
  ): Promise<void> {
    const p = context.event.payload;
    const res = context.output;

    await this.auditService.recordAudit({
      userId: p.initiatedByUserId,
      userRole: Role.HR,
      action: 'PAYROLL.BATCH_PROCESSED',
      resourceType: 'payroll',
      resourceId: res?.batchId,
      newData: {
        batchId: res?.batchId,
        month: p.month,
        year: p.year,
        processedCount: res?.processedCount,
        totalDisbursement: res?.totalDisbursement,
      },
      status: 'SUCCESS',
      metadata: {
        workflowId: context.workflowId,
      },
    });
  }
}
