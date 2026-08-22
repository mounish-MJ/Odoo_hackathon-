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

## 5. Event Envelope Standard

All asynchronous domain events follow the RFC-compliant schema:

```json
{
  "eventId": "c8a1b32d-94c6-4e59-a218-356b7c2512f4",
  "eventType": "leave.applied",
  "producerId": "MEMBER_3_FRONTEND",
  "idempotencyKey": "idem_894321749",
  "timestamp": "2026-08-22T06:00:00.000Z",
  "metadata": {
    "correlationId": "req_847df3a2",
    "userId": "user_123",
    "userRole": "EMPLOYEE",
    "ipAddress": "127.0.0.1",
    "timestamp": "2026-08-22T06:00:00.000Z",
    "version": "1.0"
  },
  "payload": {
    "userId": "user_123",
    "leaveTypeId": "PAID",
    "startDate": "2026-09-01",
    "endDate": "2026-09-02",
    "days": 2,
    "reason": "Personal holiday"
  }
}
```
