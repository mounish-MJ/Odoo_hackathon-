from datetime import date
from app.models.user import User, UserRole
from app.models.employee import Employee, EmploymentStatus
from app.core.security import hash_password, create_access_token


def create_test_employee(db_session, code: str, email: str, role: UserRole) -> tuple[Employee, User, str]:
    emp = Employee(
        employee_code=code,
        first_name="First",
        last_name=code,
        email=email,
        department="Engineering",
        designation="Developer",
        date_of_joining=date(2024, 1, 1),
        employment_status=EmploymentStatus.FULL_TIME
    )
    db_session.add(emp)
    db_session.flush()

    user = User(
        email=email,
        password_hash=hash_password("Password123!"),
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


def test_get_own_profile(client, db_session):
    emp, user, token = create_test_employee(db_session, "EMP_ME_1", "me1@company.com", UserRole.EMPLOYEE)
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/api/v1/employees/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == emp.id
    assert data["employee_code"] == "EMP_ME_1"
    assert data["email"] == "me1@company.com"


def test_update_own_profile_phone(client, db_session):
    emp, user, token = create_test_employee(db_session, "EMP_ME_2", "me2@company.com", UserRole.EMPLOYEE)
    headers = {"Authorization": f"Bearer {token}"}

    response = client.patch("/api/v1/employees/me", json={"phone": "+1-555-9999"}, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["phone"] == "+1-555-9999"


def test_update_own_profile_restricted_fields_forbidden(client, db_session):
    emp, user, token = create_test_employee(db_session, "EMP_ME_3", "me3@company.com", UserRole.EMPLOYEE)
    headers = {"Authorization": f"Bearer {token}"}

    # Extra/restricted field should be forbidden by schema
    response = client.patch("/api/v1/employees/me", json={"department": "Executive", "phone": "+1-555-8888"}, headers=headers)
    assert response.status_code == 422


def test_employee_isolation(client, db_session):
    emp_a, _, token_a = create_test_employee(db_session, "EMP_A", "empa@company.com", UserRole.EMPLOYEE)
    emp_b, _, _ = create_test_employee(db_session, "EMP_B", "empb@company.com", UserRole.EMPLOYEE)

    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Employee A accessing Employee A profile -> 200
    resp_own = client.get(f"/api/v1/employees/{emp_a.id}", headers=headers_a)
    assert resp_own.status_code == 200

    # Employee A accessing Employee B profile -> 403 Forbidden
    resp_other = client.get(f"/api/v1/employees/{emp_b.id}", headers=headers_a)
    assert resp_other.status_code == 403
    assert resp_other.json()["error"]["code"] == "FORBIDDEN"


def test_hr_and_admin_profile_access_and_management(client, db_session):
    emp, _, _ = create_test_employee(db_session, "EMP_TARGET", "target@company.com", UserRole.EMPLOYEE)
    _, _, token_hr = create_test_employee(db_session, "EMP_HR", "hr@company.com", UserRole.HR)
    _, _, token_admin = create_test_employee(db_session, "EMP_ADMIN", "admin@company.com", UserRole.ADMIN)

    headers_hr = {"Authorization": f"Bearer {token_hr}"}
    headers_admin = {"Authorization": f"Bearer {token_admin}"}

    # HR viewing employee profile -> 200
    assert client.get(f"/api/v1/employees/{emp.id}", headers=headers_hr).status_code == 200

    # Admin updating employee administrative fields -> 200
    resp_update = client.patch(
        f"/api/v1/employees/{emp.id}",
        json={"department": "Product", "designation": "Staff Engineer"},
        headers=headers_admin
    )
    assert resp_update.status_code == 200
    data = resp_update.json()
    assert data["department"] == "Product"
    assert data["designation"] == "Staff Engineer"
