from datetime import date
from decimal import Decimal
from app.models.user import User, UserRole
from app.models.employee import Employee, EmploymentStatus
from app.core.security import hash_password


def test_full_integration_user_workflow(client, db_session):
    """
    Executes complete end-to-end HR integration workflow across Phase 1, 2, 3 & 4:
    1. Login & acquire JWT
    2. View Employee Profile
    3. Perform Check-in
    4. View Daily Attendance
    5. Perform Check-out
    6. View Weekly Attendance
    7. Apply for Leave
    8. HR Login & view pending leave requests
    9. HR approves leave request
    10. HR creates Payroll record for employee
    11. Employee views own Payroll record
    """
    default_pwd = hash_password("Integration123!")

    # Setup Employee profile & User
    emp = Employee(
        employee_code="INT_EMP",
        first_name="Integration",
        last_name="Tester",
        email="integration.emp@company.com",
        department="Engineering",
        designation="QA Lead",
        date_of_joining=date(2024, 1, 1),
        employment_status=EmploymentStatus.FULL_TIME
    )
    db_session.add(emp)
    db_session.flush()

    user_emp = User(
        email="integration.emp@company.com",
        password_hash=default_pwd,
        role=UserRole.EMPLOYEE,
        is_active=True,
        is_verified=True,
        employee_id=emp.id
    )
    db_session.add(user_emp)

    # Setup HR profile & User
    hr_emp = Employee(
        employee_code="INT_HR",
        first_name="Integration",
        last_name="HRManager",
        email="integration.hr@company.com",
        department="HR",
        designation="HR Lead",
        date_of_joining=date(2023, 1, 1),
        employment_status=EmploymentStatus.FULL_TIME
    )
    db_session.add(hr_emp)
    db_session.flush()

    user_hr = User(
        email="integration.hr@company.com",
        password_hash=default_pwd,
        role=UserRole.HR,
        is_active=True,
        is_verified=True,
        employee_id=hr_emp.id
    )
    db_session.add(user_hr)

    db_session.commit()

    # Step 1: Employee Login
    login_resp = client.post("/api/v1/auth/login", json={"email": "integration.emp@company.com", "password": "Integration123!"})
    assert login_resp.status_code == 200
    emp_token = login_resp.json()["access_token"]
    emp_headers = {"Authorization": f"Bearer {emp_token}"}

    # Step 2: Employee Profile GET
    prof_resp = client.get("/api/v1/employees/me", headers=emp_headers)
    assert prof_resp.status_code == 200
    assert prof_resp.json()["employee_code"] == "INT_EMP"

    # Step 3: Check-in
    checkin_resp = client.post("/api/v1/attendance/check-in", headers=emp_headers)
    assert checkin_resp.status_code == 201

    # Step 4: Daily Attendance
    daily_resp = client.get("/api/v1/attendance/daily", headers=emp_headers)
    assert daily_resp.status_code == 200
    assert daily_resp.json()["attendance"]["check_in"] is not None

    # Step 5: Check-out
    checkout_resp = client.post("/api/v1/attendance/check-out", headers=emp_headers)
    assert checkout_resp.status_code == 200

    # Step 6: Weekly Attendance
    weekly_resp = client.get("/api/v1/attendance/weekly", headers=emp_headers)
    assert weekly_resp.status_code == 200
    assert weekly_resp.json()["total_days_present"] == 1

    # Step 7: Apply Leave
    leave_payload = {
        "leave_type": "ANNUAL",
        "start_date": "2026-12-01",
        "end_date": "2026-12-05",
        "reason": "Year end holiday"
    }
    apply_resp = client.post("/api/v1/leaves", json=leave_payload, headers=emp_headers)
    assert apply_resp.status_code == 201
    leave_id = apply_resp.json()["id"]

    # Step 8: HR Login
    hr_login_resp = client.post("/api/v1/auth/login", json={"email": "integration.hr@company.com", "password": "Integration123!"})
    assert hr_login_resp.status_code == 200
    hr_token = hr_login_resp.json()["access_token"]
    hr_headers = {"Authorization": f"Bearer {hr_token}"}

    # View pending leaves for employee
    hr_leaves_resp = client.get(f"/api/v1/leaves?employee_id={emp.id}&status=PENDING", headers=hr_headers)
    assert hr_leaves_resp.status_code == 200
    assert len(hr_leaves_resp.json()) == 1

    # Step 9: HR Approves Leave
    approve_resp = client.patch(f"/api/v1/leaves/{leave_id}/approve", json={"review_comment": "Approved by integration test"}, headers=hr_headers)
    assert approve_resp.status_code == 200
    assert approve_resp.json()["status"] == "APPROVED"

    # Step 10: HR Creates Payroll for Employee
    payroll_payload = {
        "employee_id": emp.id,
        "pay_period": "2026-08",
        "basic_salary": "7500.00",
        "allowances": "1500.00",
        "deductions": "1000.00",
        "currency": "USD"
    }
    payroll_resp = client.post("/api/v1/payroll", json=payroll_payload, headers=hr_headers)
    assert payroll_resp.status_code == 201
    assert Decimal(str(payroll_resp.json()["gross_salary"])) == Decimal("9000.00")
    assert Decimal(str(payroll_resp.json()["net_salary"])) == Decimal("8000.00")

    # Step 11: Employee Views Own Payroll Record
    emp_payroll_resp = client.get("/api/v1/payroll", headers=emp_headers)
    assert emp_payroll_resp.status_code == 200
    records = emp_payroll_resp.json()
    assert len(records) == 1
    assert records[0]["pay_period"] == "2026-08"
    assert Decimal(str(records[0]["net_salary"])) == Decimal("8000.00")
