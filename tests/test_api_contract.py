from datetime import date, datetime, timedelta
from app.models.user import User, UserRole
from app.models.employee import Employee, EmploymentStatus
from app.core.security import hash_password, create_access_token


def create_contract_test_employee(db_session, code: str, email: str, role: UserRole) -> tuple[Employee, User, str]:
    emp = Employee(
        employee_code=code,
        first_name="Contract",
        last_name=code,
        email=email,
        department="Contract Dept",
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


def test_contract_health_endpoint(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "app" in data


def test_contract_login_endpoint(client, db_session):
    emp, user, _ = create_contract_test_employee(db_session, "CTR_001", "ctr1@company.com", UserRole.EMPLOYEE)

    # 1. Valid login -> 200 OK
    res_valid = client.post("/api/v1/auth/login", json={"email": "ctr1@company.com", "password": "DevPassword123!"})
    assert res_valid.status_code == 200
    data = res_valid.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "ctr1@company.com"

    # 2. Invalid password -> 401 Unauthorized
    res_invalid = client.post("/api/v1/auth/login", json={"email": "ctr1@company.com", "password": "WrongPassword!"})
    assert res_invalid.status_code == 401


def test_contract_employee_profile_endpoints(client, db_session):
    emp1, user1, token1 = create_contract_test_employee(db_session, "CTR_EMP1", "ctremp1@company.com", UserRole.EMPLOYEE)
    emp2, user2, token2 = create_contract_test_employee(db_session, "CTR_EMP2", "ctremp2@company.com", UserRole.EMPLOYEE)

    headers1 = {"Authorization": f"Bearer {token1}"}

    # 1. GET /employees/me -> 200 OK
    res_me = client.get("/api/v1/employees/me", headers=headers1)
    assert res_me.status_code == 200
    assert res_me.json()["id"] == emp1.id

    # 2. GET /employees/{id} for self -> 200 OK
    res_self = client.get(f"/api/v1/employees/{emp1.id}", headers=headers1)
    assert res_self.status_code == 200

    # 3. GET /employees/{id} for other employee -> 403 Forbidden
    res_other = client.get(f"/api/v1/employees/{emp2.id}", headers=headers1)
    assert res_other.status_code == 403


def test_contract_leave_endpoints(client, db_session):
    emp, user, token = create_contract_test_employee(db_session, "CTR_LEAVE", "ctrleave@company.com", UserRole.EMPLOYEE)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. GET /leaves -> 200 OK
    res_list = client.get("/api/v1/leaves", headers=headers)
    assert res_list.status_code == 200
    assert isinstance(res_list.json(), list)

    # 2. POST /leaves valid -> 201 Created
    payload = {"leave_type": "SICK", "start_date": "2026-11-01", "end_date": "2026-11-02", "reason": "Medical checkup"}
    res_post = client.post("/api/v1/leaves", json=payload, headers=headers)
    assert res_post.status_code == 201
    assert res_post.json()["status"] == "PENDING"

    # 3. POST /leaves invalid date range -> 400 Bad Request
    invalid_payload = {"leave_type": "SICK", "start_date": "2026-11-05", "end_date": "2026-11-01", "reason": "Invalid range"}
    res_invalid = client.post("/api/v1/leaves", json=invalid_payload, headers=headers)
    assert res_invalid.status_code == 400


def test_contract_attendance_endpoints(client, db_session):
    emp, user, token = create_contract_test_employee(db_session, "CTR_ATT", "ctratt@company.com", UserRole.EMPLOYEE)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. GET /attendance/daily?date=2026-08-20 -> 200 OK
    res_daily = client.get("/api/v1/attendance/daily?date=2026-08-20", headers=headers)
    assert res_daily.status_code == 200
    assert "date" in res_daily.json()

    # 2. GET /attendance/weekly?ref_date=2026-08-20 -> 200 OK
    res_weekly = client.get("/api/v1/attendance/weekly?ref_date=2026-08-20", headers=headers)
    assert res_weekly.status_code == 200
    assert "total_days_present" in res_weekly.json()


def test_contract_payroll_endpoint(client, db_session):
    emp1, user1, token1 = create_contract_test_employee(db_session, "CTR_PAY1", "ctrpay1@company.com", UserRole.EMPLOYEE)
    emp2, user2, _ = create_contract_test_employee(db_session, "CTR_PAY2", "ctrpay2@company.com", UserRole.EMPLOYEE)

    headers1 = {"Authorization": f"Bearer {token1}"}

    # 1. GET /payroll for self -> 200 OK
    res_self = client.get("/api/v1/payroll?pay_period=2026-08", headers=headers1)
    assert res_self.status_code == 200

    # 2. GET /payroll for other employee -> 403 Forbidden
    res_other = client.get(f"/api/v1/payroll?employee_id={emp2.id}", headers=headers1)
    assert res_other.status_code == 403


def test_contract_jwt_identity_dominance(client, db_session):
    emp1, user1, token1 = create_contract_test_employee(db_session, "CTR_ID1", "ctrid1@company.com", UserRole.EMPLOYEE)
    emp2, user2, _ = create_contract_test_employee(db_session, "CTR_ID2", "ctrid2@company.com", UserRole.EMPLOYEE)

    # Attempting to supply X-User-ID header targeting emp2
    headers = {
        "Authorization": f"Bearer {token1}",
        "X-User-ID": user2.id
    }

    # API derives identity from token1 (emp1) and ignores X-User-ID header
    res = client.get("/api/v1/employees/me", headers=headers)
    assert res.status_code == 200
    assert res.json()["id"] == emp1.id  # Verified identity strictly bound to token1!
