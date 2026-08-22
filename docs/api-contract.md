# HR Core API Contract Specification (Phase 1)

All endpoints return structured JSON responses.

---

## 1. Application Health Check

- **Method**: `GET`
- **Path**: `/api/v1/health` (Alias: `/health`)
- **Authentication**: None required
- **Authorization**: Public
- **Description**: Returns the overall application operational health.

### Response (200 OK)
```json
{
  "status": "ok",
  "app": "HR Core Platform",
  "environment": "development"
}
```

---

## 2. Database Health Check

- **Method**: `GET`
- **Path**: `/api/v1/health/db` (Alias: `/health/db`)
- **Authentication**: None required
- **Authorization**: Public
- **Description**: Verifies PostgreSQL connection status by executing a query (`SELECT 1`).

### Success Response (200 OK)
```json
{
  "status": "ok",
  "database": "connected"
}
```

### Error Response (503 Service Unavailable)
Returned when database is unreachable or connection fails:
```json
{
  "error": {
    "code": "DATABASE_UNAVAILABLE",
    "message": "Database connection failed or unavailable."
  }
}
```

---

## Standard Error Response Format

All error responses across all APIs conform to the following schema:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable explanation of the error",
    "details": null
  }
}
```

### Standard Status Codes
- `400 Bad Request`: Invalid parameters or business rule violation.
- `401 Unauthorized`: Authentication token missing or invalid.
- `403 Forbidden`: Insufficient role or access permissions.
- `404 Not Found`: Target entity or endpoint not found.
- `409 Conflict`: Unique constraint or entity state conflict.
- `422 Validation Error`: Request payload validation failure.
- `500 Internal Server Error`: Unhandled server exception.
- `503 Service Unavailable`: Database or external dependency unavailable.
