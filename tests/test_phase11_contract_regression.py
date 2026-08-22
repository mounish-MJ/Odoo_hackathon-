from datetime import date
from app.models.user import User, UserRole
from app.models.employee import Employee, EmploymentStatus
from app.core.security import hash_password, create_access_token


def create_contract_test_user(db_session, code: str, email: str, role: UserRole) -> tuple[Employee, User, str]:
    emp = Employee(
        employee_code=code,
        first_name="Contract",
        last_name=code,
        email=email,
        department="Quality",
        designation="Tester",
        date_of_joining=date(2024, 1, 1),
        employment_status=EmploymentStatus.FULL_TIME
    )
    db_session.add(emp)
    db_session.flush()

    user = User(
        email=email,
        password_hash=hash_password("DevPassword123!"),
        role=role,
        is_active=True,
        is_verified=True,
        employee_id=emp.id
    )
    db_session.add(user)
    db_session.flush()
    emp.user_id = user.id

    db_session.commit()
    token = create_access_token(subject=user.id, claims={"user_id": user.id, "employee_id": emp.id, "role": role.value})
    return emp, user, token


def test_frozen_endpoints_regression(client, db_session):
    emp, user, token = create_contract_test_user(db_session, "CON_11", "con11@company.com", UserRole.EMPLOYEE)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. GET /api/v1/health
    res_health = client.get("/api/v1/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "ok"

    # 2. POST /api/v1/auth/login
    res_login = client.post("/api/v1/auth/login", json={"email": "con11@company.com", "password": "DevPassword123!"})
    assert res_login.status_code == 200
    assert "access_token" in res_login.json()

    # 3. GET /api/v1/employees/me
    res_me = client.get("/api/v1/employees/me", headers=headers)
    assert res_me.status_code == 200
    assert res_me.json()["id"] == emp.id

    # 4. GET /api/v1/employees/{id}
    res_emp = client.get(f"/api/v1/employees/{emp.id}", headers=headers)
    assert res_emp.status_code == 200

    # 5. GET /api/v1/leaves
    res_leaves = client.get("/api/v1/leaves", headers=headers)
    assert res_leaves.status_code == 200
    assert isinstance(res_leaves.json(), list)

    # 6. POST /api/v1/leaves
    leave_payload = {
        "leave_type": "ANNUAL",
        "start_date": "2026-12-01",
        "end_date": "2026-12-02",
        "reason": "Contract regression test"
    }
    res_create_leave = client.post("/api/v1/leaves", json=leave_payload, headers=headers)
    assert res_create_leave.status_code == 201
    assert res_create_leave.json()["status"] == "PENDING"

    # 7. GET /api/v1/attendance/daily
    res_daily = client.get("/api/v1/attendance/daily?date=2026-08-20", headers=headers)
    assert res_daily.status_code == 200

    # 8. GET /api/v1/attendance/weekly
    res_weekly = client.get("/api/v1/attendance/weekly?ref_date=2026-08-20", headers=headers)
    assert res_weekly.status_code == 200

    # 9. GET /api/v1/payroll
    res_pay = client.get("/api/v1/payroll?pay_period=2026-08", headers=headers)
    assert res_pay.status_code == 200
