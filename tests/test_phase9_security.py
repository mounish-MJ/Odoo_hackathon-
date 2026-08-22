from datetime import date, datetime, timedelta, timezone
from app.models.user import User, UserRole
from app.models.employee import Employee, EmploymentStatus
from app.core.security import hash_password, create_access_token


def create_security_test_employee(db_session, code: str, email: str, role: UserRole) -> tuple[Employee, User, str]:
    emp = Employee(
        employee_code=code,
        first_name="Sec",
        last_name=code,
        email=email,
        department="Sec Dept",
        designation="Auditor",
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


def test_missing_invalid_expired_jwt(client):
    # 1. Missing Authorization header -> 401
    res_no_auth = client.get("/api/v1/employees/me")
    assert res_no_auth.status_code == 401

    # 2. Invalid JWT token -> 401
    res_inv = client.get("/api/v1/employees/me", headers={"Authorization": "Bearer invalid_token_xyz"})
    assert res_inv.status_code == 401

    # 3. Expired token -> 401
    expired_token = create_access_token(subject="user_123", expires_delta=timedelta(seconds=-10))
    res_exp = client.get("/api/v1/employees/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert res_exp.status_code == 401


def test_header_override_identity_spoofing_rejected(client, db_session):
    emp1, user1, token1 = create_security_test_employee(db_session, "SEC_ID1", "secid1@company.com", UserRole.EMPLOYEE)
    emp2, user2, token2 = create_security_test_employee(db_session, "SEC_ID2", "secid2@company.com", UserRole.EMPLOYEE)

    # Client attempts to send X-User-ID header targeting emp2 while passing emp1's JWT token
    headers = {
        "Authorization": f"Bearer {token1}",
        "X-User-ID": user2.id
    }

    # API derives identity from token1 (emp1) and ignores X-User-ID header
    res = client.get("/api/v1/employees/me", headers=headers)
    assert res.status_code == 200
    assert res.json()["id"] == emp1.id  # Strictly derived from token1!


def test_idor_cross_employee_access_forbidden(client, db_session):
    emp1, user1, token1 = create_security_test_employee(db_session, "SEC_IDOR1", "secidor1@company.com", UserRole.EMPLOYEE)
    emp2, user2, _ = create_security_test_employee(db_session, "SEC_IDOR2", "secidor2@company.com", UserRole.EMPLOYEE)

    headers1 = {"Authorization": f"Bearer {token1}"}

    # 1. Profile IDOR -> 403 Forbidden
    res_prof = client.get(f"/api/v1/employees/{emp2.id}", headers=headers1)
    assert res_prof.status_code == 403

    # 2. Payroll IDOR -> 403 Forbidden
    res_pay = client.get(f"/api/v1/payroll?employee_id={emp2.id}", headers=headers1)
    assert res_pay.status_code == 403


def test_employee_self_service_restricted_fields_forbidden(client, db_session):
    emp, user, token = create_security_test_employee(db_session, "SEC_REST", "secrest@company.com", UserRole.EMPLOYEE)
    headers = {"Authorization": f"Bearer {token}"}

    # Self update attempting to alter restricted field (salary/department/role) -> 422 Unprocessable Content
    res_tamper = client.patch("/api/v1/employees/me", json={"department": "Executive"}, headers=headers)
    assert res_tamper.status_code == 422


def test_request_tracing_and_security_headers(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    assert "X-Request-ID" in res.headers
    assert res.headers["X-Content-Type-Options"] == "nosniff"
    assert res.headers["X-Frame-Options"] == "DENY"
