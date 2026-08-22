import request from 'supertest';
import { createApp } from '../src/server';
import { AuthSecurityService } from '../src/security/auth.middleware';
import { Role } from '../src/contracts/authorization.contract';
import { AttendanceAnomalyEngine } from '../src/ai/attendance-anomaly.engine';
import { LeaveIntelligenceEngine } from '../src/ai/leave-intelligence.engine';
import { PayrollAnomalyEngine } from '../src/ai/payroll-anomaly.engine';
import { EmployeeInsightsEngine } from '../src/ai/employee-insights.engine';
import { AIOrchestratorService } from '../src/ai/ai-orchestrator.service';
import { AISeverity, AIInsightType, InsufficientDataResult } from '../src/contracts/ai-intelligence.contract';

describe('Member 4 AI & Intelligence Layer Tests', () => {
  const app = createApp();

  const employeeToken = AuthSecurityService.generateToken({
    userId: 'emp_alice_01',
    name: 'Alice Johnson',
    email: 'alice@dayflow.app',
    role: Role.EMPLOYEE,
    departmentId: 'engineering',
  });

  const otherEmployeeToken = AuthSecurityService.generateToken({
    userId: 'emp_charlie_02',
    name: 'Charlie Brown',
    email: 'charlie@dayflow.app',
    role: Role.EMPLOYEE,
    departmentId: 'engineering',
  });

  const hrToken = AuthSecurityService.generateToken({
    userId: 'hr_carol_01',
    name: 'Carol HR',
    email: 'carol.hr@dayflow.app',
    role: Role.HR,
    departmentId: 'human_resources',
  });

  const managerToken = AuthSecurityService.generateToken({
    userId: 'mgr_bob_01',
    name: 'Bob Manager',
    email: 'bob@dayflow.app',
    role: Role.MANAGER,
    departmentId: 'engineering',
  });

  // =========================================================================
  // 1. Attendance Anomaly Detection Tests
  // =========================================================================
  describe('1. Attendance Anomaly Detection', () => {
    it('returns compliant LOW severity insight for normal attendance', () => {
      const records = [
        { date: '2026-08-01', status: 'PRESENT' as const, workingHours: 8.5, checkInTime: '09:00' },
        { date: '2026-08-02', status: 'PRESENT' as const, workingHours: 8.0, checkInTime: '09:15' },
        { date: '2026-08-03', status: 'PRESENT' as const, workingHours: 8.2, checkInTime: '09:10' },
        { date: '2026-08-04', status: 'PRESENT' as const, workingHours: 8.0, checkInTime: '09:05' },
      ];

      const insight = AttendanceAnomalyEngine.analyze('emp_alice_01', records);
      expect(insight.status).toBe('success');
      if (insight.status === 'success') {
        expect(insight.type).toBe(AIInsightType.ATTENDANCE_ANOMALY);
        expect(insight.severity).toBe(AISeverity.LOW);
        expect(insight.confidence).toBeGreaterThan(0.9);
        expect(insight.details?.anomalyCategory).toBe('NONE');
        expect(insight.explainability.unsupported_claims_filtered).toBe(true);
      }
    });

    it('detects anomalous working shift length (> 14 hours)', () => {
      const records = [
        { date: '2026-08-01', status: 'PRESENT' as const, workingHours: 8.0, checkInTime: '09:00' },
        { date: '2026-08-02', status: 'PRESENT' as const, workingHours: 16.5, checkInTime: '08:00' }, // Anomaly
        { date: '2026-08-03', status: 'PRESENT' as const, workingHours: 8.0, checkInTime: '09:00' },
      ];

      const insight = AttendanceAnomalyEngine.analyze('emp_alice_01', records);
      expect(insight.status).toBe('success');
      if (insight.status === 'success') {
        expect(insight.details?.anomalyCategory).toBe('UNUSUAL_HOURS');
        expect(insight.details?.flaggedDates).toContain('2026-08-02');
        expect(insight.reason).toContain('deviate significantly from normal shift bounds');
      }
    });

    it('detects repeated consecutive absences (>= 3 days)', () => {
      const records = [
        { date: '2026-08-01', status: 'PRESENT' as const, workingHours: 8.0 },
        { date: '2026-08-02', status: 'ABSENT' as const },
        { date: '2026-08-03', status: 'ABSENT' as const },
        { date: '2026-08-04', status: 'ABSENT' as const },
        { date: '2026-08-05', status: 'ABSENT' as const },
      ];

      const insight = AttendanceAnomalyEngine.analyze('emp_alice_01', records);
      expect(insight.status).toBe('success');
      if (insight.status === 'success') {
        expect(insight.details?.anomalyCategory).toBe('CONSECUTIVE_ABSENCES');
        expect([AISeverity.HIGH, AISeverity.CRITICAL]).toContain(insight.severity);
        expect(insight.recommendation).toContain('welfare check-in');
      }
    });

    it('detects Monday/Friday absence clustering pattern', () => {
      // 2026-08-07 = Friday, 2026-08-10 = Monday, 2026-08-14 = Friday
      const records = [
        { date: '2026-08-07', status: 'ABSENT' as const },
        { date: '2026-08-10', status: 'ABSENT' as const },
        { date: '2026-08-11', status: 'PRESENT' as const, workingHours: 8.0 },
        { date: '2026-08-12', status: 'PRESENT' as const, workingHours: 8.0 },
        { date: '2026-08-14', status: 'ABSENT' as const },
      ];

      const insight = AttendanceAnomalyEngine.analyze('emp_alice_01', records);
      expect(insight.status).toBe('success');
      if (insight.status === 'success') {
        expect(insight.details?.anomalyCategory).toBe('MONDAY_FRIDAY_PATTERN');
        expect(insight.reason).toContain('weekend extension pattern');
      }
    });
  });

  // =========================================================================
  // 2. Leave Intelligence Tests
  // =========================================================================
  describe('2. Leave Intelligence & Concurrency Analysis', () => {
    it('returns compliant LOW severity for safe leave request with adequate team coverage', () => {
      const insight = LeaveIntelligenceEngine.analyze({
        employeeId: 'emp_alice_01',
        currentBalance: { available: 15, used: 2, total: 20 },
        historicalLeaves: [
          { leaveTypeId: 'PAID', startDate: '2026-03-01', endDate: '2026-03-02', days: 2, status: 'APPROVED' },
        ],
        targetLeave: { leaveTypeId: 'PAID', startDate: '2026-09-01', endDate: '2026-09-02', days: 2, status: 'PENDING' },
      });

      expect(insight.status).toBe('success');
      if (insight.status === 'success') {
        expect(insight.type).toBe(AIInsightType.LEAVE_INTELLIGENCE);
        expect(insight.severity).toBe(AISeverity.LOW);
        expect(insight.details?.conflictDetected).toBe(false);
      }
    });

    it('detects department concurrency conflict when multiple teammates are on leave', () => {
      const insight = LeaveIntelligenceEngine.analyze({
        employeeId: 'emp_alice_01',
        totalDepartmentMembers: 5,
        currentBalance: { available: 10, used: 5, total: 20 },
        historicalLeaves: [],
        departmentConcurrentLeaves: [
          { employeeId: 'emp_bob', startDate: '2026-09-15', endDate: '2026-09-18' },
          { employeeId: 'emp_charlie', startDate: '2026-09-14', endDate: '2026-09-16' },
          { employeeId: 'emp_david', startDate: '2026-09-15', endDate: '2026-09-20' },
        ],
        targetLeave: { leaveTypeId: 'PAID', startDate: '2026-09-15', endDate: '2026-09-17', days: 3, status: 'PENDING' },
      });

      expect(insight.status).toBe('success');
      if (insight.status === 'success') {
        expect(insight.details?.conflictDetected).toBe(true);
        expect(insight.details?.departmentOverlapPercentage).toBeGreaterThanOrEqual(40);
        expect(insight.severity).toBe(AISeverity.HIGH);
        expect(insight.summary).toContain('concurrency conflict');
      }
    });

    it('detects balance exhaustion when requested days exceed available days', () => {
      const insight = LeaveIntelligenceEngine.analyze({
        employeeId: 'emp_alice_01',
        currentBalance: { available: 2, used: 18, total: 20 },
        historicalLeaves: [],
        targetLeave: { leaveTypeId: 'PAID', startDate: '2026-10-01', endDate: '2026-10-06', days: 5, status: 'PENDING' },
      });

      expect(insight.status).toBe('success');
      if (insight.status === 'success') {
        expect(insight.severity).toBe(AISeverity.HIGH);
        expect(insight.summary).toContain('exceed available leave balance');
      }
    });

    it('identifies burnout risk when zero leaves are utilized over the year', () => {
      const insight = LeaveIntelligenceEngine.analyze({
        employeeId: 'emp_alice_01',
        currentBalance: { available: 20, used: 0, total: 20 },
        historicalLeaves: [],
      });

      expect(insight.status).toBe('success');
      if (insight.status === 'success') {
        expect(insight.details?.burnoutRiskDetected).toBe(true);
        expect(insight.summary).toContain('Burnout indicator');
      }
    });
  });

  // =========================================================================
  // 3. Payroll Anomaly Detection Tests
  // =========================================================================
  describe('3. Payroll Anomaly Detection', () => {
    it('returns compliant LOW severity for normal payroll calculation', () => {
      const current = {
        month: 8,
        year: 2026,
        baseSalary: 8000,
        hra: 2000,
        allowances: 1000,
        deductions: 1500,
        netSalary: 9500,
      };

      const insight = PayrollAnomalyEngine.analyze('emp_alice_01', current);
      expect(insight.status).toBe('success');
      if (insight.status === 'success') {
        expect(insight.type).toBe(AIInsightType.PAYROLL_ANOMALY);
        expect(insight.severity).toBe(AISeverity.LOW);
        expect(insight.confidence).toBeGreaterThan(0.95);
      }
    });

    it('flags CRITICAL severity on negative net salary or deductions exceeding earnings', () => {
      const anomalousPayroll = {
        month: 8,
        year: 2026,
        baseSalary: 5000,
        hra: 1000,
        allowances: 500,
        deductions: 8000, // Deductions exceed gross earnings
        netSalary: -1500,
      };

      const insight = PayrollAnomalyEngine.analyze('emp_alice_01', anomalousPayroll);
      expect(insight.status).toBe('success');
      if (insight.status === 'success') {
        expect(insight.severity).toBe(AISeverity.CRITICAL);
        expect(insight.details?.anomalyCategory).toBe('NEGATIVE_NET_SALARY');
        expect(insight.summary).toContain('Negative net salary');
      }
    });

    it('flags HIGH severity on excessive deductions (> 45% of base salary)', () => {
      const anomalousPayroll = {
        month: 8,
        year: 2026,
        baseSalary: 6000,
        hra: 1000,
        allowances: 500,
        deductions: 3600, // 60% of base salary
        netSalary: 3900,
      };

      const insight = PayrollAnomalyEngine.analyze('emp_alice_01', anomalousPayroll);
      expect(insight.status).toBe('success');
      if (insight.status === 'success') {
        expect(insight.severity).toBe(AISeverity.HIGH);
        expect(insight.details?.anomalyCategory).toBe('EXCESSIVE_DEDUCTIONS');
        expect(insight.summary).toContain('high deduction ratio');
      }
    });

    it('flags unexpected historical salary deviation (> 30% jump or drop)', () => {
      const history = [
        { month: 5, year: 2026, baseSalary: 5000, hra: 1000, allowances: 500, deductions: 500, netSalary: 6000 },
        { month: 6, year: 2026, baseSalary: 5000, hra: 1000, allowances: 500, deductions: 500, netSalary: 6000 },
        { month: 7, year: 2026, baseSalary: 5000, hra: 1000, allowances: 500, deductions: 500, netSalary: 6000 },
      ];

      const spikePayroll = {
        month: 8,
        year: 2026,
        baseSalary: 8500,
        hra: 1000,
        allowances: 500,
        deductions: 500,
        netSalary: 9500, // +58% spike
      };

      const insight = PayrollAnomalyEngine.analyze('emp_alice_01', spikePayroll, history);
      expect(insight.status).toBe('success');
      if (insight.status === 'success') {
        expect(insight.details?.anomalyCategory).toBe('SALARY_SPIKE_OR_DROP');
        expect(insight.summary).toContain('salary deviation');
      }
    });
  });

  // =========================================================================
  // 4. Employee Holistic Insights Synthesis Tests
  // =========================================================================
  describe('4. Employee Holistic Insights Synthesis', () => {
    it('synthesizes comprehensive profile data into explainable engagement & retention scores', () => {
      const profile = {
        employeeId: 'emp_alice_01',
        name: 'Alice Johnson',
        departmentId: 'engineering',
        tenureMonths: 14,
        attendanceRecords: [
          { date: '2026-08-01', status: 'PRESENT' as const, workingHours: 8.5 },
          { date: '2026-08-02', status: 'PRESENT' as const, workingHours: 8.0 },
          { date: '2026-08-03', status: 'PRESENT' as const, workingHours: 8.0 },
          { date: '2026-08-04', status: 'PRESENT' as const, workingHours: 8.5 },
        ],
        leaveBalance: { available: 12, used: 8, total: 20 },
        leaveHistory: [
          { leaveTypeId: 'PAID', startDate: '2026-04-10', endDate: '2026-04-15', days: 5, status: 'APPROVED' },
        ],
        payrollHistory: [
          { month: 7, year: 2026, baseSalary: 7000, hra: 1000, allowances: 500, deductions: 500, netSalary: 8000 },
        ],
      };

      const insight = EmployeeInsightsEngine.generateInsights(profile);
      expect(insight.status).toBe('success');
      if (insight.status === 'success') {
        expect(insight.type).toBe(AIInsightType.EMPLOYEE_INSIGHT);
        expect(insight.details?.engagementScore).toBeGreaterThanOrEqual(80);
        expect(insight.details?.retentionRiskLevel).toBe('LOW');
        expect(insight.details?.keyStrengths.length).toBeGreaterThan(0);
        expect(insight.explainability.unsupported_claims_filtered).toBe(true);
      }
    });
  });

  // =========================================================================
  // 5. Insufficient Data & Safety Verification
  // =========================================================================
  describe('5. Safety, Insufficient Data & Fallback Protection', () => {
    it('returns explicit insufficient_data when attendance records are fewer than 3', () => {
      const records = [
        { date: '2026-08-01', status: 'PRESENT' as const, workingHours: 8.0 },
      ];

      const result = AttendanceAnomalyEngine.analyze('emp_alice_01', records) as InsufficientDataResult;
      expect(result.status).toBe('insufficient_data');
      expect(result.minimum_required_count).toBe(3);
      expect(result.provided_records_count).toBe(1);
      expect(result.message).toContain('Insufficient attendance records');
    });

    it('returns deterministic fallback when an unexpected exception occurs', () => {
      const aiService = AIOrchestratorService.getInstance();
      // Pass null as records to trigger internal catch fallback
      const fallbackResult = aiService.analyzeAttendance('emp_alice_01', null as any);
      expect(fallbackResult.status).toBe('insufficient_data');
    });
  });

  // =========================================================================
  // 6. Backend-Mediated REST Endpoints (Member 3 Integration)
  // =========================================================================
  describe('6. Backend-Mediated REST Endpoints', () => {
    it('POST /api/v1/ai/attendance/analyze allows employee to inspect own telemetry', async () => {
      const res = await request(app)
        .post('/api/v1/ai/attendance/analyze')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          employeeId: 'emp_alice_01',
          records: [
            { date: '2026-08-01', status: 'PRESENT', workingHours: 8.0 },
            { date: '2026-08-02', status: 'PRESENT', workingHours: 8.0 },
            { date: '2026-08-03', status: 'PRESENT', workingHours: 8.0 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('attendance_anomaly');
    });

    it('POST /api/v1/ai/attendance/analyze blocks Employee A from inspecting Employee B telemetry', async () => {
      const res = await request(app)
        .post('/api/v1/ai/attendance/analyze')
        .set('Authorization', `Bearer ${otherEmployeeToken}`)
        .send({
          employeeId: 'emp_alice_01', // Requesting Alice's telemetry with Charlie's token
          records: [
            { date: '2026-08-01', status: 'PRESENT', workingHours: 8.0 },
            { date: '2026-08-02', status: 'PRESENT', workingHours: 8.0 },
            { date: '2026-08-03', status: 'PRESENT', workingHours: 8.0 },
          ],
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('POST /api/v1/ai/payroll/analyze enforces HR/Admin role restriction', async () => {
      // Employee should get 403 Forbidden
      const empRes = await request(app)
        .post('/api/v1/ai/payroll/analyze')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          employeeId: 'emp_alice_01',
          currentPayroll: { baseSalary: 5000, deductions: 500, netSalary: 4500, month: 8, year: 2026 },
        });
      expect(empRes.status).toBe(403);

      // HR should get 200 OK
      const hrRes = await request(app)
        .post('/api/v1/ai/payroll/analyze')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          employeeId: 'emp_alice_01',
          currentPayroll: { baseSalary: 5000, deductions: 500, netSalary: 4500, month: 8, year: 2026 },
        });
      expect(hrRes.status).toBe(200);
      expect(hrRes.body.data.type).toBe('payroll_anomaly');
    });

    it('POST /api/v1/ai/leaves/analyze evaluates leave request for Manager', async () => {
      const res = await request(app)
        .post('/api/v1/ai/leaves/analyze')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          employeeId: 'emp_alice_01',
          currentBalance: { available: 12, used: 8, total: 20 },
          historicalLeaves: [],
          targetLeave: { leaveTypeId: 'PAID', startDate: '2026-09-10', endDate: '2026-09-11', days: 2, status: 'PENDING' },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('leave_intelligence');
    });
  });
});
