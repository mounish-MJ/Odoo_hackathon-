# Member 1 HRMS — Frozen Integration API Contract Snapshot

This document serves as the **authoritative frozen API contract** between **Member 1 (HRMS Backend)** and **Member 2 (AI Integration Partner)**.

All endpoints return structured JSON responses.

---

## 1. Authentication & Security Principles

1. **Authentication Mechanism**: All protected endpoints require a valid JWT Bearer access token sent in the HTTP Request Header:
   ```text
   Authorization: Bearer <JWT_ACCESS_TOKEN>
   ```
2. **Authoritative Identity Source**: The backend derives `user_id`, `employee_id`, `role`, and verification status **strictly from the validated JWT token claims**. Client-supplied headers (e.g. `X-User-ID`) or request body `user_id` fields are **ignored/rejected** for authorization.
3. **RBAC Roles**:
   - `EMPLOYEE`: Access strictly limited to own employee data.
   - `HR`: Access to own data and authorized employee records.
   - `ADMIN`: Full administrative access to system records.

---

## 2. Frozen Endpoint Specifications

### 2.1 Health Check

#### `GET /api/v1/health`
- **Authentication**: None Required
- **Successful Response (`200 OK`)**:
  ```json
  {
    "status": "ok",
    "app": "HR Core Platform",
    "environment": "development"
  }
  ```

---

### 2.2 Authentication

#### `POST /api/v1/auth/login`
- **Authentication**: None Required
- **Request Body**:
  ```json
  {
    "email": "charlie.dev@company.com",
    "password": "DevPassword123!"
  }
  ```
- **Successful Response (`200 OK`)**:
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
- **Error Responses**:
  - `401 Unauthorized`: Invalid email or password.
  - `403 Forbidden`: Unverified email address or inactive account.

---

### 2.3 Employee Profiles

#### `GET /api/v1/employees/me`
- **Authentication**: Bearer JWT (`EMPLOYEE`, `HR`, `ADMIN`)
- **Successful Response (`200 OK`)**:
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
    "manager_id": "de0143ed-c274-4ac7-9a90-a3e5fc3ee423",
    "user_id": "ff49ca30-d598-436e-ae29-dd302c7f37fa"
  }
  ```

#### `GET /api/v1/employees/{employee_id}`
- **Authentication**: Bearer JWT
- **Authorization**: Self-service or `HR`/`ADMIN`
- **Successful Response (`200 OK`)**: Employee profile JSON object.
- **Error Responses**:
  - `403 Forbidden`: An `EMPLOYEE` role caller attempting to access another employee's profile ID.
  - `404 Not Found`: Employee ID does not exist.

---

### 2.4 Leave Management

#### `GET /api/v1/leaves`
- **Authentication**: Bearer JWT
- **Query Parameters**:
  - `status` (Optional): `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`
  - `employee_id` (Optional): Target employee ID (Employees restricted to own ID)
- **Successful Response (`200 OK`)**:
  ```json
  [
    {
      "id": "3adb06fa-0d09-464a-98f5-97b706edcc33",
      "employee_id": "ab872c19-62a4-4c12-8e85-c4c4cd04ea06",
      "leave_type": "ANNUAL",
      "start_date": "2026-09-01",
      "end_date": "2026-09-03",
      "reason": "Annual vacation leave request",
      "status": "APPROVED",
      "reviewed_by": "1d877377-332b-455c-ac4c-25864992bb09",
      "reviewed_at": "2026-08-22T06:56:55.193450",
      "review_comment": "Approved. Enjoy your vacation!"
    }
  ]
  ```

#### `POST /api/v1/leaves`
- **Authentication**: Bearer JWT (`EMPLOYEE`, `HR`, `ADMIN`)
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
- **Successful Response (`201 Created`)**:
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
- **Error Responses**:
  - `400 Bad Request`: `start_date` occurs after `end_date`.
  - `422 Unprocessable Content`: Invalid date format or missing required fields.

---

### 2.5 Attendance Tracking

#### `GET /api/v1/attendance/daily`
- **Authentication**: Bearer JWT
- **Query Parameters**:
  - `date` (Optional): `YYYY-MM-DD` (Defaults to server date today)
  - `employee_id` (Optional): Target employee ID
- **Successful Response (`200 OK`)**:
  ```json
  {
    "date": "2026-08-22",
    "employee_id": "ab872c19-62a4-4c12-8e85-c4c4cd04ea06",
    "attendance": null
  }
  ```

#### `GET /api/v1/attendance/weekly`
- **Authentication**: Bearer JWT
- **Query Parameters**:
  - `ref_date` (Optional): `YYYY-MM-DD` (Defaults to server date today)
  - `employee_id` (Optional): Target employee ID
- **Successful Response (`200 OK`)**:
  ```json
  {
    "start_date": "2026-08-17",
    "end_date": "2026-08-23",
    "employee_id": "ab872c19-62a4-4c12-8e85-c4c4cd04ea06",
    "total_days_present": 5,
    "records": [
      {
        "id": "f196aa1b-449b-4f70-984d-ed0222ef8f42",
        "employee_id": "ab872c19-62a4-4c12-8e85-c4c4cd04ea06",
        "attendance_date": "2026-08-17",
        "check_in": "2026-08-17T09:00:00",
        "check_out": "2026-08-17T17:00:00",
        "status": "PRESENT"
      }
    ]
  }
  ```

---

### 2.6 Payroll Information

#### `GET /api/v1/payroll`
- **Authentication**: Bearer JWT
- **Query Parameters**:
  - `pay_period` (Optional): `YYYY-MM` (e.g. `2026-08`)
  - `employee_id` (Optional): Target employee ID
- **Successful Response (`200 OK`)**:
  ```json
  [
    {
      "id": "6c307b6a-e71a-4070-ae47-63bafae560f2",
      "employee_id": "ab872c19-62a4-4c12-8e85-c4c4cd04ea06",
      "pay_period": "2026-08",
      "basic_salary": "8000.00",
      "allowances": "1200.00",
      "deductions": "1500.00",
      "gross_salary": "9200.00",
      "net_salary": "7700.00",
      "currency": "USD"
    }
  ]
  ```
- **Error Responses**:
  - `403 Forbidden`: Employee attempting to view another employee's payroll records.
  - `400 Bad Request`: Invalid `pay_period` format.
