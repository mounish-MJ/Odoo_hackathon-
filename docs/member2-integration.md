# Member 2 Integration Guide — HR Core REST API

This guide provides step-by-step instructions for Member 2 to integrate with the Member 1 HR Core REST API.

---

## 1. System Architecture & Boundaries

```text
Member 2 AI App
    ↓
Bearer JWT Access Token
    ↓
Member 1 REST API (http://localhost:8000/api/v1)
    ↓
Member 1 Services Layer
    ↓
Member 1 Relational Database
```

> [!IMPORTANT]
> **MEMBER 2 HAS NO DIRECT DATABASE ACCESS.**
> All interactions must occur via HTTP/HTTPS REST requests to Member 1 API endpoints using Bearer JWT authentication.

---

## 2. API Server Base URLs

- **Local Development**: `http://localhost:8000/api/v1`
- **Network / Remote Host**: `http://<member1-ip>:8000/api/v1`
- **Health Check**: `GET /api/v1/health`

---

## 3. Safe Development Test Fixture

Use these safe development credentials for end-to-end integration testing:

- **Employee Account**: `charlie.dev@company.com`
- **Password**: `DevPassword123!`
- **Employee ID**: `ab872c19-62a4-4c12-8e85-c4c4cd04ea06`
- **User ID**: `ff49ca30-d598-436e-ae29-dd302c7f37fa`
- **Role**: `EMPLOYEE`

---

## 4. Authentication Workflow

### Step 1: Login to Obtain JWT Access Token
Send `POST /api/v1/auth/login`:

```json
{
  "email": "charlie.dev@company.com",
  "password": "DevPassword123!"
}
```

Response (`200 OK`):
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

### Step 2: Pass Token in Headers for All API Requests
```text
Authorization: Bearer <access_token>
Content-Type: application/json
```

---

## 5. End-to-End Core Operations

### A. Retrieve Employee Profile
```text
GET /api/v1/employees/me
```

### B. List Employee Leave Requests
```text
GET /api/v1/leaves
```

### C. Create Leave Request
```text
POST /api/v1/leaves
```
Request Body:
```json
{
  "leave_type": "ANNUAL",
  "start_date": "2026-11-10",
  "end_date": "2026-11-12",
  "reason": "Family vacation"
}
```
Response (`201 Created`):
```json
{
  "id": "leave-uuid",
  "employee_id": "ab872c19-62a4-4c12-8e85-c4c4cd04ea06",
  "leave_type": "ANNUAL",
  "start_date": "2026-11-10",
  "end_date": "2026-11-12",
  "reason": "Family vacation",
  "status": "PENDING"
}
```

### D. Query Weekly Attendance Summary
```text
GET /api/v1/attendance/weekly?ref_date=2026-08-20
```

### E. Query Payroll Information
```text
GET /api/v1/payroll?pay_period=2026-08
```

---

## 6. Error Handling Contract

Member 1 API returns standard HTTP status codes:
- `400 Bad Request`: Validation failure (e.g. `start_date` after `end_date`).
- `401 Unauthorized`: Missing, expired, or invalid JWT access token.
- `403 Forbidden`: Authorization failure (e.g. Employee attempting to access another employee's profile/payroll).
- `404 Not Found`: Target entity ID not found.
- `409 Conflict`: Conflict state (e.g. duplicate check-in today).
- `422 Unprocessable Content`: Schema formatting error.
- `500 Internal Server Error`: Unhandled server exception.
