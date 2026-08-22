from datetime import date
from app.models.user import User, UserRole
from app.models.employee import Employee, EmploymentStatus
from app.core.security import hash_password, create_access_token


def create_integration_employee(db_session, code: str, email: str, role: UserRole) -> tuple[Employee, User, str]:
    emp = Employee(
        employee_code=code,
        first_name="Member2",
        last_name=code,
        email=email,
        department="Integration Dept",
        designation="External Consumer",
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


def test_member2_health_contract(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "app" in data
    assert "environment" in data


def test_member2_auth_contract(client, db_session):
    emp, user, _ = create_integration_employee(db_session, "M2_AUTH", "m2auth@company.com", UserRole.EMPLOYEE)

    # 1. Valid Login
    res_valid = client.post("/api/v1/auth/login", json={"email": "m2auth@company.com", "password": "DevPassword123!"})
    assert res_valid.status_code == 200
    data = res_valid.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

    # 2. Invalid Credentials -> 401
    res_invalid = client.post("/api/v1/auth/login", json={"email": "m2auth@company.com", "password": "WrongPassword!"})
    assert res_invalid.status_code == 401


def test_member2_employee_contract(client, db_session):
    emp1, user1, token1 = create_integration_employee(db_session, "M2_EMP1", "m2emp1@company.com", UserRole.EMPLOYEE)
    emp2, user2, token2 = create_integration_employee(db_session, "M2_EMP2", "m2emp2@company.com", UserRole.EMPLOYEE)

    headers1 = {"Authorization": f"Bearer {token1}"}

    # 1. GET /employees/me
    res_me = client.get("/api/v1/employees/me", headers=headers1)
    assert res_me.status_code == 200
    assert res_me.json()["id"] == emp1.id

    # 2. GET /employees/{id} for self
    res_self = client.get(f"/api/v1/employees/{emp1.id}", headers=headers1)
    assert res_self.status_code == 200

    # 3. GET /employees/{id} for other employee -> 403 Forbidden
    res_other = client.get(f"/api/v1/employees/{emp2.id}", headers=headers1)
    assert res_other.status_code == 403


def test_member2_leave_contract(client, db_session):
    emp, user, token = create_integration_employee(db_session, "M2_LEAVE", "m2leave@company.com", UserRole.EMPLOYEE)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. GET /leaves
    res_get = client.get("/api/v1/leaves", headers=headers)
    assert res_get.status_code == 200
    assert isinstance(res_get.json(), list)

    # 2. POST /leaves valid
    payload = {"leave_type": "ANNUAL", "start_date": "2026-11-10", "end_date": "2026-11-12", "reason": "Vacation"}
    res_post = client.post("/api/v1/leaves", json=payload, headers=headers)
    assert res_post.status_code == 201
    assert res_post.json()["status"] == "PENDING"

    # 3. POST /leaves invalid dates -> 400 Bad Request
    inv_payload = {"leave_type": "ANNUAL", "start_date": "2026-11-15", "end_date": "2026-11-10", "reason": "Invalid"}
    res_inv = client.post("/api/v1/leaves", json=inv_payload, headers=headers)
    assert res_inv.status_code == 400


def test_member2_attendance_contract(client, db_session):
    emp, user, token = create_integration_employee(db_session, "M2_ATT", "m2att@company.com", UserRole.EMPLOYEE)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. GET /attendance/daily?date=2026-08-20
    res_daily = client.get("/api/v1/attendance/daily?date=2026-08-20", headers=headers)
    assert res_daily.status_code == 200
    assert "date" in res_daily.json()

    # 2. GET /attendance/weekly?ref_date=2026-08-20
    res_weekly = client.get("/api/v1/attendance/weekly?ref_date=2026-08-20", headers=headers)
    assert res_weekly.status_code == 200
    assert "total_days_present" in res_weekly.json()


def test_member2_payroll_contract(client, db_session):
    emp1, user1, token1 = create_integration_employee(db_session, "M2_PAY1", "m2pay1@company.com", UserRole.EMPLOYEE)
    emp2, user2, _ = create_integration_employee(db_session, "M2_PAY2", "m2pay2@company.com", UserRole.EMPLOYEE)

    headers1 = {"Authorization": f"Bearer {token1}"}

    # 1. GET /payroll for self -> 200 OK
    res_self = client.get("/api/v1/payroll?pay_period=2026-08", headers=headers1)
    assert res_self.status_code == 200
    assert isinstance(res_self.json(), list)

    # 2. GET /payroll for other employee -> 403 Forbidden
    res_other = client.get(f"/api/v1/payroll?employee_id={emp2.id}", headers=headers1)
    assert res_other.status_code == 403
