# HR Core API Contract Specification

All endpoints return structured JSON responses.

---

## 1. Application & Database Health

### `GET /api/v1/health`
- **Authentication**: None required
- **Description**: Returns overall application health.
- **Response (200 OK)**:
  ```json
  {
    "status": "ok",
    "app": "HR Core Platform",
    "environment": "development"
  }
  ```

### `GET /api/v1/health/db`
- **Authentication**: None required
- **Description**: Checks database connection.
- **Success Response (200 OK)**:
  ```json
  {
    "status": "ok",
    "database": "connected"
  }
  ```
- **Failure Response (503 Service Unavailable)**:
  ```json
  {
    "error": {
      "code": "DATABASE_UNAVAILABLE",
      "message": "Database connection failed or unavailable."
    }
  }
  ```

---

## 2. Authentication Endpoints

### `POST /api/v1/auth/signup`
- **Authentication**: None required
- **Description**: Registers a new user account and generates a development email verification token stub.
- **Request Body**:
  ```json
  {
    "employee_code": "EMP005",
    "email": "new.employee@company.com",
    "password": "SecurePassword123!",
    "role": "EMPLOYEE"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "user": {
      "id": "uuid-v4-user-id",
      "employee_id": "uuid-v4-employee-id",
      "email": "new.employee@company.com",
      "role": "EMPLOYEE",
      "is_active": true,
      "is_verified": false,
      "created_at": "2026-08-22T11:20:00Z",
      "updated_at": "2026-08-22T11:20:00Z",
      "last_login_at": null
    },
    "message": "Registration successful. Please verify your email using the provided verification token.",
    "verification_token_stub": "64_char_hex_verification_token"
  }
  ```
- **Error Responses**:
  - `409 Conflict`: Email or Employee code already registered (`{"error": {"code": "CONFLICT", "message": "..."}}`)
  - `404 Not Found`: Employee code not found in HR system (`{"error": {"code": "NOT_FOUND", "message": "..."}}`)

---

### `POST /api/v1/auth/verify-email`
- **Authentication**: None required
- **Description**: Verifies a user account using an email verification token stub.
- **Request Body**:
  ```json
  {
    "token": "64_char_hex_verification_token"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "message": "Email address successfully verified.",
    "is_verified": true
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Token invalid, expired, or previously used (`{"error": {"code": "INVALID_VERIFICATION_TOKEN", "message": "..."}}`)

---

### `POST /api/v1/auth/login`
- **Authentication**: None required
- **Description**: Authenticates user credentials and issues a signed JWT access token. Accepts JSON payload or form data.
- **Request Body**:
  ```json
  {
    "email": "charlie.dev@company.com",
    "password": "DevPassword123!"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "user": {
      "id": "uuid-v4-user-id",
      "employee_id": "uuid-v4-employee-id",
      "email": "charlie.dev@company.com",
      "role": "EMPLOYEE",
      "is_active": true,
      "is_verified": true,
      "created_at": "2026-08-22T11:20:00Z",
      "updated_at": "2026-08-22T11:20:00Z",
      "last_login_at": "2026-08-22T11:20:05Z"
    }
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: Invalid credentials or unverified account (`{"error": {"code": "INVALID_CREDENTIALS", "message": "..."}}` or `{"error": {"code": "UNVERIFIED_ACCOUNT", "message": "..."}}`)

---

### `GET /api/v1/auth/me`
- **Authentication**: Required (`Authorization: Bearer <token>`)
- **Role Required**: Any verified role (`EMPLOYEE`, `HR`, `ADMIN`)
- **Description**: Returns profile information for the authenticated user.
- **Response (200 OK)**: `UserRead` model.
- **Error Responses**: `401 Unauthorized` if token missing, invalid, or expired.

---

## 3. RBAC Protected Test Routes

| Method | Path | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/v1/auth/employee-only` | `EMPLOYEE`, `HR`, `ADMIN` | Accessible by all verified employee roles |
| `GET` | `/api/v1/auth/hr-only` | `HR`, `ADMIN` | Restricted to HR and Admin roles |
| `GET` | `/api/v1/auth/admin-only` | `ADMIN` | Restricted exclusively to System Administrators |

- **Response (200 OK)**:
  ```json
  {
    "message": "Access granted to route",
    "user_id": "uuid-v4-user-id",
    "role": "HR"
  }
  ```
- **Error Response (403 Forbidden)**:
  ```json
  {
    "error": {
      "code": "FORBIDDEN",
      "message": "Insufficient permissions to access this HR resource."
    }
  }
  ```

---

## Standard Error Response Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Explanation of error",
    "details": null
  }
}
```
