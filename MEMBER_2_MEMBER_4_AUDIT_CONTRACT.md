# Member 2 → Member 4 Audit Contract

**From:** Member 2 — AI Intelligence + Decision Engineer  
**To:** Member 4 — Orchestration + Security + Platform Lead  
**Date:** August 22, 2026  
**Status:** Agreed Audit Metadata Specification

---

## 1. Overview & Audit Principle

Every Member 1 state-changing API request initiated by Member 2 must include explicit **Actor Metadata** identifying the call as an AI-originated request authorized by a specific human employee.

This ensures that Member 4’s platform audit logger (`audit_logs` table) records full traceability:
- Which AI service agent generated the action payload (`DAYFLOW_MEMBER_2`).
- Which employee authenticated and confirmed the action (`user_id`).
- Unique correlation request ID for distributed tracing (`request_id`).

---

## 2. Audit Payload Schema

Every state-changing API request sent by Member 2 to Member 1 includes an `actor` metadata block:

```json
{
  "actor": {
    "type": "AI",
    "agent": "DAYFLOW_MEMBER_2",
    "user_id": "usr_88392",
    "request_id": "req_883a2199b0"
  }
}
```

### Field Definitions

| Field | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `type` | String | Identifies the originator type. Fixed as `"AI"`. | `"AI"` |
| `agent` | String | Identifies the specific AI workstream module. | `"DAYFLOW_MEMBER_2"` |
| `user_id` | String | Authenticated ID of the user who confirmed the action. | `"usr_88392"` |
| `request_id` | String | Unique UUID for distributed request tracing. | `"req_883a2199b0"` |

---

## 3. Example Request with Audit Metadata

### Leave Request Execution (`POST /api/v1/leaves/request`)

```json
{
  "user_id": "usr_88392",
  "leave_type": "CASUAL",
  "start_date": "2026-09-10",
  "end_date": "2026-09-12",
  "reason": "Family function",
  "actor": {
    "type": "AI",
    "agent": "DAYFLOW_MEMBER_2",
    "user_id": "usr_88392",
    "request_id": "req_a773821"
  }
}
```

---

## 4. Verification in Code

In `src/adapters/member1_adapter.py`:

```python
payload = {
    "user_id": user_id,
    "leave_type": leave_type.upper(),
    "start_date": start_date,
    "end_date": end_date,
    "reason": reason,
    "actor": actor_metadata.get("actor", {
        "type": "AI",
        "agent": "DAYFLOW_MEMBER_2",
        "user_id": user_id,
        "request_id": f"req_{uuid.uuid4().hex[:8]}"
    })
}
```
