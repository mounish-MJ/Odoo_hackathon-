# HR Core Platform — Phase 1 Foundation

Deterministic, secure, and production-ready backend foundation for the HR Core platform built with **FastAPI**, **SQLAlchemy 2.0**, **PostgreSQL**, **Alembic**, **Pydantic v2**, and **Pytest**.

---

## Architecture Principles

- **Single Source of Truth**: Every database mutation must pass through the HR Core REST APIs.
- **No Direct DB Access**: Frontend, AI Agents, AI Tools, and external services are strictly prohibited from connecting directly to PostgreSQL.
- **Security First**: Passwords are saved hashed using Bcrypt. Environment variables manage secrets.
- **Robust Exception Handling**: Structured JSON error formats across all endpoints.

---

## Quickstart & Setup Guide

### 1. Environment Initialization
Clone the repository and set up a Python virtual environment:

```bash
python -m venv .venv
source .venv/bin/activate  # On Linux/macOS
.venv\Scripts\activate     # On Windows PowerShell
```

### 2. Dependency Installation
Install production and testing dependencies:

```bash
pip install -r requirements.txt
```

### 3. Environment Configuration
Copy `.env.example` to `.env` and adjust database credentials:

```bash
cp .env.example .env
```

Ensure `DATABASE_URL` in `.env` points to your PostgreSQL instance:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hr_core_db"
```

---

## Database Migrations & Seeding

### Run Alembic Database Migrations
To upgrade the PostgreSQL database schema to the latest version:

```bash
alembic upgrade head
```

To rollback a migration:
```bash
alembic downgrade -1
```

### Run Database Seed Script
To seed realistic development demo data (users, employees, attendance, leave requests, payroll):

```bash
python scripts/seed_db.py
```

---

## Running the Application

Start the local development server:

```bash
uvicorn app.main:app --reload --port 8000
```

- API Base URL: `http://localhost:8000/api/v1`
- Interactive API Docs (Swagger UI): `http://localhost:8000/docs`
- ReDoc API Docs: `http://localhost:8000/redoc`

---

## Running Automated Tests

Execute the automated pytest suite:

```bash
pytest -v
```

Tests cover:
- Database connections & engine pool
- Relational models, constraints, enums, FK relationships
- Database seeding idempotency
- `/health` and `/health/db` health check APIs
