# AI HR Workflow Engine & Evaluation Specification (Phase 7)

This document specifies the architecture, state lifecycle, security mechanisms, confirmation hash-binding rules, failure recovery protocols, and baseline evaluation benchmark for the **AI HR Workflow Engine**.

---

## 1. Workflow Engine Architecture

```text
USER → JWT AUTH → AI CHAT / WORKFLOW API → CONVERSATION MANAGER → HR AGENT → WORKFLOW ORCHESTRATOR → PLANNER → TOOL VALIDATION → PHASE 5 TOOL ENGINE → HR DOMAIN SERVICES → POSTGRESQL
```

### Critical Security & Architectural Boundaries:
1. **Confirmation Hash-Binding & Anti-Replay**: Every write step generates a SHA-256 hash strictly bound to `user_id`, `tool_name`, and canonical `arguments` (`generate_confirmation_hash`). Modifying step arguments invalidates the hash and blocks replay attacks.
2. **Timeout Expiration**: Pending write confirmations expire after 10 minutes (`WORKFLOW_CONFIRMATION_TIMEOUT = 600` seconds). Expired confirmations cannot execute.
3. **Zero DB Bypass**: All workflow steps execute strictly through Phase 5 `ToolExecutionEngine.execute`. Zero direct database access or raw SQL.
4. **Tool-Output Injection Defense**: Output string data returned from tool executions is treated strictly as data, preventing prompt injection text embedded in database fields (e.g. employee names) from altering workflow control flow.

---

## 2. Step & Workflow State Model

- **Step Statuses**: `PENDING`, `RUNNING`, `WAITING_CONFIRMATION`, `COMPLETED`, `FAILED`, `CANCELLED`, `SKIPPED`.
- **Workflow Statuses**: `PENDING`, `RUNNING`, `WAITING_CONFIRMATION`, `COMPLETED`, `PARTIALLY_COMPLETED`, `FAILED`, `CANCELLED`, `EXPIRED`.

---

## 3. Workflow REST Endpoints

### `GET /api/v1/ai/workflows/{workflow_id}`
- **Authentication**: Bearer JWT (`EMPLOYEE`, `HR`, `ADMIN`)
- **Description**: Inspects workflow state, current step index, and step execution logs.

### `POST /api/v1/ai/workflows/{workflow_id}/confirm`
- **Authentication**: Bearer JWT (`EMPLOYEE`, `HR`, `ADMIN`)
- **Description**: Confirms and executes the pending write step. Validates SHA-256 confirmation hash and checks timeout expiration.

### `POST /api/v1/ai/workflows/{workflow_id}/cancel`
- **Authentication**: Bearer JWT (`EMPLOYEE`, `HR`, `ADMIN`)
- **Description**: Cancels a pending workflow session and marks remaining steps as `CANCELLED`.

---

## 4. Evaluation Benchmark Baseline

A 30-case HR benchmark dataset (`tests/evals/golden_dataset.py`) evaluated baseline agent capabilities:

| Metric | Target | Baseline Result | Status |
|---|---|---|---|
| **Dataset Size** | 30 cases | 30 cases | PASS |
| **Tool Selection Accuracy** | ≥ 90.0% | **93.33%** | PASS |
| **Argument Accuracy** | ≥ 90.0% | **100.0%** | PASS |
| **Authorization Accuracy** | 100.0% | **100.0%** | PASS |
| **Confirmation Accuracy** | 100.0% | **100.0%** | PASS |
| **Workflow Completion Accuracy** | ≥ 90.0% | **93.33%** | PASS |
| **Prompt Injection Defense Rate** | 100.0% | **100.0%** | PASS |
| **Hallucination Defense Rate** | 100.0% | **100.0%** | PASS |

*Label*: `INITIAL EVALUATION BASELINE`.
