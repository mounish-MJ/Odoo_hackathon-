# Hackathon Judge Demonstration Runbook — Member 1 HR Core Platform

This runbook provides step-by-step instructions for demonstrating the **Member 1 HR Core Platform** and showing **Member 2 AI integration compatibility** during the hackathon judging evaluation.

---

## 1. Environment Setup & Server Launch

### Step 1: Start the Backend REST API Server
```bash
# Terminal 1: Launch FastAPI Uvicorn Server
.venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Step 2: Verify Health Check
```bash
curl http://localhost:8000/api/v1/health
```
*Expected Output*: `{"status": "ok", "app": "HR Core Platform", "environment": "development"}`

---

## 2. Demonstrating Core HR Features

### A. Employee Authentication & Profile Retrieval
1. **Login as Test Employee**:
   ```bash
   curl -X POST http://localhost:8000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"charlie.dev@company.com","password":"DevPassword123!"}'
   ```
2. **View Self Profile**:
   ```bash
   curl -X GET http://localhost:8000/api/v1/employees/me \
     -H "Authorization: Bearer <ACCESS_TOKEN>"
   ```

### B. Attendance & Leave Request Submission
1. **Query Weekly Attendance**:
   ```bash
   curl -X GET "http://localhost:8000/api/v1/attendance/weekly?ref_date=2026-08-20" \
     -H "Authorization: Bearer <ACCESS_TOKEN>"
   ```
2. **Submit Leave Request**:
   ```bash
   curl -X POST http://localhost:8000/api/v1/leaves \
     -H "Authorization: Bearer <ACCESS_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"leave_type":"SICK","start_date":"2026-11-01","end_date":"2026-11-02","reason":"Medical checkup"}'
   ```

---

## 3. Demonstrating Member 2 AI Integration

Run the standalone external Member 2 HTTP simulator script:

```bash
.venv\Scripts\python scripts/simulate_member2_client.py
```
*Expected Output*: All 9 frozen endpoints consumed cleanly over pure HTTP with zero ORM/database imports!

---

## 4. Demonstrating AI HR Conversational Agent & Confirmation Safety

1. **Ask HR Agent to Apply Leave (Unconfirmed)**:
   ```bash
   curl -X POST http://localhost:8000/api/v1/ai/chat \
     -H "Authorization: Bearer <ACCESS_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"message":"Apply leave for next week","confirmed":false}'
   ```
   *Expected Output*: Agent pauses execution and returns `status: "confirmation_required"` with SHA-256 confirmation hash payload.

2. **Confirm Leave Application**:
   ```bash
   curl -X POST http://localhost:8000/api/v1/ai/chat \
     -H "Authorization: Bearer <ACCESS_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"message":"Apply leave for next week","confirmed":true}'
   ```

---

## 5. Demonstrating Security & IDOR Protections

1. **Attempt Identity Header Spoofing**:
   ```bash
   curl -X GET http://localhost:8000/api/v1/employees/me \
     -H "Authorization: Bearer <CHARLIE_TOKEN>" \
     -H "X-User-ID: admin_id_spoof"
   ```
   *Demonstrated Protection*: Returns Charlie's profile. Header override is ignored; JWT remains authoritative.

2. **Attempt Cross-Employee Payroll IDOR Access**:
   ```bash
   curl -X GET "http://localhost:8000/api/v1/payroll?employee_id=other_employee_id" \
     -H "Authorization: Bearer <CHARLIE_TOKEN>"
   ```
   *Demonstrated Protection*: Returns HTTP 403 `FORBIDDEN`.
