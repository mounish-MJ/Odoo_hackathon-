# HR Core Platform — Architectural Specification

## Overview

The **HR Core** platform provides a deterministic, secure, and production-ready REST API for all HR operations including Authentication/Authorization, Employee Management, Attendance Tracking, Leave Management, and Payroll.

## Fundamental Architectural Boundary

> **EVERY database mutation MUST pass through the HR Core REST APIs.**
> Direct database access by the Frontend, AI Engine, AI Agents, Tools, or External Services is **STRICTLY FORBIDDEN**.

```text
  Frontend / Client ─────────────┐
                                 ↓
  AI Engine / Agents / Tools ──→ REST API Boundary
                                 ↓
                           JWT Auth & Security (get_current_user)
                                 ↓
                           RBAC Authorization (require_roles)
                                 ↓
                           Self vs Admin Policy (enforce_self_or_admin)
                                 ↓
                           Service & Data Repository Layer
                                 ↓
                           PostgreSQL Database

  AI Engine  ─── X ───> PostgreSQL (FORBIDDEN)
  Frontend   ─── X ───> PostgreSQL (FORBIDDEN)
  AI Tools   ─── X ───> PostgreSQL (FORBIDDEN)
```

---

## Technology Stack

- **Backend Framework**: Python 3.10+ & FastAPI 0.110+
- **Database ORM**: SQLAlchemy 2.0 (Async/Sync engine compatibility, connection pooling, pre-ping)
- **Database Migration Tool**: Alembic 1.13+
- **Data Validation & Settings**: Pydantic v2 & Pydantic-Settings
- **Security & Hashing**: `bcrypt` (72-byte safe password hashing) & PyJWT (`HS256`)
- **Testing & Verification**: Pytest 9+ & Starlette TestClient

---

## Role-Based Access Control (RBAC) Architecture

- `EMPLOYEE`: Access self-service endpoints (own profile, own attendance, own leave applications, own payroll). Denied from administrative APIs.
- `HR`: Access administrative HR endpoints (employee management, leave reviews, payroll overview, attendance records).
- `ADMIN`: Access all system endpoints (administrative operations, user management, system configuration).

### Server-Side Self vs. Admin Authorization Principle
> Frontend UI controls are NOT relied upon for security. Permission checks are enforced server-side.

`enforce_self_or_admin(current_user, target_employee_id)` allows access if:
1. `current_user.role in [UserRole.ADMIN, UserRole.HR]`
2. `current_user.employee_id == target_employee_id`
Otherwise returns HTTP 403 Forbidden.
