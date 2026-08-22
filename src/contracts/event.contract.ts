import { z } from 'zod';

export enum EventType {
  // Leave Domain
  LEAVE_APPLIED = 'leave.applied',
  LEAVE_APPROVED = 'leave.approved',
  LEAVE_REJECTED = 'leave.rejected',
  LEAVE_CANCELLED = 'leave.cancelled',

  // Attendance Domain
  ATTENDANCE_MARKED = 'attendance.marked',
  ATTENDANCE_ANOMALY_DETECTED = 'attendance.anomaly_detected',
  ATTENDANCE_REGULARIZATION_REQUESTED = 'attendance.regularization_requested',

  // Payroll Domain
  PAYROLL_RUN_INITIATED = 'payroll.run_initiated',
  PAYROLL_PROCESSED = 'payroll.processed',
  PAYROLL_DISBURSED = 'payroll.disbursed',

  // Employee Lifecycle Domain
  EMPLOYEE_ONBOARDED = 'employee.onboarded',
  EMPLOYEE_UPDATED = 'employee.updated',
  EMPLOYEE_DEACTIVATED = 'employee.deactivated',

  // AI & Risk Domain
  AI_RISK_EVALUATED = 'ai.risk_evaluated',
  AI_ANOMALY_FLAGGED = 'ai.anomaly_flagged',

  // System & Security Domain
  SECURITY_ALERT = 'security.alert',
  APPROVAL_REQUIRED = 'workflow.approval_required',
  WORKFLOW_COMPLETED = 'workflow.completed',
  WORKFLOW_FAILED = 'workflow.failed',
}

export interface EventMetadata {
  correlationId: string;
  causationId?: string;
  userId?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
  traceId?: string;
  timestamp: string; // ISO 8601
  version: string;
}

export interface EventContract<T = Record<string, unknown>> {
  eventId: string;
  eventType: EventType | string;
  producerId: 'MEMBER_1_HR_CORE' | 'MEMBER_2_AI_ENGINE' | 'MEMBER_3_FRONTEND' | 'MEMBER_4_PLATFORM' | string;
  idempotencyKey: string;
  timestamp: string;
  metadata: EventMetadata;
  payload: T;
}

export const BaseEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string().min(1),
  producerId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  timestamp: z.string().datetime(),
  metadata: z.object({
    correlationId: z.string(),
    causationId: z.string().optional(),
    userId: z.string().optional(),
    userRole: z.string().optional(),
    ipAddress: z.string().optional(),
    userAgent: z.string().optional(),
    traceId: z.string().optional(),
    timestamp: z.string().datetime(),
    version: z.string().default('1.0'),
  }),
  payload: z.record(z.unknown()),
});
