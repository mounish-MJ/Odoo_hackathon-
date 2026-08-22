# Member 2 Live Integration Specification — Member 1 HR Core REST API

This document details the live REST API integration contract for **Member 2 (AI Backend)** consuming **Member 1 (HR Core Platform)**.

---

## 1. System Architecture & Isolation Principles

```text
               USER
                 ↓
            MEMBER 2 AI
                 ↓
           REST / HTTP (Bearer JWT)
                 ↓
       MEMBER 1 HR CORE API (http://localhost:8000/api/v1)
                 ↓
            HR SERVICES
                 ↓
            DATABASE
```

> [!IMPORTANT]
> **MEMBER 2 HAS NO DIRECT DATABASE ACCESS.**
> Member 2 communicates with Member 1 **exclusively over HTTP/HTTPS REST APIs** using Bearer JWT authentication. PostgreSQL connection strings, database passwords, and internal ORM access are strictly isolated within Member 1.

---

## 2. Server Base URLs & Network Accessibility

- **Local Host Base URL**: `http://localhost:8000/api/v1`
- **Network / LAN Base URL**: `http://<member1-ip>:8000/api/v1` (e.g. `http://192.168.1.5:8000/api/v1`)
- **Health Check Endpoint**: `GET /api/v1/health`

---

## 3. Safe Development Test Fixture

Member 2 can use the following safe, deterministic development test credentials for live integration testing:

- **Employee Account**: `charlie.dev@company.com`
- **Password**: `DevPassword123!`
- **Employee ID**: `ab872c19-62a4-4c12-8e85-c4c4cd04ea06`
- **User ID**: `ff49ca30-d598-436e-ae29-dd302c7f37fa`
- **Role**: `EMPLOYEE`

*(For HR administrative workflow testing, use HR Manager account: `hr.bob@company.com` / `DevPassword123!`)*

---

## 4. Frozen Endpoint Summary Table

| Endpoint | HTTP Method | Auth | Primary Parameters / Body | Success Status |
|---|---|---|---|---|
| `/api/v1/health` | `GET` | None | None | `200 OK` |
| `/api/v1/auth/login` | `POST` | None | Body: `email`, `password` | `200 OK` |
| `/api/v1/employees/me` | `GET` | Bearer JWT | None | `200 OK` |
| `/api/v1/employees/{employee_id}` | `GET` | Bearer JWT | Path: `employee_id` | `200 OK` |
| `/api/v1/leaves` | `GET` | Bearer JWT | Query: `status`, `employee_id` | `200 OK` |
| `/api/v1/leaves` | `POST` | Bearer JWT | Body: `leave_type`, `start_date`, `end_date`, `reason` | `201 Created` |
| `/api/v1/attendance/daily` | `GET` | Bearer JWT | Query: `date` (`YYYY-MM-DD`), `employee_id` | `200 OK` |
| `/api/v1/attendance/weekly` | `GET` | Bearer JWT | Query: `ref_date` (`YYYY-MM-DD`), `employee_id` | `200 OK` |
| `/api/v1/payroll` | `GET` | Bearer JWT | Query: `pay_period` (`YYYY-MM`), `employee_id` | `200 OK` |

---

## 5. Detailed Endpoint Contracts

### 5.1 Health Check
- **Path**: `GET /api/v1/health`
- **Authentication**: None
- **Response 200 OK**:
  ```json
  {
    "status": "ok",
    "app": "HR Core Platform",
    "environment": "development"
  }
  ```

### 5.2 Login Authentication
- **Path**: `POST /api/v1/auth/login`
- **Authentication**: None
- **Request Body**:
  ```json
  {
    "email": "charlie.dev@company.com",
    "password": "DevPassword123!"
  }
  ```
- **Response 200 OK**:
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1Ni...",
    "token_type": "bearer",
    "user": {
      "id": "ff49ca30-d598-436e-ae29-dd302c7f37fa",
      "email": "charlie.dev@company.com",
      "role": "EMPLOYEE",
      "is_active": true,
      "is_verified": true,
      "employee_id": "ab872c19-62a4-4c12-8e85-c4c4cd04ea06"
    }
  }
  ```
- **Response 401 Unauthorized**: Invalid credentials.

### 5.3 Self Employee Profile
- **Path**: `GET /api/v1/employees/me`
- **Headers**: `Authorization: Bearer <ACCESS_TOKEN>`
- **Response 200 OK**:
  ```json
  {
    "id": "ab872c19-62a4-4c12-8e85-c4c4cd04ea06",
    "employee_code": "EMP003",
    "first_name": "Charlie",
    "last_name": "SoftwareEngineer",
    "email": "charlie.dev@company.com",
    "phone": "+1-555-0103",
    "department": "Engineering",
    "designation": "Senior Software Engineer",
    "date_of_joining": "2023-06-15",
    "employment_status": "FULL_TIME",
    "user_id": "ff49ca30-d598-436e-ae29-dd302c7f37fa"
  }
  ```

### 5.4 Employee Profile by ID
- **Path**: `GET /api/v1/employees/{employee_id}`
- **Headers**: `Authorization: Bearer <ACCESS_TOKEN>`
- **Response 200 OK**: Employee profile JSON object.
- **Response 403 Forbidden**: Employee caller attempting to view another employee's profile.

### 5.5 Leave Requests Listing
- **Path**: `GET /api/v1/leaves`
- **Headers**: `Authorization: Bearer <ACCESS_TOKEN>`
- **Query Params**: `status` (`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`), `employee_id`
- **Response 200 OK**: Array of leave objects.

### 5.6 Create Leave Request
- **Path**: `POST /api/v1/leaves`
- **Headers**: `Authorization: Bearer <ACCESS_TOKEN>`
- **Request Body**:
  ```json
  {
    "leave_type": "SICK",
    "start_date": "2026-11-01",
    "end_date": "2026-11-02",
    "reason": "Medical checkup"
  }
  ```
  *(Allowed `leave_type`: `ANNUAL`, `SICK`, `CASUAL`, `MATERNITY`, `PATERNITY`, `UNPAID`)*
- **Response 201 Created**:
  ```json
  {
    "id": "bcc948a9-0541-4fed-a35f-f0ea7646a3e1",
    "employee_id": "ab872c19-62a4-4c12-8e85-c4c4cd04ea06",
    "leave_type": "SICK",
    "start_date": "2026-11-01",
    "end_date": "2026-11-02",
    "reason": "Medical checkup",
    "status": "PENDING"
  }
  ```
- **Response 400 Bad Request**: Validation error (`start_date` after `end_date`).

### 5.7 Daily Attendance
- **Path**: `GET /api/v1/attendance/daily?date=YYYY-MM-DD`
- **Headers**: `Authorization: Bearer <ACCESS_TOKEN>`
- **Response 200 OK**: Daily attendance record object.

### 5.8 Weekly Attendance
- **Path**: `GET /api/v1/attendance/weekly?ref_date=YYYY-MM-DD`
- **Headers**: `Authorization: Bearer <ACCESS_TOKEN>`
- **Response 200 OK**: Weekly summary object (`total_days_present`, `records`).

### 5.9 Payroll Retrieval
- **Path**: `GET /api/v1/payroll?pay_period=YYYY-MM`
- **Headers**: `Authorization: Bearer <ACCESS_TOKEN>`
- **Response 200 OK**: Array of payroll objects (`basic_salary`, `allowances`, `deductions`, `gross_salary`, `net_salary`).

---

## 6. Request Tracking & Idempotency Audit

- **`X-Request-ID`**: Member 2 can include an `X-Request-ID: <UUID>` header on every request for request tracing and server audit logging.
- **Idempotency & Duplicate Prevention**:
  - `POST /api/v1/leaves`: Business rules prevent duplicate pending leave requests covering overlapping date ranges for the same employee.
  - `POST /api/v1/attendance/check-in`: Duplicate check-ins for the same day are rejected with `HTTP 409 Conflict`.
  - Write confirmations on AI tool & workflow endpoints enforce strict single-use SHA-256 confirmation hash-binding (`sha256(user_id + tool_name + canonical_arguments)`).

---

## 7. Actor Metadata & Identity Model

- Member 1 derives identity strictly from the verified JWT payload (`user_id`, `employee_id`, `role`).
- Unverified headers such as `X-User-ID` or request body identity overrides are **ignored/rejected**.
- Member 2 optional tracking headers (`X-Actor-ID: DAYFLOW_MEMBER_2`, `X-Actor-Type: AI`) are logged for observability without affecting authorization rules.

---

## 8. cURL Request Examples

```bash
# 1. Health Check
curl -X GET http://localhost:8000/api/v1/health

# 2. Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"charlie.dev@company.com","password":"DevPassword123!"}'

# 3. Retrieve Profile
curl -X GET http://localhost:8000/api/v1/employees/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"

# 4. Create Leave Request
curl -X POST http://localhost:8000/api/v1/leaves \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: req_12345" \
  -d '{"leave_type":"SICK","start_date":"2026-11-01","end_date":"2026-11-02","reason":"Medical checkup"}'
```
