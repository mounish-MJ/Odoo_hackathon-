import { z } from 'zod';

/**
 * -------------------------------------------------------------
 * Canonical Event Types for DAYFLOW HR Operating System
 * (Only events the system actively requires right now)
 * -------------------------------------------------------------
 */
export enum StandardEventType {
  LEAVE_REQUESTED = 'LeaveRequested',
  LEAVE_APPROVED = 'LeaveApproved',
  LEAVE_REJECTED = 'LeaveRejected',
  APPROVAL_REQUESTED = 'ApprovalRequested',
  APPROVAL_COMPLETED = 'ApprovalCompleted',
  EMPLOYEE_UPDATED = 'EmployeeUpdated',
  NOTIFICATION_REQUESTED = 'NotificationRequested',
  ACTION_COMPLETED = 'ActionCompleted',
  ACTION_FAILED = 'ActionFailed',
}

// Backward compatibility alias enum
export enum EventType {
  LEAVE_APPLIED = 'LeaveRequested',
  LEAVE_APPROVED = 'LeaveApproved',
  LEAVE_REJECTED = 'LeaveRejected',
  APPROVAL_REQUIRED = 'ApprovalRequested',
  APPROVAL_COMPLETED = 'ApprovalCompleted',
  EMPLOYEE_UPDATED = 'EmployeeUpdated',
  NOTIFICATION_REQUESTED = 'NotificationRequested',
  WORKFLOW_COMPLETED = 'ActionCompleted',
  WORKFLOW_FAILED = 'ActionFailed',

  // Domain aliases
  ATTENDANCE_MARKED = 'AttendanceMarked',
  ATTENDANCE_ANOMALY_DETECTED = 'AttendanceAnomalyDetected',
  PAYROLL_RUN_INITIATED = 'PayrollRunInitiated',
  PAYROLL_PROCESSED = 'PayrollProcessed',
}

/**
 * -------------------------------------------------------------
 * Event Actor & Source Representation
 * -------------------------------------------------------------
 */
export interface EventActor {
  userId: string;
  role: string;
  email?: string;
}

export type EventSource =
  | 'MEMBER_1_HR_CORE'
  | 'MEMBER_2_AI_ENGINE'
  | 'MEMBER_3_FRONTEND'
  | 'MEMBER_4_PLATFORM'
  | string;

export type EventResourceType =
  | 'leave'
  | 'attendance'
  | 'payroll'
  | 'employee'
  | 'approval'
  | 'notification'
  | 'workflow'
  | 'document';

/**
 * -------------------------------------------------------------
 * Member 2 AI Signals Hook (Data field only — NOT a control-flow shortcut)
 * -------------------------------------------------------------
 */
export interface AISignals {
  riskScore?: number; // 0.0 (low risk) to 1.0 (high risk)
  confidence?: number; // 0.0 to 1.0
  predictedCategory?: string;
  anomalyScore?: number;
  factors?: string[];
  rationale?: string;
  suggestedAction?: string;
  modelVersion?: string;
  timestamp?: string;
}

/**
 * -------------------------------------------------------------
 * Legacy Event Metadata (Preserved for compatibility)
 * -------------------------------------------------------------
 */
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

/**
 * -------------------------------------------------------------
 * Standardized Unified Event Contract
 * -------------------------------------------------------------
 */
export interface StandardEvent<T = Record<string, unknown>> {
  eventId: string;
  eventType: StandardEventType | string;
  timestamp: string; // ISO 8601
  actor?: EventActor;
  source?: EventSource;
  producerId?: EventSource;
  resourceType?: EventResourceType | string;
  resourceId?: string;
  correlationId?: string;
  version?: string;
  payload: T;
  aiSignals?: AISignals;
  idempotencyKey?: string;
  metadata?: EventMetadata;
}

// Backward-compatible type alias
export type EventContract<T = Record<string, unknown>> = StandardEvent<T>;

/**
 * -------------------------------------------------------------
 * Zod Ingestion Validation Schemas
 * -------------------------------------------------------------
 */
export const EventActorSchema = z.object({
  userId: z.string().min(1, 'actor.userId is required'),
  role: z.string().min(1, 'actor.role is required'),
  email: z.string().email().optional(),
});

export const AISignalsSchema = z.object({
  riskScore: z.number().min(0).max(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
  predictedCategory: z.string().optional(),
  anomalyScore: z.number().min(0).max(1).optional(),
  factors: z.array(z.string()).optional(),
  rationale: z.string().optional(),
  suggestedAction: z.string().optional(),
  modelVersion: z.string().optional(),
  timestamp: z.string().optional(),
});

export const StandardEventSchema = z.object({
  eventId: z.string().min(1, 'eventId is required'),
  eventType: z.string().min(1, 'eventType is required'),
  timestamp: z.string().min(1, 'timestamp is required'),
  actor: EventActorSchema,
  source: z.string().min(1, 'source is required'),
  resourceType: z.string().min(1, 'resourceType is required'),
  resourceId: z.string().min(1, 'resourceId is required'),
  correlationId: z.string().min(1, 'correlationId is required'),
  version: z.string().default('1.0'),
  payload: z.record(z.unknown()),
  aiSignals: AISignalsSchema.optional(),
  idempotencyKey: z.string().optional(),
  metadata: z
    .object({
      correlationId: z.string().optional(),
      causationId: z.string().optional(),
      userId: z.string().optional(),
      userRole: z.string().optional(),
      ipAddress: z.string().optional(),
      userAgent: z.string().optional(),
      traceId: z.string().optional(),
      timestamp: z.string().optional(),
      version: z.string().optional(),
    })
    .optional(),
});

// Legacy schema alias
export const BaseEventSchema = StandardEventSchema;
