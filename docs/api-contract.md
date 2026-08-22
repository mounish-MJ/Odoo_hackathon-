# HR Core API Contract Specification (Phase 1, 2 & 3)

All endpoints return structured JSON responses.

---

## 1. Application & Database Health

### `GET /api/v1/health`
- **Authentication**: None
- **Description**: Returns overall application health.

### `GET /api/v1/health/db`
- **Authentication**: None
- **Description**: Checks database connection health.

---

## 2. Authentication & Authorization APIs

### `POST /api/v1/auth/signup`
- **Authentication**: None
- **Description**: Registers a new user account, hashes password using Bcrypt, and returns a development verification token stub.

### `POST /api/v1/auth/verify-email`
- **Authentication**: None
- **Description**: Verifies email address using token.

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
- **Role**: All verified roles
- **Description**: Returns the authenticated user's own employee profile details.

### `PATCH /api/v1/employees/me`
- **Authentication**: Bearer JWT (`EMPLOYEE`, `HR`, `ADMIN`)
- **Role**: All verified roles
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
