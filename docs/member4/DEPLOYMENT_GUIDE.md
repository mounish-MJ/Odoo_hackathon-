# DAYFLOW — Member 4 Hackathon Deployment Guide

**Platform**: DAYFLOW Member 4 — Orchestration + Security + Platform Engine  
**Branch**: `Sxree__06`  
**Runtime**: Node.js 18+ / TypeScript 5.5 / Express 4

---

## 1. Overview & Practical Reliability Architecture

Member 4 provides the robust orchestration, security perimeter, event backbone, pluggable notifications, and compliance audit trail for DAYFLOW.

To ensure **100% hackathon reliability without infrastructure bloat**:
- **Zero Kubernetes / Terraform / Cloud Overkill**: Runs directly on any developer machine or lightweight container.
- **Fail-Safe Startup Validation**: Validates all configuration keys using strict Zod schemas at boot, printing descriptive actionable errors instead of failing silently.
- **Resilient Fallback Adapters**: Live HTTP adapters for Member 1 (HR Core) and Member 2 (AI Engine) seamlessly fall back to local rule-based ledgers if peer services are restarting or offline.
- **Health & Readiness Endpoints**: Liveness (`/health`) and deep subsystem readiness (`/ready`) endpoints.
- **Structured JSON Logging**: Every log entry includes timestamps, log level, correlation ID, and automatic PII masking.
- **Graceful Shutdown**: Drains active HTTP connections on `SIGTERM`/`SIGINT` with a 10s safety timeout.

---

## 2. Prerequisites & Environment Setup

### 2.1 Prerequisites
- **Node.js**: `v18.0.0` or higher (tested on Node.js v20+)
- **npm**: `v9.0.0` or higher

### 2.2 Environment Configuration (`.env`)
Create a `.env` file in the project root (or copy from `.env.example`):

```bash
# --- Member 4 Platform Core Settings ---
NODE_ENV=production
PORT=4000
PLATFORM_PORT=4000

# Security & JWT Token Verification
JWT_SECRET="dayflow_hackathon_super_secret_jwt_key_2026!"
JWT_EXPIRES_IN="24h"

# Traffic Controls & CORS
CORS_ORIGIN="*"
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000

# Webhook Security
WEBHOOK_SECRET="dayflow_webhook_signing_secret_xyz"
WEBHOOK_MAX_RETRIES=3

# Inter-Service URLs (Peer Members)
MEMBER1_HR_CORE_URL="http://localhost:8000"
MEMBER2_AI_ENGINE_URL="http://localhost:8000/api/v1/ai"

# Database Connection (Optional PostgreSQL Ledger)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hr_core_db"
```

---

## 3. Step-by-Step Build & Run

### 3.1 Install Dependencies
```bash
npm install
```

### 3.2 Build TypeScript Bundle
```bash
npm run build
```

### 3.3 Run in Production Mode
```bash
npm start
```

### 3.4 Run in Development Mode (with hot-reload)
```bash
npm run dev
```

---

## 4. Health & Diagnostics Endpoints

### 4.1 Liveness Probe (`GET /health` or `GET /api/v1/health`)
Checks if the server process is alive and accepting connections.

**Response (`200 OK`)**:
```json
{
  "status": "HEALTHY",
  "service": "DAYFLOW Member 4 — Orchestration + Security + Platform",
  "version": "1.0.0",
  "timestamp": "2026-08-22T08:54:11.000Z",
  "activeSSEConnections": 0,
  "registeredWebhooks": 0
}
```

### 4.2 Deep Readiness Probe (`GET /ready` or `GET /api/v1/ready`)
Inspects all internal subsystems, event bus listeners, registered workflows, database connectivity, and peer service configurations.

**Response (`200 OK`)**:
```json
{
  "status": "HEALTHY",
  "uptimeSeconds": 42,
  "timestamp": "2026-08-22T08:54:11.000Z",
  "service": "dayflow-orchestration-platform",
  "version": "1.0.0",
  "environment": "production",
  "system": {
    "nodeVersion": "v20.14.9",
    "memoryUsageMB": { "rss": 45, "heapTotal": 28, "heapUsed": 19 }
  },
  "subsystems": {
    "eventBus": { "status": "HEALTHY", "details": { "activeListeners": 9 } },
    "workflowEngine": { "status": "HEALTHY", "details": { "registeredWorkflows": ["leave-request", "attendance-anomaly", "payroll-process"] } },
    "approvalRouter": { "status": "HEALTHY", "details": { "pendingCount": 0 } },
    "auditStore": { "status": "HEALTHY", "details": { "totalRecords": 14, "immutabilityEnforced": true } },
    "notificationService": { "status": "HEALTHY", "details": { "activeProviders": ["IN_APP", "SSE", "WEBHOOK"] } },
    "sseManager": { "status": "HEALTHY", "details": { "activeConnections": 0 } },
    "webhookDispatcher": { "status": "HEALTHY", "details": { "activeSubscriptions": 0 } },
    "database": { "status": "HEALTHY", "details": { "type": "PostgreSQL Ledger" } },
    "member1HRCore": { "status": "HEALTHY", "details": { "endpoint": "http://localhost:8000", "mode": "HTTP_REST_WITH_ADAPTER_FALLBACK" } },
    "member2AIEngine": { "status": "HEALTHY", "details": { "endpoint": "http://localhost:8000/api/v1/ai", "mode": "HTTP_REST_WITH_ADAPTER_FALLBACK" } }
  }
}
```

---

## 5. Automated Smoke Test Procedure (10 Criteria)

Run the standalone 10-step automated smoke test suite anytime before or after deployment:

```bash
npm run test:smoke
```

**Verification Steps Performed**:
1. **Application Starts**: Validates process bootstrap, port binding, and `/health` probe.
2. **Database Connection**: Verifies `/ready` probe and persistence store state.
3. **Authentication**: Verifies JWT issuance, claims extraction, and signature verification.
4. **Authorization & RBAC**: Confirms role gates (`EMPLOYEE` blocked from `/audit/logs`, `HR` allowed).
5. **Event Processing**: Dispatches `StandardEvent` on `PlatformEventBus` and verifies delivery.
6. **Workflow Processing**: Executes the 8-step pipeline for an auto-approved leave.
7. **Approval Routing**: Routes multi-day request to manager and executes approval decision.
8. **Notification Engine**: Dispatches notifications across In-App and real-time SSE stream.
9. **Immutable Audit Logging**: Creates immutable audit record and queries via RBAC-protected API.
10. **Critical Leave Workflow**: Executes full end-to-end leave lifecycle with multi-channel alerts and state verification.

---

## 6. Running All Test Suites

To execute the entire 14 test suites covering all 92 unit, security, integration, and e2e tests:

```bash
npm test
```

---

## 7. Troubleshooting & Error Reporting

### 7.1 Startup Configuration Errors
If environment variables are misconfigured (e.g. missing `JWT_SECRET` or invalid URL), the platform halts immediately with a clear error banner:
```text
=================================================================
🚨 FATAL CONFIGURATION ERROR: Invalid environment configuration
=================================================================
  - [MEMBER1_HR_CORE_URL]: MEMBER1_HR_CORE_URL must be a valid URL
=================================================================
```

### 7.2 Peer Service Unavailability
If Member 1 (FastAPI) or Member 2 (AI Engine) is restarting or unreachable, Member 4 logs a structured warning and activates its deterministic fallback ledger without crashing.
