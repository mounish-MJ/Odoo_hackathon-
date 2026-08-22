# HR Core API Contract Specification (Phase 1, 2, 3, 4, 5 & 6)

All endpoints return structured JSON responses.

---

## 1. Application & Database Health

### `GET /api/v1/health`
- **Authentication**: None
- **Description**: Returns overall application health status.

### `GET /api/v1/health/db`
- **Authentication**: None
- **Description**: Checks PostgreSQL database connection health.

---

## 2. Authentication & Authorization APIs

### `POST /api/v1/auth/signup`
- **Authentication**: None
- **Description**: Registers a new user account, hashes password using Bcrypt, and returns a development verification token stub.

### `POST /api/v1/auth/verify-email`
- **Authentication**: None
- **Description**: Verifies email address using token stub.

### `POST /api/v1/auth/login`
- **Authentication**: None
- **Description**: Validates credentials and returns JWT Bearer access token.

### `GET /api/v1/auth/me`
- **Authentication**: Bearer JWT (`EMPLOYEE`, `HR`, `ADMIN`)
- **Description**: Returns current authenticated user details.

---

## 3. Employee Profile APIs

### `GET /api/v1/employees/me`
- **Authentication**: Bearer JWT (`EMPLOYEE`, `HR`, `ADMIN`)
- **Description**: Returns the authenticated user's own employee profile details.

### `PATCH /api/v1/employees/me`
- **Authentication**: Bearer JWT (`EMPLOYEE`, `HR`, `ADMIN`)
- **Description**: Self-service profile update. Allows updating `phone`. Rejects attempts to edit restricted fields (`salary`, `role`, `department`, `designation`, `employment_status`) with HTTP 422.

### `GET /api/v1/employees/{employee_id}`
- **Authentication**: Bearer JWT
- **Role**: Self or `HR`/`ADMIN`
- **Description**: Retrieves an employee profile by ID. Enforces server-side authorization (`enforce_self_or_admin`). Returns HTTP 403 if an employee attempts to view another employee's profile.

### `PATCH /api/v1/employees/{employee_id}`
- **Authentication**: Bearer JWT
- **Role**: `HR`, `ADMIN`
- **Description**: Updates administrative employee profile fields (`first_name`, `last_name`, `phone`, `department`, `designation`, `employment_status`, `manager_id`).

---

## 4. Attendance Tracking APIs

### `POST /api/v1/attendance/check-in`
- **Authentication**: Bearer JWT (`EMPLOYEE`, `HR`, `ADMIN`)
- **Description**: Records check-in timestamp using authoritative server time (UTC). Returns HTTP 409 Conflict if employee has already checked in today.

### `POST /api/v1/attendance/check-out`
- **Authentication**: Bearer JWT (`EMPLOYEE`, `HR`, `ADMIN`)
- **Description**: Records check-out timestamp. Returns HTTP 400 if no active check-in exists for today, or HTTP 409 if check-out is already recorded.

### `GET /api/v1/attendance/daily`
- **Authentication**: Bearer JWT
- **Role**: Self or `HR`/`ADMIN`
- **Query Parameters**: `date` (YYYY-MM-DD, default today), `employee_id` (default self).
- **Description**: Retrieves daily attendance record for specified date and employee.

### `GET /api/v1/attendance/weekly`
- **Authentication**: Bearer JWT
- **Role**: Self or `HR`/`ADMIN`
- **Query Parameters**: `ref_date` (YYYY-MM-DD), `employee_id` (default self).
- **Description**: Calculates Monday-to-Sunday weekly attendance summary and present day count.

---

## 5. Leave Management APIs

### `POST /api/v1/leaves`
- **Authentication**: Bearer JWT (`EMPLOYEE`, `HR`, `ADMIN`)
- **Description**: Submits a leave request (`leave_type`, `start_date`, `end_date`, `reason`). Client identity strictly comes from JWT. Enforces `start_date <= end_date` validation. Initial status is strictly `PENDING`.

### `GET /api/v1/leaves`
- **Authentication**: Bearer JWT
- **Role**: Self or `HR`/`ADMIN`
- **Query Parameters**: `status` (`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`), `employee_id`.
- **Description**: Lists leave requests. Employees can only list their own requests. HR/Admin can list all or filter by employee/status.

### `PATCH /api/v1/leaves/{leave_id}/approve`
- **Authentication**: Bearer JWT
- **Role**: `HR`, `ADMIN`
- **Request Body**: `{"review_comment": "Approved by HR"}`
- **Description**: Approves a `PENDING` leave request. Records reviewer ID, review timestamp, and comments. Returns HTTP 409 if request is not in `PENDING` state.

### `PATCH /api/v1/leaves/{leave_id}/reject`
- **Authentication**: Bearer JWT
- **Role**: `HR`, `ADMIN`
- **Request Body**: `{"review_comment": "Rejected due to overlap"}`
- **Description**: Rejects a `PENDING` leave request. Records reviewer ID, review timestamp, and comments. Returns HTTP 409 if request is not in `PENDING` state.

---

## 6. Payroll APIs

### `GET /api/v1/payroll`
- **Authentication**: Bearer JWT
- **Role**: Self or `HR`/`ADMIN`
- **Query Parameters**: `pay_period` (YYYY-MM), `employee_id` (defaults to self for employees).
- **Description**: Retrieves payroll records. Employees can only view their own payroll records. Employee A attempting to view Employee B's payroll returns HTTP 403 Forbidden.

### `GET /api/v1/payroll/{payroll_id}`
- **Authentication**: Bearer JWT
- **Role**: Self or `HR`/`ADMIN`
- **Description**: Retrieves detailed payroll record by ID. Enforces server-side employee isolation (`enforce_self_or_admin`).

### `POST /api/v1/payroll`
- **Authentication**: Bearer JWT
- **Role**: `HR`, `ADMIN`
- **Request Body**: `{"employee_id": "...", "pay_period": "2026-08", "basic_salary": "5000.00", "allowances": "1000.00", "deductions": "500.00", "currency": "USD"}`
- **Description**: Creates a new payroll record. Calculates `gross_salary = basic_salary + allowances` and `net_salary = gross_salary - deductions` using `Decimal` precision.

### `PATCH /api/v1/payroll/{payroll_id}`
- **Authentication**: Bearer JWT
- **Role**: `HR`, `ADMIN`
- **Request Body**: `{"basic_salary": "5500.00", "allowances": "1200.00", "deductions": "600.00"}`
- **Description**: Updates an existing payroll record and recalculates gross and net salaries.

---

## 7. AI Tool Execution APIs (Phase 5)

### `GET /api/v1/ai/tools`
- **Authentication**: Bearer JWT (`EMPLOYEE`, `HR`, `ADMIN`)
- **Description**: Returns role-filtered available AI tools and input parameter JSON schemas.

### `POST /api/v1/ai/tools/{tool_name}/execute`
- **Authentication**: Bearer JWT (`EMPLOYEE`, `HR`, `ADMIN`)
- **Request Body**: `{"arguments": {...}, "confirmed": boolean}`
- **Description**: Executes specified AI tool. Enforces active JWT identity context, RBAC, employee isolation, write confirmation contract, and domain service logic.

---

## 8. AI Conversational Agent API (Phase 6)

### `POST /api/v1/ai/chat`
- **Authentication**: Bearer JWT (`EMPLOYEE`, `HR`, `ADMIN`)
- **Request Body**:
  ```json
  {
    "message": "Show my attendance for this week",
    "conversation_id": "optional-session-id",
    "confirmed": false
  }
  ```
- **Response Body**:
  ```json
  {
    "conversation_id": "session-uuid",
    "status": "completed",
    "message": "You were present for 5 of 5 working days this week.",
    "confirmation": null
  }
  ```
- **Description**: Interacts with the Secure HR Conversational Agent. Resolves user intent, executes role-filtered tools via `ToolExecutionEngine`, manages multi-turn history with user session isolation, handles write confirmations, and returns human-readable responses.
