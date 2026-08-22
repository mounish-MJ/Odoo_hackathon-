# Production Deployment Guide — Member 1 HR Core Platform

This document provides step-by-step instructions for deploying, configuring, and verifying the **Member 1 HR Core Platform** in production environments.

---

## 1. Prerequisites

- **Python**: 3.10+
- **Database**: PostgreSQL 15+ (Local development fallback: SQLite)
- **Container Runtime**: Docker & Docker Compose (optional for containerized deployments)
- **Network Interface**: Inbound TCP access on port `8000`

---

## 2. Environment Configuration Setup

1. Copy `.env.example` to create your local `.env` configuration file:
   ```bash
   cp .env.example .env
   ```
2. Configure mandatory production environment variables:
   ```ini
   ENVIRONMENT=production
   DEBUG=False
   DATABASE_URL=postgresql://postgres:secure_db_password@localhost:5432/hr_core_db
   JWT_SECRET_KEY=change_this_to_a_random_64_character_secret_string
   JWT_ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=60
   CORS_ORIGINS=["http://localhost:3000"]
   LLM_PROVIDER=mock
   ```

---

## 3. Database Initialization & Migration

1. **Execute Alembic Schema Migrations**:
   ```bash
   alembic upgrade head
   ```
2. **Execute Initial Seed Data Script (Optional for Dev/Testing)**:
   ```bash
   python scripts/seed_db.py
   ```
   *Creates standard development fixtures (`charlie.dev@company.com` / `DevPassword123!`).*

---

## 4. Running the Server

### Option A: Standard Uvicorn Startup (Direct System Process)
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
- **Local API Base**: `http://localhost:8000/api/v1`
- **Network API Base**: `http://<LAN_IP>:8000/api/v1`

### Option B: Docker Compose Container Stack
```bash
docker-compose up --build -d
```
- Spawns isolated `hr_postgres_db` (PostgreSQL 15) and `hr_core_backend` (FastAPI) containers with automatic health checks and restart policies.

---

## 5. Verification Probes

1. **Application Health Check**:
   ```bash
   curl http://localhost:8000/api/v1/health
   ```
   *Expected Response*: `{"status": "ok", "app": "HR Core Platform", "environment": "production"}`

2. **System Readiness Check**:
   ```bash
   curl http://localhost:8000/api/v1/readiness
   ```
   *Expected Response*: `{"status": "ready", "app": "HR Core Platform", "environment": "production", "database": "ready"}`

3. **Pure HTTP External Consumer Test**:
   ```bash
   python scripts/simulate_member2_client.py
   ```
   *Expected Output*: All 9 frozen endpoints consumed cleanly over HTTP.

---

## 6. Security & Troubleshooting Notes

- **JWT Identity Isolation**: User identity is derived strictly server-side from validated JWT claims (`user_id`, `employee_id`, `role`). Client identity headers (`X-User-ID`) are rejected.
- **Member 2 Database Access**: Member 2 communicates **ONLY** over HTTP REST using `Authorization: Bearer <JWT>`. Do **NOT** provide database passwords, connection strings, or ORM access to Member 2.
