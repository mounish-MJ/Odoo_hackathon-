# DAYFLOW — Member Integration Contracts Specification

**Author**: Member 4 — Orchestration + Security + Platform Lead  
**Scope**: Integration specifications for Member 1 (HR Core), Member 2 (AI Engine), and Member 3 (Frontend).

---

## 1. Overview & Architectural Principles

The **DAYFLOW Platform** follows strict contract-driven development. All cross-member communication occurs through typed interfaces, deterministic event envelopes, or standardized REST/SSE APIs.

- **Zero Coupling**: No member directly imports another member's internal database models or private business logic.
- **Idempotency**: All mutating operations and event triggers accept an `idempotencyKey` / `X-Idempotency-Key` header.
- **PII Redaction**: All payloads passing through platform loggers and audit services are automatically masked.
- **Correlation**: Every request and event carries a `correlationId` (`X-Request-Id`).

---

## 2. Integration with Member 1 — HR Core

Member 1 provides deterministic domain state mutations and reads via the `IHRCoreService` interface (`src/contracts/hr-core.contract.ts`).

### 2.1 Interface Definition (`IHRCoreService`)

```typescript
export interface IHRCoreService {
  // Leave Domain
  getLeaveBalance(userId: string, leaveTypeId: string): Promise<{ available: number; used: number; total: number }>;
  deductLeaveBalance(input: LeaveBalanceUpdateInput): Promise<{ success: boolean; newBalance: number }>;
  updateLeaveRequestStatus(leaveRequestId: string, status: string, approverId?: string, comments?: string): Promise<{ success: boolean; updatedRecord: Record<string, unknown> }>;

  // Attendance Domain
  recordAttendance(input: AttendanceUpdateInput): Promise<{ success: boolean; attendanceId: string }>;
  updateAttendanceStatus(attendanceId: string, status: string, notes?: string): Promise<{ success: boolean }>;

  // Payroll Domain
  processPayrollMutation(input: PayrollMutationInput): Promise<{ success: boolean; payrollId: string }>;

  // User Profile & Hierarchy Queries
  getUserProfile(userId: string): Promise<Record<string, unknown> | null>;
  getUserManager(userId: string): Promise<{ managerId: string; managerName: string; managerEmail: string } | null>;
}
```

### 2.2 Event Subscriptions Emitted by Member 1
Member 1 can publish domain events directly to the `PlatformEventBus` or via `POST /api/v1/events/publish`:
- `leave.applied`
- `attendance.marked`
- `payroll.run_initiated`
- `employee.onboarded`

---

## 3. Integration with Member 2 — AI Intelligence & Decision Engine

Member 2 provides machine learning predictions and LLM reasoning via the `IAIEngineService` interface (`src/contracts/ai-engine.contract.ts`).

### 3.1 Interface Definition (`IAIEngineService`)

```typescript
export interface IAIEngineService {
  evaluateLeaveRisk(input: LeaveRiskAssessmentInput): Promise<LeaveRiskAssessmentOutput>;
  detectAttendanceAnomaly(input: AttendanceAnomalyInput): Promise<AttendanceAnomalyOutput>;
  calculateAttritionRisk(userId: string): Promise<{ riskScore: number; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'; drivers: string[] }>;
}
```

### 3.2 Risk Assessment Schema

```typescript
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
  riskScore: number; // 0.0 (low risk) to 1.0 (high risk)
  approvalConfidence: number; // 0.0 to 1.0
  autoApproveRecommended: boolean;
  predictedApprovalTimeHours: number;
  factors: string[];
  suggestedAction: 'AUTO_APPROVE' | 'ROUTE_MANAGER' | 'ROUTE_HR' | 'FLAG_FOR_REVIEW';
  modelVersion: string;
}
```

---

## 4. Integration with Member 3 — Product Experience & Frontend

Member 3 consumes Member 4's platform services via REST APIs and real-time Server-Sent Events (SSE).

### 4.1 Base URL & Security Headers
- **Base URL**: `http://localhost:4000/api/v1`
- **Auth Header**: `Authorization: Bearer <JWT_TOKEN>`
- **Request ID Header**: `X-Request-Id: <UUID>` (Optional; generated if omitted)
- **Idempotency Header**: `X-Idempotency-Key: <UUID>` (Optional for replay protection)

### 4.2 Standard API Response Envelope

#### Success Response:
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "req_847df3a2",
    "timestamp": "2026-08-22T06:00:00.000Z"
  }
}
```

#### Error Response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | INTERNAL_ERROR",
    "message": "User-friendly safe error message",
    "details": [
      { "field": "startDate", "issue": "startDate must be in YYYY-MM-DD format" }
    ]
  }
}
```

### 4.3 Real-Time SSE Stream Endpoint
- **URL**: `GET /api/v1/notifications/stream?token=<JWT_TOKEN>`
- **Event Types Emitted**:
  - `event: connected` — Initial handshake.
  - `event: notification` — Direct user notification (e.g. leave approval, manager alert).
  - `event: broadcast_alert` — Role-based broadcast (e.g. all HR users).
  - `: ping` — 25-second heartbeat keepalive.

### 4.4 Endpoints Reference for Member 3

| Endpoint | Method | Role Allowed | Description |
| :--- | :--- | :--- | :--- |
| `/leaves/apply` | `POST` | `EMPLOYEE`, `MANAGER`, `HR`, `ADMIN` | Trigger 8-step leave workflow. |
| `/workflows/:workflowId` | `GET` | Resource Owner or `ADMIN`, `HR`, `MANAGER` | Track live workflow step results. |
| `/approvals/pending` | `GET` | `MANAGER`, `HR`, `ADMIN` | View manager approval queue. |
| `/approvals/:id/decide` | `POST` | `MANAGER`, `HR`, `ADMIN` | Submit decision (`APPROVED` / `REJECTED`). |
| `/notifications` | `GET` | All Authenticated | Get in-app notification inbox. |
| `/notifications/:id/read` | `PUT` | Resource Owner | Mark notification as read. |
| `/notifications/read-all` | `PUT` | Resource Owner | Mark all notifications as read. |
| `/audit/logs` | `GET` | `HR`, `ADMIN` | Search compliance audit logs. |
| `/webhooks/register` | `POST` | `ADMIN` | Register third-party webhook listener. |

---

## 5. Standardized Event Envelope & Canonical Event Schemas

All asynchronous domain events follow the single canonical `StandardEvent` contract:

```typescript
export interface StandardEvent<T = Record<string, unknown>> {
  eventId: string;                  // Unique UUID v4
  eventType: StandardEventType;     // One of the 9 canonical event types
  timestamp: string;                // ISO-8601 UTC timestamp
  actor: EventActor;                // { userId, role, email? }
  source: EventSource;              // e.g. 'MEMBER_1_HR_CORE', 'MEMBER_3_FRONTEND'
  resourceType: EventResourceType;  // 'leave' | 'attendance' | 'payroll' | 'employee' | 'approval' | 'notification' | 'workflow'
  resourceId: string;               // ID of the target domain resource
  correlationId: string;            // Tracing correlation ID
  version: string;                  // Event schema version ('1.0')
  payload: T;                       // Strongly typed domain payload
  aiSignals?: AISignals;            // Optional AI data metadata (cannot bypass auth/approval)
  idempotencyKey?: string;          // Optional idempotency key for deduplication
}
```

---

### 5.1 Canonical Event Schemas (The 9 Active System Events)

#### 1. `LeaveRequested`
- **Emitted By**: Member 3 (Frontend) or Member 1 (HR Core)
- **Resource Type**: `leave`
- **Payload Schema**:
  ```json
  {
    "userId": "emp_123",
    "leaveTypeId": "PAID",
    "startDate": "2026-09-01",
    "endDate": "2026-09-03",
    "days": 3,
    "reason": "Family gathering"
  }
  ```

#### 2. `LeaveApproved`
- **Emitted By**: Member 4 (Orchestrator upon Auto-Approval) or Member 3 / Member 1 (Manager/HR Approval)
- **Resource Type**: `leave`
- **Payload Schema**:
  ```json
  {
    "leaveRequestId": "LR-101",
    "userId": "emp_123",
    "daysDeducted": 3,
    "newBalance": 12,
    "approvedBy": "mgr_456",
    "approvalType": "MANAGER_APPROVAL"
  }
  ```

#### 3. `LeaveRejected`
- **Emitted By**: Member 3 / Member 1 (Manager or HR rejection)
- **Resource Type**: `leave`
- **Payload Schema**:
  ```json
  {
    "leaveRequestId": "LR-101",
    "userId": "emp_123",
    "rejectedBy": "mgr_456",
    "reason": "Critical project release milestone on requested dates"
  }
  ```

#### 4. `ApprovalRequested`
- **Emitted By**: Member 4 (Orchestration approval gate)
- **Resource Type**: `approval`
- **Payload Schema**:
  ```json
  {
    "approvalId": "appr_789",
    "workflowId": "wf_abc123",
    "workflowType": "leave-request",
    "requesterId": "emp_123",
    "assignedRoleId": "MANAGER",
    "assignedUserId": "mgr_456",
    "aiRiskScore": 0.45,
    "aiRationale": "Multi-day leave requested"
  }
  ```

#### 5. `ApprovalCompleted`
- **Emitted By**: Member 4 / Member 3 (Manager/HR decision submitted)
- **Resource Type**: `approval`
- **Payload Schema**:
  ```json
  {
    "approvalId": "appr_789",
    "workflowId": "wf_abc123",
    "decision": "APPROVED",
    "deciderId": "mgr_456",
    "comments": "Approved with team coverage confirmed"
  }
  ```

#### 6. `EmployeeUpdated`
- **Emitted By**: Member 1 (HR Core)
- **Resource Type**: `employee`
- **Payload Schema**:
  ```json
  {
    "userId": "emp_123",
    "departmentId": "engineering",
    "designation": "Staff Software Engineer",
    "reportingManagerId": "mgr_999",
    "updatedFields": ["designation", "reportingManagerId"]
  }
  ```

#### 7. `NotificationRequested`
- **Emitted By**: Any Member
- **Resource Type**: `notification`
- **Payload Schema**:
  ```json
  {
    "recipientId": "emp_123",
    "recipientRole": "EMPLOYEE",
    "title": "Leave Approved",
    "message": "Your leave request for 3 days has been approved.",
    "channels": ["IN_APP", "SSE_STREAM"]
  }
  ```

#### 8. `ActionCompleted`
- **Emitted By**: Member 1 (HR Core) or Member 4 (Platform)
- **Resource Type**: `workflow`
- **Payload Schema**:
  ```json
  {
    "actionName": "payroll.batch_mutation",
    "batchId": "PAY-2026-08",
    "processedCount": 150,
    "status": "SUCCESS"
  }
  ```

#### 9. `ActionFailed`
- **Emitted By**: Member 1 or Member 4
- **Resource Type**: `workflow`
- **Payload Schema**:
  ```json
  {
    "actionName": "leave.deduct_balance",
    "resourceId": "LR-101",
    "error": "Insufficient leave balance",
    "retryCount": 2
  }
  ```

---

## 6. Member Integration Interfaces

### 6.1 Member 1 Publish Interface (TypeScript)
```typescript
import { EventIngestionService, StandardEventType } from 'dayflow-orchestration-platform';

const ingestion = EventIngestionService.getInstance();

// Member 1 publishes an event without needing internal orchestration knowledge:
await ingestion.publishDomainEvent({
  eventType: StandardEventType.EMPLOYEE_UPDATED,
  resourceType: 'employee',
  resourceId: 'emp_123',
  actor: { userId: 'hr_lead', role: 'HR' },
  payload: { departmentId: 'engineering', title: 'Lead Architect' },
  correlationId: 'req_trace_987',
});
```

### 6.2 Member 2 AI Signals Hook
```typescript
import { EventIngestionService } from 'dayflow-orchestration-platform';

const ingestion = EventIngestionService.getInstance();

// Attach AI signals strictly as data metadata — cannot bypass auth or approval downstream
const enrichedEvent = ingestion.attachAISignals(rawEvent, {
  riskScore: 0.15,
  confidence: 0.92,
  anomalyScore: 0.04,
  factors: ['Adequate team capacity', 'Healthy leave balance'],
  suggestedAction: 'AUTO_APPROVE',
  modelVersion: 'dayflow-v2-lgbm',
});
```

### 6.3 Member 3 Read / Query & Subscription Interface
```typescript
import { EventIngestionService, StandardEventType } from 'dayflow-orchestration-platform';

const ingestion = EventIngestionService.getInstance();

// Subscribe to real-time events
const unsubscribe = ingestion.subscribeToEvent(StandardEventType.LEAVE_APPROVED, (event) => {
  console.log('Leave was approved for user:', event.payload.userId);
});

// Query events by correlationId or resourceId
const sessionEvents = ingestion.getEventsByCorrelationId('req_trace_987');
const resourceEvents = ingestion.getEventsByResource('leave', 'LR-101');
```

---

## 7. Idempotency & Deduplication Mechanism

- **Mechanism**: In-flight memory locking + 24-hour TTL completion response cache via `IdempotencyGuard`.
- **Key Strategy**: `idempotencyKey || eventId`.
- **Behavior**:
  - If an event with the same ID / key is currently in-flight, concurrent duplicates are rejected immediately with status `duplicate: true`.
  - If an event was already processed and stored, subsequent replays return the cached completion acknowledgment safely without repeating state mutations or notification blasts.

