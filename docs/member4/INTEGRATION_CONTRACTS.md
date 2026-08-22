# DAYFLOW — Cross-Member Integration Contracts Specification

**Author**: Member 4 — Orchestration + Security + Platform Lead  
**Scope**: Integration specifications for Member 1 (HR Core), Member 2 (AI Engine), and Member 3 (Product Experience & Frontend).  
**Repository Branch**: `Sxree__06`

---

## 1. Overview & Architectural Principles

The **DAYFLOW Platform** follows strict contract-driven development. All cross-member communication occurs through typed interfaces, deterministic event envelopes, or standardized REST/SSE APIs.

- **Zero Coupling**: No member directly imports another member's internal database models or private business logic.
- **Strict Role Separation**:
  - **Member 1** owns HR Core, Employee domain logic, Attendance, Leave balance, Payroll mutations, and Organization structure.
  - **Member 2** owns AI models, agents, decision engines, prompts, reasoning, and risk scoring.
  - **Member 3** owns Frontend pages, UI/UX components, dashboards, and client-side presentation.
  - **Member 4** owns Orchestration pipeline, Security & RBAC perimeter, Event infrastructure, Notification engine, Audit trail, and Request tracing.
- **Idempotency**: All mutating operations and event triggers accept an `idempotencyKey` / `X-Idempotency-Key` header.
- **PII & Secret Redaction**: All payloads passing through platform loggers, notifications, and audit services are automatically masked.
- **Correlation**: Every request and event carries a `correlationId` (`X-Request-Id`).

```text
       ┌─────────────────────────────────────────────────────────────┐
       │              MEMBER 3: FRONTEND (React / UI)                │
       └──────────────┬───────────────────────────────▲──────────────┘
                      │ REST API Calls                │ SSE Stream & Notifications
                      ▼                               │
       ┌──────────────────────────────────────────────┴──────────────┐
       │           MEMBER 4: PLATFORM & ORCHESTRATOR                 │
       │   (Security Perimeter, Event Bus, State Machine, Audit)     │
       └───┬─────────────────────────────────────────────────────┬───┘
           │ AI Risk Queries (IAIEngineService)                   │ HR Core Mutations (IHRCoreService)
           ▼                                                     ▼
┌───────────────────────────┐                         ┌───────────────────────────┐
│   MEMBER 2: AI ENGINE     │                         │   MEMBER 1: HR CORE       │
│  (Risk Scoring, Anomaly)  │                         │ (Balances, Records, DB)   │
└───────────────────────────┘                         └───────────────────────────┘
```

---

## 2. Integration 1 — Member 1 (System Architecture & HR Core)

Member 4 consumes Member 1's HR Core services through typed contracts (`IHRCoreService`) and adapters without taking ownership of HR business logic or duplicating database models.

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

### 2.2 HTTP Adapter & Live Integration (`HttpHRCoreService`)
- **Configured via**: `process.env.MEMBER1_HR_CORE_URL` (default: `http://localhost:8000/api/v1`)
- **Endpoints Consumed**:
  - `GET /leaves/balances?userId={userId}&leaveTypeId={leaveTypeId}`
  - `POST /leaves/deduct-balance`
  - `PUT /leaves/{leaveRequestId}/status`
  - `POST /attendance/check-in`
  - `POST /payroll/mutate`
  - `GET /employees/{userId}/manager`
- **Fallback Mechanism**: If Member 1's Python/FastAPI service is offline or undergoing migrations, `HttpHRCoreService` automatically falls back to deterministic rule ledger to prevent platform crashes.

### 2.3 Member 1 Event Ingestion
Member 1 can publish domain events directly to the platform event bus without knowing internal orchestration logic:
```typescript
import { EventIngestionService, StandardEventType } from 'dayflow-orchestration-platform';

const ingestion = EventIngestionService.getInstance();
await ingestion.publishDomainEvent({
  eventType: StandardEventType.EMPLOYEE_UPDATED,
  resourceType: 'employee',
  resourceId: 'emp_123',
  actor: { userId: 'hr_lead', role: 'HR' },
  payload: { departmentId: 'engineering', designation: 'Staff Software Engineer' },
  correlationId: 'trace_hr_01',
});
```

---

## 3. Integration 2 — Member 2 (AI Intelligence & Decision Engine)

Member 4 consumes AI evaluations and risk predictions from Member 2 through typed contracts (`IAIEngineService`).

### 3.1 Critical Security Rule for AI Integration
> [!IMPORTANT]
> **AI Must Never Override Security Perimeter**:
> 1. AI output is treated strictly as an **advisory decision input** or metadata signal.
> 2. AI recommendations **cannot bypass** authentication, RBAC authorization, manager approval gates, deterministic balance verification, or audit logging.
> 3. Even if AI recommends `AUTO_APPROVE`, the request must still pass through valid employee credentials, non-negative balance checks, and security guards.

### 3.2 Interface Definition (`IAIEngineService`)

```typescript
export interface IAIEngineService {
  evaluateLeaveRisk(input: LeaveRiskAssessmentInput): Promise<LeaveRiskAssessmentOutput>;
  detectAttendanceAnomaly(input: AttendanceAnomalyInput): Promise<AttendanceAnomalyOutput>;
  calculateAttritionRisk(userId: string): Promise<{ riskScore: number; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'; drivers: string[] }>;
}

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
```

### 3.3 HTTP Adapter & Live Integration (`HttpAIEngineService`)
- **Configured via**: `process.env.MEMBER2_AI_ENGINE_URL` (default: `http://localhost:8000/api/v1/ai`)
- **Endpoints Consumed**:
  - `POST /evaluate-leave-risk`
  - `POST /detect-attendance-anomaly`
  - `POST /attrition-risk/{userId}`
- **Fallback Mechanism**: Deterministic rule-based risk scoring (≤ 2 days: 0.15 low risk, > 2 days: 0.45 moderate risk) if Member 2's FastAPI service is offline.

---

## 4. Integration 3 — Member 3 (Product Experience & Frontend)

Member 4 provides clean REST APIs and real-time Server-Sent Events (SSE) for Member 3 to consume.

### 4.1 Base URL & Security Headers
- **Base URL**: `http://localhost:4000/api/v1`
- **Auth Header**: `Authorization: Bearer <JWT_TOKEN>`
- **Request ID Header**: `X-Request-Id: <UUID>` (Preserved throughout execution)
- **Idempotency Header**: `X-Idempotency-Key: <UUID>` (For duplicate replay protection)

### 4.2 Standard API Response Envelopes

#### Success Envelope:
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

#### Error Envelope:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | INTERNAL_ERROR",
    "message": "Human-readable description without stack traces",
    "details": [
      { "field": "startDate", "issue": "startDate must be in YYYY-MM-DD format" }
    ]
  }
}
```

### 4.3 Real-Time SSE Stream Endpoint
- **URL**: `GET /api/v1/notifications/stream?token=<JWT_TOKEN>`
- **Event Types Emitted**:
  - `event: connected` — Initial connection handshake with clientId.
  - `event: notification` — Direct user notification (e.g. leave status update, manager approval alert).
  - `event: broadcast_alert` — Role-based broadcast alerts (e.g. all HR users).
  - `: ping` — 25-second heartbeat keepalive to prevent browser timeout.

### 4.4 Complete REST API Surface for Member 3

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Public | Platform health & component diagnostics. |
| `POST` | `/leaves/apply` | `EMPLOYEE`, `MANAGER`, `HR`, `ADMIN` | Submits leave request and initiates 8-step orchestration. |
| `GET` | `/workflows/:workflowId` | Resource Owner, `MANAGER`, `HR`, `ADMIN` | Queries live workflow execution progress and step durations. |
| `GET` | `/approvals/pending` | `MANAGER`, `HR`, `ADMIN` | Queries the caller's queue of pending approvals. |
| `GET` | `/approvals/:approvalId` | Requester, Approver, `HR`, `ADMIN` | Fetches full approval state and linked workflow metadata. |
| `GET` | `/approvals/workflow/:workflowId` | Requester, Approver, `HR`, `ADMIN` | Fetches approval record linked to a specific workflow execution. |
| `POST` | `/approvals/:approvalId/decide` | `MANAGER`, `HR`, `ADMIN` | Submits approval or rejection decision (`APPROVED` / `REJECTED`). |
| `GET` | `/notifications` | All Authenticated | Retrieves in-app notifications (supports `unread_only=true`, `limit`). |
| `PUT` | `/notifications/:id/read` | Resource Owner | Marks a single notification as read. |
| `PUT` | `/notifications/read-all` | Resource Owner | Marks all user notifications as read. |
| `GET` | `/audit/logs` | `HR`, `ADMIN` | Queries immutable compliance audit logs with rich filters. |
| `GET` | `/audit/logs/:auditId` | `HR`, `ADMIN` | Retrieves single immutable audit record with diff. |
| `POST` | `/webhooks/register` | `ADMIN` | Registers third-party webhook listener with HMAC secret. |

---

## 5. Workflow State Machine Specification

Workflows transition strictly through validated sequential states. Unsanctioned state jumps throw `IllegalStateTransitionError`:

```text
[INITIALIZED] 
      │
      ▼
 [VALIDATED]
      │
      ▼
[PERMISSION_CHECKED]
      │
      ▼
[RISK_ASSESSED] ──(Requires Human Approval)──► [AWAITING_APPROVAL] ──► [APPROVED]
      │                                                                      │
(Auto-Approved)                                                              │
      │                                                                      │
      └───────────────────────────────┬──────────────────────────────────────┘
                                      │
                                      ▼
                             [EXECUTING_ACTION]
                                      │
                                      ▼
                                 [VERIFYING]
                                      │
                                      ▼
                                 [NOTIFYING]
                                      │
                                      ▼
                                 [AUDITING]
                                      │
                                      ▼
                                [COMPLETED]

* Any error at any stage safely transitions to [FAILED] with captured diagnostic error and failedStep.
```

---

## 6. Canonical Event Schemas (The 9 Active System Events)

All domain events strictly follow the standardized `StandardEvent` envelope:

| Event Type | Producer | Consumer(s) | Resource | Key Payload Fields |
| :--- | :--- | :--- | :--- | :--- |
| `LeaveRequested` | Member 3 / Member 1 | Member 4 Orchestrator | `leave` | `userId`, `leaveTypeId`, `startDate`, `endDate`, `days`, `reason` |
| `LeaveApproved` | Member 4 / Member 1 | Member 3, Member 4 Notifications | `leave` | `leaveRequestId`, `userId`, `daysDeducted`, `newBalance`, `approvedBy` |
| `LeaveRejected` | Member 4 / Member 3 | Member 3, Member 4 Notifications | `leave` | `leaveRequestId`, `userId`, `rejectedBy`, `reason` |
| `ApprovalRequested` | Member 4 Orchestrator | Member 3, Member 4 Notifications | `approval` | `approvalId`, `workflowId`, `requesterId`, `assignedToRoleId`, `aiRiskScore` |
| `ApprovalCompleted` | Member 4 / Member 3 | Member 4 Orchestrator | `approval` | `approvalId`, `workflowId`, `decision`, `decidedBy`, `comments` |
| `EmployeeUpdated` | Member 1 HR Core | Member 4 Platform, Audit | `employee` | `userId`, `departmentId`, `designation`, `reportingManagerId` |
| `NotificationRequested` | Any Member | Member 4 Notification Service | `notification` | `recipientId`, `recipientRole`, `title`, `message`, `channels` |
| `ActionCompleted` | Member 1 / Member 4 | Member 4 Audit, Member 3 | `workflow` | `actionName`, `resourceId`, `status: "SUCCESS"` |
| `ActionFailed` | Member 1 / Member 4 | Member 4 Audit, Notifications | `workflow` | `workflowId`, `failedStep`, `error` |
