# DAYFLOW — Member 4 Architecture Assessment

**Author**: Member 4 — Orchestration + Security + Platform Lead  
**Date**: August 2026  
**Repository**: [mounish-MJ/Odoo_hackathon-](https://github.com/mounish-MJ/Odoo_hackathon-)  
**Branch**: `member4/orchestration-security-platform`

---

## 1. Executive Summary

This document presents a comprehensive technical architecture assessment of the **DAYFLOW — Intelligent HR Operating System** platform, specifically focusing on the orchestration backbone, security perimeter, authorization engine, event infrastructure, notification abstractions, and integration boundaries.

---

## 2. Discovered Technologies & Stack

Based on repository inspection, the actual technologies in place are:

| Layer | Technology Discovered | Version / Details |
| :--- | :--- | :--- |
| **Runtime** | Node.js | v20+ with ES2022 target |
| **Language** | TypeScript | `v5.5.2` (Strict mode enabled) |
| **Web Framework** | Express.js | `v4.19.2` |
| **Security Headers** | Helmet | `v7.1.0` |
| **CORS** | cors | `v2.8.5` |
| **Authentication** | JSON Web Tokens (`jsonwebtoken`) | `v9.0.2` (HS256 signature verification) |
| **Validation** | Zod | `v3.23.8` (Strict schema parse & error mapping) |
| **Cryptography** | Node.js native `crypto` | HMAC-SHA256 for Webhook signature validation |
| **Event Bus** | Node.js `events.EventEmitter` | Memory-efficient event dispatch with wildcard support |
| **Real-time Push** | Server-Sent Events (SSE) | HTTP persistent text/event-stream connection |
| **Identifier Engine** | UUID | `v9.0.1` (RFC4122 v4 UUIDs) |
| **Test Framework** | Jest & Supertest | `ts-jest v29.1.5`, `jest v29.7.0`, `supertest v7.0.0` |
| **Configuration** | dotenv | `v16.4.5` (Environment-driven configuration) |

---

## 3. Architecture Breakdown

### 3.1 Frontend Architecture (Member 3 Domain)
- **Designation**: Consumed via standard RESTful JSON APIs and Server-Sent Events (SSE).
- **Communication Channel**: HTTP/HTTPS REST for commands/queries, SSE stream on `/api/v1/notifications/stream` for real-time live events and push badges.
- **Contract Boundary**: Frontend receives standardized response envelopes with `success`, `data`, `error`, and `meta` (containing `requestId` and `timestamp`).

### 3.2 Backend Architecture (Member 4 Platform + Members 1 & 2 Services)
- **Design Pattern**: Hexagonal / Clean Architecture with Interface Contracts.
- **Singletons & Modules**:
  - `PlatformEventBus`: Manages decoupled domain event publication and dispatch.
  - `WorkflowEngine`: Implements the 8-Step Orchestration Pipeline.
  - `ApprovalRouter`: Manages AI-driven risk scoring and role-based approval queues.
  - `NotificationService`: Channel-agnostic notification abstraction.
  - `AuditService`: PII-safe immutable audit logging.
  - `WebhookDispatcher`: Signed external HTTP event delivery.

### 3.3 Database & Storage Layer
- **Architecture**: Pluggable storage design (`IAuditStore`, `IdempotencyStore`, and Member 1 HR Core storage).
- **Current State**: In-memory high-speed thread-safe stores with active support for PostgreSQL / Supabase migration.
- **Member 4 Tables / Collections**:
  - `audit_logs`: Immutable audit trails with deep diffing.
  - `idempotency_cache`: Replay-protection store with lock states.
  - `webhook_subscriptions` & `webhook_delivery_logs`: Webhook targets and HMAC verification keys.
  - `approval_requests`: Active approval states with AI risk telemetry.

### 3.4 API Endpoints Table

| Method | Endpoint | Owner | Purpose | Auth Required | Required Roles / Permission |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` | Member 4 | System health check and diagnostics | Public | None |
| `GET` | `/api/v1/health` | Member 4 | Detailed service status & active SSE count | Public | None |
| `GET` | `/api/v1/notifications/stream` | Member 4 | SSE real-time notification push stream | Optional Token | Anonymous / Authenticated |
| `POST` | `/api/v1/events/publish` | Member 4 | Ingest domain events with idempotency | JWT Bearer | Any authenticated role |
| `POST` | `/api/v1/leaves/apply` | Member 4 (Orchestrator) | Apply for leave via 8-step pipeline | JWT Bearer | `EMPLOYEE`, `MANAGER`, `HR`, `ADMIN` |
| `GET` | `/api/v1/workflows/:id` | Member 4 | Query workflow execution state and steps | JWT Bearer | Resource Owner or `MANAGER`, `HR`, `ADMIN` |
| `GET` | `/api/v1/approvals/pending` | Member 4 | Retrieve pending approvals queue | JWT Bearer | `MANAGER`, `HR`, `ADMIN` |
| `POST` | `/api/v1/approvals/:id/decide` | Member 4 | Approve or reject a workflow gate | JWT Bearer | `MANAGER`, `HR`, `ADMIN` |
| `GET` | `/api/v1/notifications` | Member 4 | Fetch user's in-app notification inbox | JWT Bearer | Resource Owner (`userId`) |
| `PUT` | `/api/v1/notifications/:id/read` | Member 4 | Mark single notification as read | JWT Bearer | Resource Owner (`userId`) |
| `PUT` | `/api/v1/notifications/read-all` | Member 4 | Mark all notifications as read | JWT Bearer | Resource Owner (`userId`) |
| `GET` | `/api/v1/audit/logs` | Member 4 | Query compliance audit trail with diffs | JWT Bearer | `HR`, `ADMIN` |
| `POST` | `/api/v1/webhooks/register` | Member 4 | Register webhook URL with HMAC secret | JWT Bearer | `ADMIN` |

---

## 4. Existing Security Perimeter Assessment

| Security Component | Status | Implementation Details |
| :--- | :--- | :--- |
| **Authentication** | ✅ Fully Implemented | Stateless JWT with HS256, expiration checks, token decoding, and bearer extraction. |
| **RBAC Authorization** | ✅ Fully Implemented | Deterministic evaluation of the 4 security questions (Identity, Resource, Ownership, Action). |
| **Resource Ownership** | ✅ Fully Implemented | Strict resource-level guards preventing Employee A from viewing/modifying Employee B's private data. |
| **Input Validation** | ✅ Fully Implemented | Zod schemas with strong typing, input sanitization, and structured field-level error messages. |
| **PII Protection** | ✅ Fully Implemented | Automated recursive scrubbing of passwords, hashes, tax IDs, salaries, and bank accounts. |
| **Audit Logging** | ✅ Fully Implemented | Immutable record generation with structured before/after diffs and zero PII leaks. |
| **Rate Limiting** | ✅ Fully Implemented | Sliding window limiter (100 req/min per IP/User) with standard rate-limit HTTP headers. |
| **Idempotency** | ✅ Fully Implemented | `X-Idempotency-Key` lock acquisition, concurrent duplicate blocking, and response caching. |
| **Security Headers** | ✅ Fully Implemented | Helmet integration configuring security headers, XSS filters, and frame protection. |
| **CORS Policy** | ✅ Fully Implemented | Configurable CORS middleware with strict origin controls. |
| **Error Handling** | ✅ Fully Implemented | Sanitized error envelopes preventing stack trace or internal query leakage. |
| **Secret Management** | ✅ Fully Implemented | Centralized secrets registry preventing hardcoded secrets and environment leakage. |

---

## 5. The Master 8-Step Orchestration Pipeline

Member 4 provides a unified, deterministic 8-step pipeline for all HR business workflows:

```
[ Incoming Event / API Trigger ]
              │
              ▼
   Step 1: Event Validation ─────────► [ Zod Schema & Business Pre-conditions ]
              │
              ▼
   Step 2: RBAC & Permissions ──────► [ 4 Security Questions Check ]
              │
              ▼
   Step 3: AI Risk Evaluation ───────► [ AI Model Scoring & Approval Thresholds ]
              │
              ├─────────────────────────┐
              ▼                         ▼
      (Low Risk / Auto)         (Elevated Risk)
              │                         │
              │                 Step 4: Approval Gate (Manager/HR Queue)
              │                         │
              ├─────────────────────────┘
              ▼
   Step 5: Deterministic Action ─────► [ Member 1 HR Core State Mutation (with Retry) ]
              │
              ▼
   Step 6: State Verification ───────► [ Post-mutation Assertion Check ]
              │
              ▼
   Step 7: Notification Dispatch ────► [ SSE Real-Time Stream + In-App + Webhooks ]
              │
              ▼
   Step 8: Immutable Audit Record ───► [ PII-Masked Audit Trail with Deep Diff ]
              │
              ▼
       [ Workflow Complete ]
```

---

## 6. Gap Analysis & Missing Features (Resolved)

1. **Request ID Propagation**: Added dedicated `RequestIdMiddleware` to ensure every incoming HTTP request receives an `X-Request-Id` and passes correlation IDs to logs, audits, and events.
2. **Integration Documentation**: Complete contract specifications created for Member 1, Member 2, and Member 3.
