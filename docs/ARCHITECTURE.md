# DAYFLOW HRMS — System Architecture & Integration Specification

**Date:** August 22, 2026  
**System Name:** DAYFLOW — Intelligent HR Operating System  
**Version:** 1.0.0 Launch Edition

---

## 1. System High-Level Topology

```
+-------------------------------------------------------------------------+
|                       Member 3 Frontend SPA                             |
|             (Glassmorphic Dark UI: static/index.html & app.js)          |
+-------------------------------------------------------------------------+
                                    |
                                    | HTTP REST + Bearer JWT
                                    v
+-------------------------------------------------------------------------+
|                  Member 2 Backend / AI Gateway                          |
|             (Python FastAPI Microservice on Port 8001)                  |
|  - Policy RAG Service & Vector Search (pgvector)                       |
|  - OpenAI gpt-4o-mini NLU Entity Parser                                 |
|  - Dual-Stage Leave Decision Engine                                     |
|  - Statistical Anomaly Intelligence Detector                            |
|  - 2-Step Action Confirmation Router                                    |
+-------------------------------------------------------------------------+
                                    |
                                    | HTTP REST + Audit Headers
                                    | (X-Request-ID, X-Actor-ID, X-Actor-Type)
                                    v
+-------------------------------------------------------------------------+
|                  Member 1 Core HR REST API                              |
|             (FastAPI Core Server on Port 8000)                          |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
|                     PostgreSQL Database (hr_db)                         |
|             (HR Master Data & pgvector Vector Policy Tables)             |
+-------------------------------------------------------------------------+
```

---

## 2. Hard Security & Architectural Boundaries

1. **Browser Network Isolation:** The browser UI communicates strictly with Member 2 Backend at `http://127.0.0.1:8001`. ZERO direct browser network calls are permitted to Member 1 (`port 8000`) or PostgreSQL (`port 5432`).
2. **Zero Database Credentials in AI/Frontend:** Member 2 holds ZERO Member 1 database credentials. All reads and state modifications route strictly through HTTP REST APIs via `Member1APIAdapter`.
3. **Member 4 Audit Tracing:** Every HTTP call dispatched from Member 2 to Member 1 includes explicit audit headers:
   - `Authorization: Bearer <jwt_access_token>`
   - `X-Request-ID: req_<uuid>`
   - `X-Actor-ID: DAYFLOW_MEMBER_2`
   - `X-Actor-Type: AI`
4. **2-Step Mutation Confirmation:** State-changing AI tool requests return `ACT_PREVIEW` with candidate parameter previews and a `confirm_token`. State execution occurs ONLY after explicit user confirmation (`confirm=True`).

---

## 3. Member Integration Matrix

| Integration Link | Protocol & Auth | Data Payload | Security Guardrail |
| :--- | :--- | :--- | :--- |
| **Member 3 → Member 2** | HTTP REST + Bearer JWT | JSON (`CopilotChatRequest`, `CreateLeavePayload`) | Token stored in `localStorage`, sent via `Authorization` header |
| **Member 2 → Member 1** | HTTP REST + Bearer JWT | Mapped REST DTOs (`/api/v1/leaves`, `/auth/login`) | Audit actor headers attached (`X-Actor-ID`, `X-Actor-Type`) |
| **Member 2 → Member 4** | Header Injection | `X-Request-ID`, `X-Actor-ID`, `X-Actor-Type` | Correlation tracking across distributed AI requests |
| **Member 1 → PostgreSQL** | psycopg2 / SQLAlchemy | SQL DDL & DML operations | Master HR state mutation under strict RBAC |
