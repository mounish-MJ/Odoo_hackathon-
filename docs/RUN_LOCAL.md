# DAYFLOW HRMS — Local Run & Operational Guide

**System Name:** DAYFLOW — Intelligent HR Operating System  
**Single Launch Command:** `./scripts/start-local.sh`  
**Frontend URL:** `http://localhost:8001`

---

## 1. Prerequisites

- **Python:** Version 3.12+
- **PostgreSQL (Optional for production mode):** Version 15+ with `pgvector` extension
- **Dependencies:** Installed via `pip install -r requirements.txt`

---

## 2. Quick Start (One-Command Launch)

Navigate to the repository root and execute the automated launcher script:

```bash
cd /Users/mounish/Odoo
./scripts/start-local.sh
```

### Launcher Output Verification
```
==================================================
 Starting DAYFLOW HRMS Integrated Local Stack
==================================================
[MEMBER 1] HR Core API configured on http://127.0.0.1:8000/api/v1
[MEMBER 2] AI Intelligence & Decision Engine Gateway configured on http://127.0.0.1:8001
[MEMBER 3] Member 3 Web Frontend UI configured on http://127.0.0.1:8001
[MEMBER 4] Audit Header Tracing (X-Request-ID, X-Actor-ID, X-Actor-Type) ACTIVE
--------------------------------------------------
DAYFLOW LOCAL STACK READY

Frontend UI:
http://127.0.0.1:8001

Member 2 Gateway API:
http://127.0.0.1:8001/docs

Member 1 HR Core API:
http://127.0.0.1:8000/api/v1/health
==================================================
```

---

## 3. Environment Variables Configuration (`.env`)

```ini
ENVIRONMENT=development
PORT=8001
HOST=127.0.0.1
LOG_LEVEL=INFO

# Member 1 Local REST API Destination
MEMBER1_API_BASE_URL=http://127.0.0.1:8000/api/v1
MEMBER1_TEST_EMAIL=test.employee@dayflow.com
MEMBER1_TEST_PASSWORD=TestPassword123!

# JWT Secret & AI LLM Settings
JWT_SECRET=dayflow_super_secret_jwt_key_2026_change_in_production
LLM_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dayflow_db
```

---

## 4. Running the Automated Test Suite

To verify system functionality and API contracts:

```bash
python3 -m pytest tests/ -v
```

Expected Output: **49 Passed in 0.46s**.

---

## 5. Troubleshooting & Frequently Asked Questions

### Q1: What happens if Member 1 live server is offline?
**A:** Member 2's `Member1APIAdapter` automatically operates in isolated test fixture mode, logging `[MEMBER 1 ADAPTER: TEST FIXTURE MODE]`. All frontend views (Login, Dashboard, Leave, Attendance, Payroll, Copilot) continue to function seamlessly.

### Q2: How is user authentication handled?
**A:** User enters credentials on the frontend -> Member 2 (`POST /api/v1/auth/login`) -> Member 1 Auth API -> JWT Bearer Token returned -> Stored in `localStorage` -> Included in all subsequent requests as `Authorization: Bearer <jwt>`.
