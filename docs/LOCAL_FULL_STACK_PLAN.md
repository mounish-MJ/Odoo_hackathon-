# DAYFLOW HRMS — Local Full-Stack Integration Plan

**Date:** August 22, 2026  
**System Name:** DAYFLOW — Intelligent HR Operating System  
**Architecture:** Multi-Member Full-Stack Local System

---

## 1. Discovered System Architecture & Integration Map

```
Browser (User Desktop)
   ↓  http://localhost:8001 / http://localhost:5173
Member 3 Frontend (Single Page Application UI: static/index.html & static/app.js)
   ↓  HTTP REST + JWT Bearer Token
Member 2 Backend / Gateway (FastAPI: src/main.py on http://127.0.0.1:8001)
   ↓  HTTP REST + Audit Headers (X-Request-ID, X-Actor-ID, X-Actor-Type)
Member 1 Core HR REST API (FastAPI: http://127.0.0.1:8000/api/v1)
   ↓
PostgreSQL Database (hr_db) / Test Fixture Fallback Mode
```

---

## 2. Port Assignment & Network Configuration

| Workstream Component | Service / Module | Host & Port | Role / Endpoint |
| :--- | :--- | :--- | :--- |
| **Member 1 (HR Core)** | Core REST API | `http://127.0.0.1:8000` | `/api/v1/health`, `/auth/login`, `/employees/me`, `/leaves`, `/attendance/*`, `/payroll` |
| **Member 2 (AI Gateway)** | FastAPI Microservice | `http://127.0.0.1:8001` | `/api/v1/ai/copilot/chat`, `/api/v1/ai/decision/*`, `/api/v1/ai/anomalies/*`, Auth & HR Proxies |
| **Member 3 (Frontend UI)** | Web Application SPA | `http://127.0.0.1:8001` (or `:5173`) | Glassmorphic Web App UI serving Login, Dashboard, Leave, Attendance, Payroll, and Copilot Drawer |
| **Member 4 (Audit Tracing)** | Actor Header System | Integrated in Member 2 | Injects `X-Request-ID`, `X-Actor-ID: DAYFLOW_MEMBER_2`, `X-Actor-Type: AI` into all requests |

---

## 3. Environment Variables Configuration

### Member 2 (`/Users/mounish/Odoo/.env`)
```ini
ENVIRONMENT=development
PORT=8001
HOST=127.0.0.1
LOG_LEVEL=INFO

# Member 1 Local Service Destination
MEMBER1_API_BASE_URL=http://127.0.0.1:8000/api/v1
MEMBER1_TEST_EMAIL=test.employee@dayflow.com
MEMBER1_TEST_PASSWORD=TestPassword123!

# JWT & AI Configuration
JWT_SECRET=dayflow_super_secret_jwt_key_2026_change_in_production
LLM_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dayflow_db
```

---

## 4. Startup & Launcher Commands

### Start All Local Services
```bash
./scripts/start-local.sh
```

### Manual Individual Commands
- **Member 2 Backend + Member 3 Frontend:**
  ```bash
  cd /Users/mounish/Odoo
  PORT=8001 HOST=127.0.0.1 uvicorn src.main:app --reload --port 8001
  ```

---

## 5. Integration Verification Roadmap

1. **Phase 1-4:** Inspect repository, configure environment, assign ports (`8000`, `8001`), verify database fallback.
2. **Phase 5-8:** Start Member 1 & Member 2 locally, run automated unit & adapter test suite (49/49 passing).
3. **Phase 9-11:** Run CORS & Browser Network Audit to ensure zero direct frontend calls to Member 1 or PostgreSQL.
4. **Phase 12-14:** Perform failure testing, create `scripts/start-local.sh` single-command launcher, and author final E2E report.
