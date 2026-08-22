"""
Member 2 External Consumer Simulation Script
Simulates Member 2 AI backend consuming Member 1 HR Core REST API over HTTP.

CRITICAL ARCHITECTURAL CONSTRAINT:
This script communicates ONLY via HTTP requests (using httpx).
It imports ZERO internal backend modules, ZERO SQLAlchemy models, and ZERO database sessions.
"""

import sys
import httpx

BASE_URL = "http://localhost:8000/api/v1"


def run_member2_simulation():
    print("[MEMBER 2 SIMULATOR] Starting live HTTP integration test against Member 1 HR Core API...")
    client = httpx.Client(base_url=BASE_URL, timeout=10.0)

    # 1. Health Check
    print("[STEP 1] Testing GET /health...")
    resp_health = client.get("/health")
    assert resp_health.status_code == 200, f"Health check failed: {resp_health.text}"
    health_data = resp_health.json()
    assert health_data["status"] == "ok"
    print(f" -> GET /health PASSED: {health_data}")

    # 2. Authentication / Login
    print("[STEP 2] Testing POST /auth/login with test fixture credentials...")
    login_payload = {
        "email": "charlie.dev@company.com",
        "password": "DevPassword123!"
    }
    resp_login = client.post("/auth/login", json=login_payload)
    assert resp_login.status_code == 200, f"Login failed: {resp_login.text}"
    login_data = resp_login.json()
    assert "access_token" in login_data
    token = login_data["access_token"]
    employee_id = login_data["user"]["employee_id"]
    print(f" -> POST /auth/login PASSED. Token acquired for employee ID: {employee_id}")

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "X-Request-ID": "sim_req_1001",
        "X-Actor-ID": "DAYFLOW_MEMBER_2",
        "X-Actor-Type": "AI"
    }

    # 3. Get Own Employee Profile
    print("[STEP 3] Testing GET /employees/me...")
    resp_me = client.get("/employees/me", headers=headers)
    assert resp_me.status_code == 200, f"GET /employees/me failed: {resp_me.text}"
    me_data = resp_me.json()
    assert me_data["email"] == "charlie.dev@company.com"
    print(f" -> GET /employees/me PASSED: Employee '{me_data['first_name']} {me_data['last_name']}' ({me_data['employee_code']})")

    # 4. Get Employee Profile by ID
    print(f"[STEP 4] Testing GET /employees/{employee_id}...")
    resp_emp_id = client.get(f"/employees/{employee_id}", headers=headers)
    assert resp_emp_id.status_code == 200, f"GET /employees/{employee_id} failed: {resp_emp_id.text}"
    assert resp_emp_id.json()["id"] == employee_id
    print(f" -> GET /employees/{employee_id} PASSED")

    # 5. List Leaves
    print("[STEP 5] Testing GET /leaves...")
    resp_leaves = client.get("/leaves", headers=headers)
    assert resp_leaves.status_code == 200, f"GET /leaves failed: {resp_leaves.text}"
    leaves_data = resp_leaves.json()
    assert isinstance(leaves_data, list)
    print(f" -> GET /leaves PASSED: Retrieved {len(leaves_data)} leave record(s)")

    # 6. Apply for Leave
    print("[STEP 6] Testing POST /leaves...")
    leave_payload = {
        "leave_type": "SICK",
        "start_date": "2026-11-20",
        "end_date": "2026-11-21",
        "reason": "Simulated Member 2 leave request"
    }
    resp_post_leave = client.post("/leaves", json=leave_payload, headers=headers)
    assert resp_post_leave.status_code == 201, f"POST /leaves failed: {resp_post_leave.text}"
    post_leave_data = resp_post_leave.json()
    assert post_leave_data["status"] == "PENDING"
    print(f" -> POST /leaves PASSED: Created leave ID {post_leave_data['id']}")

    # 7. Daily Attendance
    print("[STEP 7] Testing GET /attendance/daily?date=2026-08-20...")
    resp_att_daily = client.get("/attendance/daily?date=2026-08-20", headers=headers)
    assert resp_att_daily.status_code == 200, f"GET /attendance/daily failed: {resp_att_daily.text}"
    print(f" -> GET /attendance/daily PASSED: {resp_att_daily.json()}")

    # 8. Weekly Attendance
    print("[STEP 8] Testing GET /attendance/weekly?ref_date=2026-08-20...")
    resp_att_weekly = client.get("/attendance/weekly?ref_date=2026-08-20", headers=headers)
    assert resp_att_weekly.status_code == 200, f"GET /attendance/weekly failed: {resp_att_weekly.text}"
    weekly_data = resp_att_weekly.json()
    assert "total_days_present" in weekly_data
    print(f" -> GET /attendance/weekly PASSED: Total days present: {weekly_data['total_days_present']}")

    # 9. Payroll Information
    print("[STEP 9] Testing GET /payroll?pay_period=2026-08...")
    resp_payroll = client.get("/payroll?pay_period=2026-08", headers=headers)
    assert resp_payroll.status_code == 200, f"GET /payroll failed: {resp_payroll.text}"
    payroll_data = resp_payroll.json()
    assert isinstance(payroll_data, list)
    print(f" -> GET /payroll PASSED: Retrieved {len(payroll_data)} payroll record(s)")

    print("\n[MEMBER 2 SIMULATION SUCCESS] All 9 endpoints consumed successfully over pure HTTP!")
    return 0


if __name__ == "__main__":
    sys.exit(run_member2_simulation())
