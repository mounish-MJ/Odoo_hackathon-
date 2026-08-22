from datetime import date
from app.models.user import User, UserRole
from app.models.employee import Employee, EmploymentStatus
from app.core.security import hash_password, create_access_token


def create_additive_test_user(db_session, code: str, email: str, role: UserRole) -> tuple[Employee, User, str]:
    emp = Employee(
        employee_code=code,
        first_name="Additive",
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


def test_leave_balances_endpoint(client, db_session):
    emp1, user1, token1 = create_additive_test_user(db_session, "ADD_EMP1", "addemp1@company.com", UserRole.EMPLOYEE)
    emp2, user2, _ = create_additive_test_user(db_session, "ADD_EMP2", "addemp2@company.com", UserRole.EMPLOYEE)

    headers1 = {"Authorization": f"Bearer {token1}"}

    # 1. Own leave balances -> 200 OK
    res1 = client.get("/api/v1/leaves/balances", headers=headers1)
    assert res1.status_code == 200
    data = res1.json()
    assert data["employee_id"] == emp1.id
    assert len(data["balances"]) == 3

    # 2. Cross-employee leave balances -> 403 Forbidden
    res_idor = client.get(f"/api/v1/leaves/balances?employee_id={emp2.id}", headers=headers1)
    assert res_idor.status_code == 403


def test_employee_dashboard_endpoint(client, db_session):
    emp, user, token = create_additive_test_user(db_session, "ADD_DASH", "adddash@company.com", UserRole.EMPLOYEE)
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/employees/dashboard", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["employee_id"] == emp.id
    assert data["first_name"] == "Additive"


def test_attendance_summary_endpoint(client, db_session):
    emp, user, token = create_additive_test_user(db_session, "ADD_ATT", "addatt@company.com", UserRole.EMPLOYEE)
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/attendance/summary", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["employee_id"] == emp.id
    assert "total_days_present" in data


def test_payroll_summary_endpoint(client, db_session):
    emp, user, token = create_additive_test_user(db_session, "ADD_PAY", "addpay@company.com", UserRole.EMPLOYEE)
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/payroll/summary", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["employee_id"] == emp.id
    assert "gross_ytd" in data


def test_admin_department_summary_endpoint_rbac(client, db_session):
    emp, user, token_emp = create_additive_test_user(db_session, "ADD_DEPT_EMP", "deptemp@company.com", UserRole.EMPLOYEE)
    _, _, token_hr = create_additive_test_user(db_session, "ADD_DEPT_HR", "depthr@company.com", UserRole.HR)

    # 1. Employee role access -> 403 Forbidden
    res_emp = client.get("/api/v1/admin/departments/summary", headers={"Authorization": f"Bearer {token_emp}"})
    assert res_emp.status_code == 403

    # 2. HR role access -> 200 OK
    res_hr = client.get("/api/v1/admin/departments/summary", headers={"Authorization": f"Bearer {token_hr}"})
    assert res_hr.status_code == 200
    data = res_hr.json()
    assert "departments" in data
