from datetime import date
from app.models.user import User, UserRole
from app.models.employee import Employee, EmploymentStatus
from app.models.leave import LeaveRequest, LeaveType, LeaveStatus
from app.core.security import hash_password, create_access_token


def create_m4_test_user(db_session, code: str, email: str, role: UserRole, manager_id: str = None) -> tuple[Employee, User, str]:
    emp = Employee(
        employee_code=code,
        first_name="Member4",
        last_name=code,
        email=email,
        department="Engineering",
        designation="Software Engineer",
        date_of_joining=date(2024, 1, 1),
        employment_status=EmploymentStatus.FULL_TIME,
        manager_id=manager_id
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


def test_member4_leaves_balances_by_user(client, db_session):
    emp1, user1, token1 = create_m4_test_user(db_session, "M4_E1", "m4e1@company.com", UserRole.EMPLOYEE)
    emp2, user2, token2 = create_m4_test_user(db_session, "M4_E2", "m4e2@company.com", UserRole.EMPLOYEE)
    _, _, hr_token = create_m4_test_user(db_session, "M4_HR", "m4hr@company.com", UserRole.HR)

    headers1 = {"Authorization": f"Bearer {token1}"}
    headers_hr = {"Authorization": f"Bearer {hr_token}"}

    # Self balance query by user_id
    res_self = client.get(f"/api/v1/leaves/balances/{user1.id}?type=ANNUAL", headers=headers1)
    assert res_self.status_code == 200
    assert len(res_self.json()["balances"]) == 1
    assert res_self.json()["balances"][0]["leave_type"] == "ANNUAL"

    # Self balance query by employee_id
    res_self_emp = client.get(f"/api/v1/leaves/balances/{emp1.id}", headers=headers1)
    assert res_self_emp.status_code == 200

    # Cross-employee access (IDOR) forbidden for employee
    res_idor = client.get(f"/api/v1/leaves/balances/{emp2.id}", headers=headers1)
    assert res_idor.status_code == 403

    # HR access permitted for any employee
    res_hr = client.get(f"/api/v1/leaves/balances/{emp1.id}", headers=headers_hr)
    assert res_hr.status_code == 200


def test_member4_deduct_leave_balance(client, db_session):
    emp, user, token = create_m4_test_user(db_session, "M4_D1", "m4d1@company.com", UserRole.EMPLOYEE)
    _, _, hr_token = create_m4_test_user(db_session, "M4_DHR", "m4dhr@company.com", UserRole.HR)

    # Employee attempt to deduct balance -> 403 Forbidden
    res_emp = client.post(
        "/api/v1/leaves/deduct-balance",
        json={"user_id": emp.id, "leave_type": "ANNUAL", "days": 2},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res_emp.status_code == 403

    # HR attempt -> 200 OK
    res_hr = client.post(
        "/api/v1/leaves/deduct-balance",
        json={"user_id": emp.id, "leave_type": "ANNUAL", "days": 2},
        headers={"Authorization": f"Bearer {hr_token}"}
    )
    assert res_hr.status_code == 200
    assert res_hr.json()["deducted_days"] == 2


def test_member4_update_leave_status(client, db_session):
    emp, user, token = create_m4_test_user(db_session, "M4_S1", "m4s1@company.com", UserRole.EMPLOYEE)
    _, _, hr_token = create_m4_test_user(db_session, "M4_SHR", "m4shr@company.com", UserRole.HR)

    # Create pending leave
    leave = LeaveRequest(
        employee_id=emp.id,
        leave_type=LeaveType.ANNUAL,
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 3),
        status=LeaveStatus.PENDING
    )
    db_session.add(leave)
    db_session.commit()

    headers_emp = {"Authorization": f"Bearer {token}"}
    headers_hr = {"Authorization": f"Bearer {hr_token}"}

    # Employee approval attempt -> 403 Forbidden
    res_app_emp = client.patch(f"/api/v1/leaves/{leave.id}/status", json={"status": "APPROVED"}, headers=headers_emp)
    assert res_app_emp.status_code == 403

    # HR approval attempt -> 200 OK
    res_app_hr = client.patch(f"/api/v1/leaves/{leave.id}/status", json={"status": "APPROVED", "review_comments": "Approved by HR"}, headers=headers_hr)
    assert res_app_hr.status_code == 200
    assert res_app_hr.json()["status"] == "APPROVED"

    # Cancellation by self for PENDING leave
    leave2 = LeaveRequest(
        employee_id=emp.id,
        leave_type=LeaveType.SICK,
        start_date=date(2026, 10, 1),
        end_date=date(2026, 10, 2),
        status=LeaveStatus.PENDING
    )
    db_session.add(leave2)
    db_session.commit()

    res_cancel = client.patch(f"/api/v1/leaves/{leave2.id}/status", json={"status": "CANCELLED"}, headers=headers_emp)
    assert res_cancel.status_code == 200
    assert res_cancel.json()["status"] == "CANCELLED"


def test_member4_attendance_by_user(client, db_session):
    emp1, user1, token1 = create_m4_test_user(db_session, "M4_A1", "m4a1@company.com", UserRole.EMPLOYEE)
    emp2, user2, _ = create_m4_test_user(db_session, "M4_A2", "m4a2@company.com", UserRole.EMPLOYEE)

    headers1 = {"Authorization": f"Bearer {token1}"}

    # Self query
    res1 = client.get(f"/api/v1/attendance/employee/{user1.id}", headers=headers1)
    assert res1.status_code == 200
    assert isinstance(res1.json(), list)

    # IDOR query forbidden
    res2 = client.get(f"/api/v1/attendance/employee/{user2.id}", headers=headers1)
    assert res2.status_code == 403


def test_member4_payroll_by_user(client, db_session):
    emp1, user1, token1 = create_m4_test_user(db_session, "M4_P1", "m4p1@company.com", UserRole.EMPLOYEE)
    emp2, user2, _ = create_m4_test_user(db_session, "M4_P2", "m4p2@company.com", UserRole.EMPLOYEE)

    headers1 = {"Authorization": f"Bearer {token1}"}

    # Self query
    res1 = client.get(f"/api/v1/payroll/employee/{user1.id}", headers=headers1)
    assert res1.status_code == 200
    assert isinstance(res1.json(), list)

    # IDOR query forbidden
    res2 = client.get(f"/api/v1/payroll/employee/{user2.id}", headers=headers1)
    assert res2.status_code == 403


def test_member4_employee_manager(client, db_session):
    mgr, user_mgr, _ = create_m4_test_user(db_session, "M4_MGR", "m4mgr@company.com", UserRole.HR)
    emp, user_emp, token_emp = create_m4_test_user(db_session, "M4_SUB", "m4sub@company.com", UserRole.EMPLOYEE, manager_id=mgr.id)

    headers_emp = {"Authorization": f"Bearer {token_emp}"}

    # Manager lookup for self
    res = client.get(f"/api/v1/employees/{user_emp.id}/manager", headers=headers_emp)
    assert res.status_code == 200
    assert res.json()["id"] == mgr.id
    assert res.json()["first_name"] == "Member4"
