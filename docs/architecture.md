# HR Core Platform — Architectural Specification

## Overview

The **HR Core** platform provides a deterministic, secure, and production-ready REST API for all HR operations including Authentication/Authorization, Employee Management, Attendance Tracking, Leave Management, and Payroll.

## Fundamental Architectural Boundary

> **EVERY database mutation MUST pass through the HR Core REST APIs.**
> Direct database access by the Frontend, AI Engine, AI Agents, Tools, or External Services is **STRICTLY FORBIDDEN**.

```text
  Frontend ──────────────────────┐
                                 ↓
  AI Engine / Agents / Tools ──→ HR Core REST API
                                 ↓
                            Service Layer
                                 ↓
                           Repository Layer
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
- **Security & Password Hashing**: PassLib (bcrypt algorithm) & PyJWT (HS256)
- **Testing & Verification**: Pytest 8+ & HTTPX AsyncClient / TestClient

---

## Code Directory Structure

```text
e:/ODOO Architecture/
├── app/
│   ├── main.py              # FastAPI Application Entrypoint & Middleware
│   ├── core/                # System Configuration, Security, Logging, Exception Handlers
│   ├── db/                  # SQLAlchemy Engine, Session lifecycle, Base model
│   ├── models/              # Relational DB ORM Models (User, Employee, Attendance, Leave, Payroll)
│   ├── schemas/             # Pydantic Input/Output DTO Validation Schemas
│   ├── api/
│   │   └── v1/
│   │       ├── router.py    # Main V1 Router
│   │       └── endpoints/   # Modular API Endpoints (Health, Auth, Employees, etc.)
│   ├── repositories/        # Data Access Repositories (Prepared for Phase 2+)
│   └── services/            # Business Logic Services (Prepared for Phase 2+)
├── migrations/              # Alembic Database Migrations & Version Tracking
├── scripts/                 # Seed Database & Maintenance Scripts
├── tests/                   # Automated Pytest Suite
├── docs/                    # Architectural & API Specifications
├── alembic.ini              # Alembic Configuration File
├── requirements.txt         # Production & Development Python Dependencies
├── .env.example             # Safe Environment Configuration Example
├── .gitignore               # Git Ignore Rules
└── README.md                # Project Quickstart & Operations Guide
```
