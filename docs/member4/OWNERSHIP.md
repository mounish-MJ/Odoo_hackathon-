# DAYFLOW — System Ownership & Responsibility Map

This document establishes strict ownership boundaries across all four engineering members working on the **DAYFLOW — Intelligent HR Operating System** repository.

---

## 1. Ownership Summary Matrix

| Role | Domain / Responsibilities | Primary Ownership Scope |
| :--- | :--- | :--- |
| **Member 1** | **System Architect + HR Core Lead** | Employee domain, Attendance business rules, Leave policies & balances, Payroll calculations, HR domain entities. |
| **Member 2** | **AI Intelligence + Decision Engine Lead** | AI models (LightGBM, LLMs), Risk evaluation, Anomaly scoring, Prompt engineering, Decision reasoning. |
| **Member 3** | **Product Experience + Frontend Lead** | UI/UX, React/Next.js/HTML pages, Components, Client-side state, Employee & Manager dashboards. |
| **Member 4** | **Orchestration + Security + Platform Lead** | Authentication, RBAC, API security, 8-Step Workflow Orchestration, Event Bus, Notifications, Audit, Correlation/Tracing. |

---

## 2. Detailed File & Directory Classification

### 🛡️ MEMBER 4 — Orchestration + Security + Platform (OUR EXCLUSIVE OWNERSHIP)

All files in this section are authored and maintained by Member 4.

| File / Path | Purpose & Responsibility |
| :--- | :--- |
| `src/server.ts` | Platform server bootstrap, middleware mounting, singletons initialization, health probes. |
| `src/index.ts` | Public platform exports for contracts, security guards, orchestrator, and notifications. |
| `src/security/auth.middleware.ts` | JWT validation, bearer token extraction, authentication guard. |
| `src/security/rbac.guard.ts` | Deterministic Role-Based Access Control & Resource-Level ownership checks (4 Security Questions). |
| `src/security/input-validator.ts` | Zod schemas and middleware for strict API payload and query parameter validation. |
| `src/security/pii.sanitizer.ts` | Deep object PII masking, sensitive field redaction, and diff computation. |
| `src/security/pii.logger.ts` | Structured JSON logger with automated PII masking and log levels. |
| `src/security/rate-limiter.ts` | IP and User-based sliding window rate limiter. |
| `src/security/idempotency.guard.ts` | In-flight lock acquisition and replay-attack cache protection (`X-Idempotency-Key`). |
| `src/security/secrets.ts` | Centralized secure secret registry preventing key leakage in logs. |
| `src/security/request-id.middleware.ts` | Request/Correlation ID propagation across HTTP headers, logs, and events. |
| `src/security/error-handler.ts` | Safe security error response envelopes preventing stack trace leaks. |
| `src/audit/audit.service.ts` | Immutable audit logging service with automatic diffing and PII scrubbing. |
| `src/audit/audit.store.ts` | Audit storage abstraction (In-memory / PostgreSQL / Supabase adapter). |
| `src/notifications/notification.service.ts` | Multi-channel notification dispatcher (In-App, SSE Stream, Webhooks, Email). |
| `src/notifications/sse.manager.ts` | Server-Sent Events (SSE) manager for push notifications to Member 3 Frontend. |
| `src/notifications/webhook.dispatcher.ts` | HMAC-SHA256 signed webhook dispatcher with retry logs and delivery tracking. |
| `src/orchestration/event-bus.ts` | Platform Event Bus with schema validation, idempotency filtering, and wildcard routing. |
| `src/orchestration/workflow-engine.ts` | Master 8-step orchestration pipeline executing domain workflows with retry support. |
| `src/orchestration/approval-router.ts` | Dynamic rule-based approval router evaluating AI risk thresholds for Manager/HR gates. |
| `src/orchestration/retry-manager.ts` | Exponential backoff retry engine for resilient distributed actions. |
| `src/orchestration/workflows/base.workflow.ts` | Abstract base workflow defining the 8-step lifecycle hooks. |
| `src/orchestration/workflows/leave-request.workflow.ts` | Orchestration workflow for leave application lifecycle. |
| `src/orchestration/workflows/attendance-anomaly.workflow.ts` | Orchestration workflow for attendance anomaly detection and remediation. |
| `src/orchestration/workflows/payroll-process.workflow.ts` | Orchestration workflow for multi-employee payroll processing. |
| `src/integration/member3-api-routes.ts` | High-level API endpoints exposing orchestration and security to Member 3 Frontend. |
| `src/contracts/*` | Integration contract definitions and interfaces across all four members. |
| `src/mocks/*` | Deterministic mock adapters for Member 1 HR Core and Member 2 AI Engine testing. |
| `tests/*` | Member 4 comprehensive automated test suites (Security, RBAC, API, Orchestration, Audit, Notifications). |
| `docs/member4/*` | Member 4 architectural specifications, ownership maps, progress trackers, and API contracts. |

---

### 🏛️ MEMBER 1 — System Architect + HR Core (EXTERNAL DEPENDENCY)

Member 4 interacts with Member 1 strictly via `IHRCoreService` and domain event interfaces (`src/contracts/hr-core.contract.ts`).

| Expected Path / Module | Purpose | Member 4 Interaction |
| :--- | :--- | :--- |
| `src/hr-core/employee/*` | Employee profiles, records, department mapping. | Read profile via `getUserProfile`. |
| `src/hr-core/leave/*` | Leave balance formulas, quota rules, leave accrual. | Deduct balance via `deductLeaveBalance`. |
| `src/hr-core/attendance/*` | Shift tracking, biometric ingestion, clock-in logs. | Record log via `recordAttendance`. |
| `src/hr-core/payroll/*` | Tax deductions, gross-to-net salary computation. | Execute batch via `processPayrollMutation`. |

---

### 🧠 MEMBER 2 — AI Intelligence + Decision Engine (EXTERNAL DEPENDENCY)

Member 4 interacts with Member 2 strictly via `IAIEngineService` (`src/contracts/ai-engine.contract.ts`).

| Expected Path / Module | Purpose | Member 4 Interaction |
| :--- | :--- | :--- |
| `src/ai-engine/models/*` | Trained models for leave risk, anomaly detection, attrition. | Invoked during Step 3 of Workflow. |
| `src/ai-engine/prompts/*` | LLM prompts, reasoning agents, rationale generators. | Output parsed into `aiRiskScore` & `aiConfidence`. |
| `src/ai-engine/inference/*` | Model inference pipelines and risk scorers. | Read by `ApprovalRouter` to decide auto-approval. |

---

### 🎨 MEMBER 3 — Product Experience + Frontend (EXTERNAL DEPENDENCY)

Member 3 consumes Member 4's APIs and real-time SSE stream (`src/integration/member3-api-routes.ts`).

| Expected Path / Module | Purpose | Member 4 Interaction |
| :--- | :--- | :--- |
| `src/frontend/*` or `web/*` | UI pages, React/Next.js components, Tailwind styling. | Consumes REST endpoints (`/api/v1/*`). |
| Real-time alerts | Toast notifications, pending badge counts, live updates. | Subscribes to SSE stream (`/api/v1/notifications/stream`). |

---

### 🤝 SHARED — Common Configurations & Root Files

| File | Classification | Modification Rule |
| :--- | :--- | :--- |
| `package.json` | SHARED | Add dependencies only when necessary; do not remove other members' packages. |
| `tsconfig.json` | SHARED | Preserve universal TypeScript configuration. |
| `jest.config.js` | SHARED | Preserve universal test runner setup. |
| `.gitignore` | SHARED | Ensure all `.env`, secrets, `dist/`, and build artifacts are ignored. |
| `.env.example` | SHARED | Keep template updated with placeholder variables for all services. |
| `README.md` | SHARED | Maintain high-level system overview without erasing other team sections. |

---

### ❓ UNKNOWN — Unclassified Files

Currently, **0 files** are classified as UNKNOWN. All workspace files have been inspected, categorized, and documented.
