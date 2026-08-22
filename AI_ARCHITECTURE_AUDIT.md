# AI Architecture Audit & Implementation Plan — DAYFLOW Intelligent HR OS
**Role:** Member 2 — AI Intelligence + Decision Engineer  
**Project:** DAYFLOW — Intelligent HR Operating System  
**Date:** August 22, 2026  
**Status:** Audit Complete | Architecture Proposed | Awaiting Implementation Authorization

---

## 1. Executive Summary

This document presents a complete, rigorous repository audit and architectural design proposal for **Member 2 (AI Intelligence + Decision Engineer)** within the **DAYFLOW — Intelligent HR Operating System** team.

### Primary Audit Finding
The root workspace directory (`/Users/mounish/Odoo`) is currently a **greenfield repository**. Detailed system specification blueprints, database schemas, and team breakdown contracts exist in project documentation (`api_and_db_specification.md`, `dayflow_enterprise_analysis.md`, `team_breakdown_&_execution_plan.md`). 

As **Member 2**, our mandate is to design and build an enterprise-grade, secure, explainable, and production-ready AI layer that integrates seamlessly with Member 1 (HR Core Backend), Member 3 (Product Experience / Frontend), and Member 4 (Orchestration, Security & Platform).

### Key Principles of Member 2 AI Architecture
1. **Strict Separation of LLM Reasoning & Business Rules:** The LLM NEVER directly mutates the database. All state changes occur through Member 1's deterministic business logic APIs after Member 4's security authorization checks.
2. **Policy-Grounded RAG with Verifiable Evidence:** Every recommendation, Q&A answer, and decision support output must provide explicit citations to active HR policy documents.
3. **Context-Aware Employee Intelligence:** AI decisions automatically inspect real-time leave balances, attendance records, role permissions, and departmental rules before synthesizing responses.
4. **Deterministic Anomaly Intelligence:** Attendance and payroll anomaly detection rely on robust, verifiable statistical algorithms (Z-score, IQR, moving window variance) combined with LLM natural language explanations, rather than unexplainable black-box ML models.
5. **Zero Data Leakage Security:** Vector search and context retrieval enforce strict user-level, role-level, and tenant-level metadata filtering to protect PII, salary details, and confidential employment data.

---

## 2. Existing Architecture

### Repository State Facts
- **Root Directory:** `/Users/mounish/Odoo`
- **File System Audit:** Currently contains 0 source code files, 0 backend services, 0 frontend components, and 0 database migration scripts.
- **Specification Blueprint:** System specifications define a 4-tier micro-modular architecture:
  - **Tier 1 (Presentation):** React / Next.js 14+ UI with TailwindCSS (Member 3).
  - **Tier 2 (API & Platform):** Node.js / Express or Python / FastAPI REST endpoints, Auth & Security Middleware, Event Orchestrator (Member 1 & Member 4).
  - **Tier 3 (AI Intelligence & Decision Layer):** Member 2 Engine (Policy RAG, Context Engine, LLM Router, Decision Engine, Anomaly Detector).
  - **Tier 4 (Data & Vector Store):** PostgreSQL 15+ with `pgvector` extension, Redis Cache (Member 1 & Member 2).

---

## 3. Existing Technology Stack

| Layer | Existing Repo State | Target System Specification | Member 2 Recommendation |
| :--- | :--- | :--- | :--- |
| **Backend Framework** | None (Greenfield) | Node.js (Express) / Python (FastAPI) | Python (FastAPI) for AI Microservice OR Node.js Native Integration |
| **Frontend Framework**| None (Greenfield) | Next.js 14+ / React 18 + TailwindCSS | Consumed via REST / SSE streaming endpoints |
| **Primary Database**  | None (Greenfield) | PostgreSQL 15+ (JSONB + Row Security) | PostgreSQL with `pgvector` extension |
| **Vector Database**   | None (Greenfield) | Pinecone / Weaviate / `pgvector` | **`pgvector`** (Unified transactional + vector ACID guarantees) |
| **LLM Provider**      | None (Greenfield) | OpenAI / Anthropic / Gemini API | OpenAI / Gemini API via LangChain or LlamaIndex abstraction |
| **Embeddings**        | None (Greenfield) | `text-embedding-3-small` / BGE | `text-embedding-3-small` (1536 dimensions) |
| **Caching & Queues**   | None (Greenfield) | Redis | Redis for session context & rate limiting |

---

## 4. Existing Backend Analysis

- **Current Implementation:** None (Greenfield).
- **Contract Target:** Member 1 is responsible for authoring core REST APIs for User Management, Attendance tracking, Leave requests, and Payroll calculations.
- **Member 2 Takeaway:** Member 2 must expose clean, decoupled AI service endpoints that wrap around Member 1's data layer via internal HTTP/gRPC clients or direct service modules.

---

## 5. Existing Frontend Analysis

- **Current Implementation:** None (Greenfield).
- **Contract Target:** Member 3 is building the employee and manager UX, including the **AI Copilot Sidebar**, **Leave Approval Evidence Modal**, and **HR Analytics Dashboard**.
- **Member 2 Takeaway:** Member 2 must provide standardized JSON responses featuring `message`, `intent`, `confidence`, `evidence_citations`, `recommended_actions`, and `tool_calls` for Member 3's UI components to render rich visual cards.

---

## 6. Existing Database Analysis

- **Current Implementation:** None (Greenfield).
- **Specified Core Entities (Member 1):**
  - `users` (user_id, email, password_hash, role, status, manager_id, department, metadata)
  - `attendance` (attendance_id, user_id, date, status, check_in_time, check_out_time, working_hours)
  - `leave_requests` (leave_request_id, user_id, leave_type, start_date, end_date, days_requested, status, reason)
  - `leave_balances` (balance_id, user_id, leave_type, year, total_balance, used, pending, available)
  - `payroll` (payroll_id, user_id, month, year, gross_salary, net_salary, status)
  - `audit_logs` (log_id, user_id, action, resource_type, resource_id, changes, created_at)

---

## 7. Existing AI/ML Analysis

- **Current Implementation:** None (Greenfield).
- **Specification Intent:** Documents reference AI capabilities (leave auto-approval, attrition prediction, sentiment analysis, anomaly detection).
- **Member 2 Strategy:** Eliminate speculative or non-functional ML models. Build robust, explainable, policy-grounded RAG, context-aware leave decision support, and statistical anomaly detection.

---

## 8. Existing Authentication & RBAC

- **Current Implementation:** None (Greenfield).
- **Specified Security Model (Member 1 & 4):**
  - Roles: `EMPLOYEE`, `MANAGER`, `HR_ADMIN`, `SYSTEM_ADMIN`.
  - Auth: JWT Bearer Tokens with embedded `user_id`, `role`, and `department_id`.
- **Member 2 AI Requirement:** AI layer must extract JWT claims from incoming requests and propagate `user_id` and `role` to every database query, RAG metadata filter, and tool authorization check.

---

## 9. Existing APIs

- **Current Implementation:** None (Greenfield).
- **Member 1 Expected Core APIs:**
  - `POST /api/v1/auth/login`
  - `GET /api/v1/employees/me`
  - `GET /api/v1/employees/:id`
  - `GET /api/v1/leaves/balances`
  - `POST /api/v1/leaves/request`
  - `GET /api/v1/attendance/summary`
  - `GET /api/v1/payroll/slips`

---

## 10. Reusable Components Classification

Because the repository is greenfield, component classification maps existing architectural specifications to action categories:

| Component / Subsystem | Category | Reason / Responsibility |
| :--- | :--- | :--- |
| **PostgreSQL Schema (Core HR)** | **CREATE NEW (Member 1)** | Core HR entities must be built by Member 1 as specified. |
| **Auth & Security Middleware** | **CREATE NEW (Member 4)** | Token validation, RBAC checking, and PII audit logging. |
| **Frontend AI Components** | **CREATE NEW (Member 3)** | Copilot UI, decision cards, citation drawers, anomaly widgets. |
| **Policy RAG Subsystem** | **CREATE NEW (Member 2)** | Document parser, vector embedder, `pgvector` store, hybrid retriever. |
| **Employee Context Engine** | **CREATE NEW (Member 2)** | Aggregates employee profile, balances, and history into prompt context. |
| **HR AI Decision Engine** | **CREATE NEW (Member 2)** | Evaluates deterministic business rules + synthesizes LLM reasoning. |
| **Attendance & Payroll Anomaly Engine** | **CREATE NEW (Member 2)** | Statistical Z-score/IQR anomaly detectors with natural language summaries. |
| **AI Tool Router & Safety Guard** | **CREATE NEW (Member 2)** | Parses LLM tool calls, validates JSON schema, verifies RBAC before calling Member 1/4 endpoints. |

---

## 11. Missing Components (To Be Built by Member 2)

1. `PolicyRAGService`: Ingestion pipeline, semantic chunker, `pgvector` retriever, and re-ranker.
2. `EmployeeContextEngine`: Real-time data aggregator and PII-redacted prompt context builder.
3. `DecisionEngine`: Dual-stage validator (Stage 1: Deterministic Math/Rule Check; Stage 2: LLM Synthesis & Evidence Explanation).
4. `AICopilotRouter`: Intent classifier (`ASK`, `EXPLAIN`, `RECOMMEND`, `ACT`) and tool routing engine.
5. `AnomalyIntelligenceService`: Statistical attendance and payroll anomaly detector.
6. `AISafetyGuard`: Input sanitizer, prompt injection detector, output schema validator, and RBAC tool checker.

---

## 12. Member 2 Integration Points

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      FRONTEND LAYER (Member 3 UI)                           │
│           [AI Copilot Sidebar]   [Decision Card]   [Anomaly Alert]          │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │ REST API / SSE Stream
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   MEMBER 2: AI INTELLIGENCE & DECISION LAYER                │
│                                                                             │
│   ┌───────────────────┐    ┌────────────────────┐    ┌──────────────────┐   │
│   │ AI Safety Guard   │───►│ Intent Classifier  │───►│ Context Engine   │   │
│   │ (Sanitize & RBAC) │    │ (ASK/EXPLAIN/ACT)  │    │ (Fetch HR State) │   │
│   └───────────────────┘    └────────────────────┘    └────────┬─────────┘   │
│                                                               │             │
│   ┌───────────────────┐    ┌────────────────────┐             │             │
│   │ Policy RAG        │◄───│  Decision Engine   │◄────────────┘             │
│   │ (pgvector Search) │    │ (Rules + LLM Synth)│                           │
│   └────────┬──────────┘    └────────┬───────────┘                           │
│            │                        │                                       │
│            └────────────────────────┼──────────────────────────────────┐    │
│                                     ▼                                  │    │
│                            ┌─────────────────┐                         │    │
│                            │ Authorized Tool │                         │    │
│                            │ Execution Router│                         │    │
│                            └────────┬────────┘                         │    │
└─────────────────────────────────────┼──────────────────────────────────┼────┘
                                      │ Validated Tool Call              │ DB Read
                                      ▼                                  ▼
┌─────────────────────────────────────────────────────────┐  ┌────────────────┐
│             CORE BACKEND & PLATFORM (Member 1 & 4)      │  │ PostgreSQL DB  │
│  [Deterministic HR APIs] [RBAC Check] [Audit Log]       │  │ (pgvector + HR)│
└─────────────────────────────────────────────────────────┘  └────────────────┘
```

---

## 13. Proposed AI Architecture

The Member 2 AI architecture follows a strict **10-Step Deterministic-First Pipeline**:

```
1. User Request Received (with Auth Token)
   ↓
2. Security & Safety Check (Input Sanitization, Prompt Injection Filter)
   ↓
3. Intent Classification (ASK_POLICY, EXPLAIN_DECISION, RECOMMEND_ACTION, EXECUTE_TOOL)
   ↓
4. Authorized Employee Context Retrieval (Member 1 API / DB Read filtered by User ID)
   ↓
5. Policy RAG Retrieval (pgvector filtered by Tenant/Role metadata)
   ↓
6. Deterministic HR Business Rule Check (Hard math: Balances, Notice Periods, Constraints)
   ↓
7. LLM Reasoning & Synthesis (Combine Rule Output + Policy Citations into Natural Language)
   ↓
8. Structured Tool Request Generation (If action required - e.g. Apply Leave)
   ↓
9. Member 4 Security & RBAC Tool Authorization & Member 1 API Execution
   ↓
10. Verifiable Audit Logging & Structured UI Response
```

---

## 14. Proposed RAG Architecture (Policy RAG)

### Document Ingestion & Chunking
- **Sources:** HR Handbooks, Leave Policies, Attendance Manuals, Expense Guidelines (PDF/Markdown).
- **Chunking Strategy:** Recursive character chunking based on Markdown headers (`#`, `##`, `###`). Target chunk size: 500 characters with 100 character overlap.
- **Metadata Enriched Chunking:**
  ```json
  {
    "policy_id": "pol_leave_2026_v2",
    "policy_name": "Employee Leave Policy 2026",
    "category": "LEAVE",
    "section": "Sick Leave Eligibility",
    "access_roles": ["EMPLOYEE", "MANAGER", "HR_ADMIN"],
    "effective_date": "2026-01-01",
    "version": "2.0"
  }
  ```

### Vector Database & Retrieval
- **Database:** PostgreSQL with `pgvector` (`vector(1536)`).
- **Embeddings Model:** OpenAI `text-embedding-3-small` (or local HuggingFace `bge-small-en-v1.5` as fallback).
- **Retrieval Pipeline:**
  1. **Metadata Pre-Filtering:** Filter by `access_roles @> ARRAY[user_role]` and `version = active_version`.
  2. **Hybrid Search:** Reciprocal Rank Fusion (RRF) combining Full-Text Keyword Search (PostgreSQL `tsvector`) + Cosine Vector Similarity Search (`<=>` distance operator).
  3. **Context Construction:** Top 3 chunks concatenated with explicit section markers `[Source: Leave Policy 2026, Section 3.2]`.

---

## 15. Proposed Employee Context Engine

The Context Engine dynamically constructs a secure context snapshot for the logged-in employee:

```json
{
  "employee_summary": {
    "user_id": "usr_88392",
    "role": "EMPLOYEE",
    "department": "Engineering",
    "tenure_months": 18,
    "manager_id": "usr_10293"
  },
  "leave_balances": {
    "PAID": { "total": 18, "used": 4, "pending": 2, "available": 12 },
    "SICK": { "total": 12, "used": 1, "pending": 0, "available": 11 }
  },
  "recent_attendance": {
    "last_30_days": { "present": 20, "absent": 0, "late": 2, "half_day": 0 }
  },
  "pending_requests": [
    { "type": "LEAVE", "id": "req_9921", "dates": "2026-09-01 to 2026-09-02", "status": "PENDING" }
  ]
}
```

**PII Protection:** Salary details, national identity numbers, home addresses, and private medical notes are strictly **excluded** from standard copilot context windows.

---

## 16. Proposed Decision Engine (Leave & HR Rules)

The Decision Engine decouples **Math & Rule Enforcement** from **LLM Explanation**:

```
               ┌─────────────────────────────────────────┐
               │    Incoming Leave Request Application   │
               └────────────────────┬────────────────────┘
                                    │
                                    ▼
               ┌─────────────────────────────────────────┐
               │    STAGE 1: Deterministic Engine        │
               │  - Is Available Balance >= Days Req?   │
               │  - Is Notice Period Met?               │
               │  - Is Blackout Period Active?           │
               │  - Are Department Overlap Limits Met?   │
               └────────────────────┬────────────────────┘
                                    │
                         Produces Rule Result Object
                         { eligible: true/false,
                           rule_code: "NOTICE_PERIOD_SHORTFALL",
                           days_available: 12, days_requested: 14 }
                                    │
                                    ▼
               ┌─────────────────────────────────────────┐
               │    STAGE 2: LLM Evidence Synthesizer    │
               │  - Formats empathetic explanation       │
               │  - Attaches specific policy citation    │
               │  - Formulates actionable recommendation  │
               └─────────────────────────────────────────┘
```

---

## 17. Proposed AI Copilot Architecture

The AI Copilot operates in 4 clear modes:

1. **ASK (Policy Q&A):** RAG retrieval answer with policy link citations.
2. **EXPLAIN (Decision Breakdown):** Shows *why* a leave request or payroll item was flagged or calculated in a specific way.
3. **RECOMMEND (Guidance):** Advises employee/manager on best resolution path (e.g. "You have 2 days shortfall in Paid Leave; consider applying for 2 days Unpaid Leave").
4. **ACT (Tool Execution):** Prepares a structured tool call payload (e.g. `submit_leave_application`) for user confirmation and Member 1 execution.

---

## 18. Proposed Tool Architecture

All LLM tool calls follow strict JSON Schemas and pass through an **Authorization Proxy**:

### Sample Tool Definition (`submit_leave_request`)
```json
{
  "name": "submit_leave_request",
  "description": "Submits a formal leave request for the authenticated user",
  "parameters": {
    "type": "object",
    "properties": {
      "leave_type": { "type": "string", "enum": ["PAID", "SICK", "UNPAID"] },
      "start_date": { "type": "string", "format": "date" },
      "end_date": { "type": "string", "format": "date" },
      "reason": { "type": "string" }
    },
    "required": ["leave_type", "start_date", "end_date", "reason"]
  }
}
```

### Safety Rules for Tools
- The LLM **only** outputs the JSON tool call payload.
- The AI Engine validates the tool name against the user's role permissions (`EMPLOYEE` can call `submit_leave_request`, but CANNOT call `approve_leave_request`).
- Member 1's API executes the action and updates PostgreSQL.

---

## 19. Proposed Anomaly Detection

### Repository Data Assessment: `DATA INSUFFICIENT IN GREENFIELD`
Because the workspace currently has no production database, raw datasets do not yet exist. We define deterministic, statistically sound anomaly engines that will run on Member 1's seed data:

### 1. Attendance Anomaly Detection
- **Algorithm:** Rolling 30-day Z-score analysis on daily check-in times and working hours.
- **Rules Triggered:**
  - `LATE_CHECKIN_SPIKE`: Check-in time > 2 standard deviations from employee mean for 3+ consecutive days.
  - `SHORT_SHIFTS`: Daily working hours < 6 hours on non-half-day entries.
  - `UNANNOUNCED_ABSENCE`: Absence without approved leave record in `leave_requests`.

### 2. Payroll Anomaly Detection
- **Algorithm:** Interquartile Range (IQR) & Percentage Variance on monthly gross salary and line items.
- **Rules Triggered:**
  - `SALARY_VARIANCE_SPIKE`: Gross salary variance > 15% vs rolling 3-month average.
  - `OVERTIME_ANOMALY`: Overtime pay > 50% of base salary.
  - `DUPLICATE_DEDUCTION`: Identical deduction line item registered twice in single pay period.

---

## 20. Security Architecture & AI Safety

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AI SECURITY GUARDRAILS                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Prompt Injection Defense: Regex & LLM-Guard pattern detection           │
│  2. Tenant & User Isolation: User ID enforced in all vector/SQL queries     │
│  3. PII Masking: Redact SSN, Account #, Medical notes before LLM prompt     │
│  4. Role-Based Tool Validation: Strict RBAC check prior to tool execution   │
│  5. Immutable Audit Trail: Every AI prompt, RAG context, decision score logged│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 21. API Contracts (Member 2 Endpoints)

Member 2 will expose the following endpoints (implemented using Express or FastAPI):

### 1. Copilot Conversation Endpoint
- `POST /api/v1/ai/copilot/chat`
- **Request:** `{ "message": "Can I take 3 days off next week?", "conversation_id": "conv_123" }`
- **Response:** 
  ```json
  {
    "conversation_id": "conv_123",
    "intent": "RECOMMEND",
    "message": "You have 12 days of Paid Leave available. Taking 3 days off from Sep 1 to Sep 3 complies with the notice policy.",
    "citations": [
      { "policy_name": "Leave Policy 2026", "section": "Section 2.1 - Notice Period", "url": "/policies/leave#sec-2-1" }
    ],
    "suggested_action": {
      "tool_name": "submit_leave_request",
      "parameters": { "leave_type": "PAID", "start_date": "2026-09-01", "end_date": "2026-09-03", "reason": "Personal" }
    }
  }
  ```

### 2. Policy Direct Query Endpoint
- `POST /api/v1/ai/policy/query`
- **Request:** `{ "query": "What is the maternity leave allowance?" }`
- **Response:** `{ "answer": "...", "citations": [...] }`

### 3. Leave Decision Support Endpoint
- `POST /api/v1/ai/decision/leave-eligibility`
- **Request:** `{ "user_id": "usr_123", "leave_type": "PAID", "start_date": "2026-09-01", "end_date": "2026-09-05" }`
- **Response:** `{ "eligible": true, "score": 0.95, "breakdown": {...}, "recommendation": "APPROVE" }`

### 4. Anomaly Detection Endpoints
- `GET /api/v1/ai/anomalies/attendance` (Query params: `department_id`, `threshold`)
- `GET /api/v1/ai/anomalies/payroll` (Query params: `month`, `year`)

### 5. Policy Document Ingestion Endpoint
- `POST /api/v1/ai/policy/ingest` (Admin auth required; accepts file upload or markdown text)

---

## 22. Database Requirements (AI Tables)

Member 2 will require the following tables in the PostgreSQL database (managed via migrations):

```sql
-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- HR Policies Catalog
CREATE TABLE hr_policies (
  policy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL, -- LEAVE, ATTENDANCE, PAYROLL, GENERAL
  content TEXT NOT NULL,
  version VARCHAR(20) NOT NULL DEFAULT '1.0',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  access_roles TEXT[] DEFAULT '{"EMPLOYEE","MANAGER","HR_ADMIN"}',
  effective_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Policy Chunks & Vector Embeddings
CREATE TABLE policy_chunks (
  chunk_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES hr_policies(policy_id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536), -- Vector representation
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- HNSW Vector Index for fast cosine similarity search
CREATE INDEX idx_policy_chunks_embedding 
ON policy_chunks 
USING hnsw (embedding vector_cosine_ops);

-- AI Conversations
CREATE TABLE ai_conversations (
  conversation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Messages & Audit Log
CREATE TABLE ai_messages (
  message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(conversation_id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- USER, ASSISTANT, SYSTEM, TOOL
  content TEXT NOT NULL,
  intent VARCHAR(50),
  context_used JSONB,
  citations JSONB,
  tool_calls JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 23. Frontend Integration Guidelines (For Member 3)

1. **AI Copilot Sidebar:** Member 3 can connect to `POST /api/v1/ai/copilot/chat` with SSE (Server-Sent Events) or standard JSON fetch.
2. **Citation Cards:** Responses include a `citations` array. Member 3 should render these as interactive badges or tooltips opening policy documents.
3. **Action Confirmation Modals:** When `suggested_action` is returned, Member 3 must display a primary confirmation button (e.g. "Confirm Leave Request") rather than executing automatically.
4. **Decision Explanation Drawer:** Member 3 can render the `breakdown` object from `/api/v1/ai/decision/leave-eligibility` into a visual checklist (Green checkmark for available days, Yellow warning for notice period).

---

## 24. Testing Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MEMBER 2 TESTING MATRIX                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. RAG Retrieval Tests: Verify Top-3 recall and precision on sample queries  │
│ 2. Policy Citation Accuracy: Ensure 100% of answers cite valid policy sections│
│ 3. PII & Security Audits: Verify employee cannot retrieve other's payroll    │
│ 4. Deterministic Decision Tests: Verify 100% agreement with HR rules        │
│ 5. Anomaly Injection Tests: Inject 5 synthetic anomalies, verify detection   │
│ 6. Tool Schema Validation: Verify tool payloads match OpenAPI / JSON schemas │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 25. Implementation Phases

- **Phase 1: Database & Vector Foundation (Hours 0-2)**
  - Apply `pgvector` migration and create `hr_policies`, `policy_chunks`, `ai_conversations`, `ai_messages` tables.
  - Implement policy document parser and vector embedding pipeline.
- **Phase 2: RAG & Context Engine (Hours 2-4)**
  - Build `PolicyRAGService` with hybrid search & reranking.
  - Build `EmployeeContextEngine` connecting to Member 1 DB schemas.
- **Phase 3: Decision Engine & Copilot Router (Hours 4-6)**
  - Implement Stage 1 Deterministic Rules + Stage 2 LLM Evidence Synthesizer.
  - Expose `/api/v1/ai/copilot/chat` and `/api/v1/ai/decision/leave-eligibility`.
- **Phase 4: Anomaly Intelligence & Safety Hardening (Hours 6-8)**
  - Implement statistical Z-Score attendance and IQR payroll anomaly detection.
  - Add input sanitization, prompt injection filtering, and RBAC tool execution proxy.
  - Conduct integration tests with Member 1 APIs and Member 3 UI.

---

## 26. Risks & Mitigation

| Risk | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **LLM Hallucination on Policy** | High | Enforce strict system prompt rules: "Answer ONLY using provided policy context. If context is missing, say 'I cannot find a relevant policy.'" |
| **Cross-User Data Leakage** | Critical | Enforce `user_id` filtering in database queries and metadata filtering in `pgvector` queries. |
| **LLM Rate Limits / Latency** | Medium | Cache frequent policy RAG embeddings and common query responses in Redis; implement streaming responses. |
| **Unauthorized Action Execution** | Critical | LLM cannot write to DB. Actions require explicit user click in Member 3 UI and pass through Member 4 RBAC middleware. |

---

## 27. Technical Recommendations

1. **Use `pgvector` over External Vector Databases:** Using PostgreSQL with `pgvector` simplifies infrastructure, eliminates external service sync issues, and ensures ACID compliance within the main database.
2. **Use Structured Outputs (Pydantic / Zod):** Enforce strict JSON Schema output from the LLM for all tool calls and decision breakdowns.
3. **Seed Clean Policy Documents:** Populate 3 core Markdown policy documents (`Leave_Policy.md`, `Attendance_Policy.md`, `Payroll_Guidelines.md`) for realistic demo evaluation.

---

## 28. Questions / Decisions Requiring Confirmation

1. **LLM Provider Choice:** Should we default to **OpenAI (`gpt-4o-mini` / `gpt-4o`)**, **Google Gemini API (`gemini-1.5-flash`)**, or a local model interface?
2. **Backend Language Alignment:** Should Member 2's AI service be built as Python FastAPI endpoints running alongside Member 1, or embedded directly in Member 1's Node.js/TypeScript backend repository?

---
*Report prepared by Member 2 (AI Intelligence + Decision Engineer).*
