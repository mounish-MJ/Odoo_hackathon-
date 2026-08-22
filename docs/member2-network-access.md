# Member 2 Network Access & Connectivity Specification

This document specifies the **network binding, host configurations, API endpoints, and authentication rules** required for **Member 2 AI Partner** integration with **Member 1 HR Core Platform**.

---

## 1. Network Binding & Host Configuration

- **Binding Interface**: `0.0.0.0` (Listens on all network interfaces)
- **Port**: `8000`
- **Local API Base URL**: `http://localhost:8000/api/v1`
- **LAN Network Base URL**: `http://10.198.139.103:8000/api/v1`
- **Health Endpoint**: `GET /api/v1/health`
- **Readiness Endpoint**: `GET /api/v1/readiness`

---

## 2. Authentication & Header Specification

All protected Member 1 API endpoints require HTTP Bearer JWT authentication:

```text
Authorization: Bearer <JWT_ACCESS_TOKEN>
```

### Optional Tracking Headers (Audit & Tracing Only)
- `X-Request-ID`: Client or gateway request correlation UUID
- `X-Actor-ID`: `DAYFLOW_MEMBER_2`
- `X-Actor-Type`: `AI`

*Security Note*: Optional tracking headers are logged for audit purposes but **NEVER** override server-side JWT identity claims.

---

## 3. Integration Endpoints

```text
POST /api/v1/auth/login                  # Obtain JWT Access Token
GET  /api/v1/employees/me               # Authenticated Employee Profile
GET  /api/v1/employees/{employee_id}    # Employee Profile by ID
GET  /api/v1/leaves                      # List Leave Requests
POST /api/v1/leaves                      # Submit Leave Request
GET  /api/v1/leaves/balances             # Leave Balances Summary
GET  /api/v1/attendance/daily?date=...   # Daily Attendance Record
GET  /api/v1/attendance/weekly?ref_...  # Weekly Attendance Summary
GET  /api/v1/attendance/summary          # Monthly Attendance Summary
GET  /api/v1/payroll?pay_period=...      # Payroll Records
GET  /api/v1/payroll/summary             # Annual YTD Payroll Summary
```
