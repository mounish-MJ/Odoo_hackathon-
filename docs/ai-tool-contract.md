# Secure AI Tool Contract Specification (Phase 5)

This document specifies the architecture, security model, tool registry, and execution contracts for the **Secure AI Tool Layer**.

---

## 1. Architecture & Layer Isolation

```text
                    ┌───────────────┐
                    │     USER      │
                    └───────┬───────┘
                            ↓
                    ┌───────────────┐
                    │     JWT       │
                    └───────┬───────┘
                            ↓
                    ┌───────────────┐
                    │ REST API / AI │
                    └───────┬───────┘
                            ↓
                    ┌───────────────┐
                    │ TOOL ENGINE   │
                    └───────┬───────┘
                            ↓
                 ┌─────────────────────┐
                 │ AUTH + RBAC + OWNERSHIP │
                 └──────────┬──────────┘
                            ↓
                    ┌───────────────┐
                    │ HR SERVICES   │
                    └───────┬───────┘
                            ↓
                    ┌───────────────┐
                    │  POSTGRESQL   │
                    └───────────────┘
```

### Critical Security Boundaries:
1. **Zero Direct DB Access**: AI Tools NEVER execute raw SQL or query PostgreSQL directly. All database interactions execute strictly through existing HR Core domain services (`EmployeeService`, `AttendanceService`, `LeaveService`, `PayrollService`).
2. **Untrusted Identity Prevention**: Client and LLM inputs NEVER define user role, employee identity, or verification status. Identity is derived strictly from the verified backend JWT access token (`ToolExecutionContext`).
3. **Prompt Injection Defense**: Tool arguments are treated strictly as untrusted data inputs. Backend RBAC and employee isolation logic enforce access control regardless of injected text such as `"ignore RBAC"` or `"act as admin"`.

---

## 2. AI Tool Registry Matrix

| Tool | Type | Roles Allowed | Employee Ownership Enforced | Confirmation Required |
|---|---|---|---|---|
| `get_employee_profile` | READ | `EMPLOYEE`, `HR`, `ADMIN` | Own profile only for `EMPLOYEE` | No |
| `get_attendance` | READ | `EMPLOYEE`, `HR`, `ADMIN` | Own record only for `EMPLOYEE` | No |
| `get_weekly_attendance` | READ | `EMPLOYEE`, `HR`, `ADMIN` | Own summary only for `EMPLOYEE` | No |
| `get_leave_requests` | READ | `EMPLOYEE`, `HR`, `ADMIN` | Own requests only for `EMPLOYEE` | No |
| `apply_leave` | WRITE | `EMPLOYEE`, `HR`, `ADMIN` | Applied for self (JWT context) | **Yes** |
| `approve_leave` | WRITE | `HR`, `ADMIN` | HR / Admin authorized | **Yes** |
| `reject_leave` | WRITE | `HR`, `ADMIN` | HR / Admin authorized | **Yes** |
| `get_payroll` | READ | `EMPLOYEE`, `HR`, `ADMIN` | Own payroll only for `EMPLOYEE` | No |
| `create_payroll` | WRITE | `HR`, `ADMIN` | HR / Admin authorized | **Yes** |
| `update_payroll` | WRITE | `HR`, `ADMIN` | HR / Admin authorized | **Yes** |

---

## 3. Write-Action Confirmation Contract

For tools classified as `WRITE` (`requires_confirmation = True`), the Tool Execution Engine enforces a two-step confirmation protocol:

1. **Step 1 (Confirmation Requested)**: If `confirmed = False` in execution payload, the engine returns:
   ```json
   {
     "success": true,
     "status": "confirmation_required",
     "requires_confirmation": true,
     "confirmation_summary": "Executing write tool 'apply_leave' requires explicit confirmation.",
     "data": {
       "tool_name": "apply_leave",
       "arguments": { ... }
     }
   }
   ```
2. **Step 2 (Execution)**: The state mutation is executed ONLY when the request is sent with `confirmed = True`.

---

## 4. Tool Execution REST Endpoints

### `GET /api/v1/ai/tools`
- **Authentication**: Bearer JWT (`EMPLOYEE`, `HR`, `ADMIN`)
- **Description**: Returns role-filtered list of available AI tools and input JSON schemas.

### `POST /api/v1/ai/tools/{tool_name}/execute`
- **Authentication**: Bearer JWT (`EMPLOYEE`, `HR`, `ADMIN`)
- **Request Body**:
  ```json
  {
    "arguments": { "start_date": "2026-11-10", "end_date": "2026-11-12", "leave_type": "ANNUAL" },
    "confirmed": true
  }
  ```
- **Response**: `ToolResult` JSON object.
