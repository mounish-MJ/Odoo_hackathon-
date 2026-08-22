from datetime import date, timedelta
from app.models.user import User, UserRole
from app.models.employee import Employee, EmploymentStatus
from app.models.leave import LeaveType, LeaveStatus
from app.core.security import hash_password, create_access_token


def create_test_employee(db_session, code: str, email: str, role: UserRole) -> tuple[Employee, User, str]:
    emp = Employee(
        employee_code=code,
        first_name="Leave",
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


def test_apply_leave_success_and_invalid_date_validation(client, db_session):
    emp, user, token = create_test_employee(db_session, "LEV_001", "lev1@company.com", UserRole.EMPLOYEE)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Invalid date range (start > end) -> 400 Bad Request
    invalid_payload = {
        "leave_type": "CASUAL",
        "start_date": "2026-09-10",
        "end_date": "2026-09-05",
        "reason": "Invalid dates"
    }
    resp_invalid = client.post("/api/v1/leaves", json=invalid_payload, headers=headers)
    assert resp_invalid.status_code == 400
    assert resp_invalid.json()["error"]["code"] == "INVALID_DATE_RANGE"

    # 2. Valid leave application -> 201 Created with PENDING status
    valid_payload = {
        "leave_type": "ANNUAL",
        "start_date": "2026-09-01",
        "end_date": "2026-09-05",
        "reason": "Annual vacation"
    }
    resp_valid = client.post("/api/v1/leaves", json=valid_payload, headers=headers)
    assert resp_valid.status_code == 201
    data = resp_valid.json()
    assert data["employee_id"] == emp.id
    assert data["status"] == "PENDING"
    assert data["leave_type"] == "ANNUAL"


def test_leave_listing_and_employee_isolation(client, db_session):
    emp_a, _, token_a = create_test_employee(db_session, "LEV_A", "leva@company.com", UserRole.EMPLOYEE)
    emp_b, _, token_b = create_test_employee(db_session, "LEV_B", "levb@company.com", UserRole.EMPLOYEE)
    _, _, token_hr = create_test_employee(db_session, "LEV_HR", "levhr@company.com", UserRole.HR)

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_hr = {"Authorization": f"Bearer {token_hr}"}

    # Emp A applies for leave
    client.post("/api/v1/leaves", json={"leave_type": "SICK", "start_date": "2026-10-01", "end_date": "2026-10-02"}, headers=headers_a)

    # Emp A views own leave listing -> 200 OK (contains 1 item)
    resp_own = client.get("/api/v1/leaves", headers=headers_a)
    assert resp_own.status_code == 200
    assert len(resp_own.json()) == 1

    # Emp A attempts to list Emp B leaves -> 403 Forbidden
    resp_isolation = client.get(f"/api/v1/leaves?employee_id={emp_b.id}", headers=headers_a)
    assert resp_isolation.status_code == 403

    # HR views Emp A leaves -> 200 OK
    resp_hr = client.get(f"/api/v1/leaves?employee_id={emp_a.id}", headers=headers_hr)
    assert resp_hr.status_code == 200
    assert len(resp_hr.json()) == 1


def test_leave_approval_rejection_workflows(client, db_session):
    emp, _, token_emp = create_test_employee(db_session, "LEV_TARGET", "target.lev@company.com", UserRole.EMPLOYEE)
    hr_emp, _, token_hr = create_test_employee(db_session, "LEV_HR2", "hr2.lev@company.com", UserRole.HR)
    admin_emp, _, token_admin = create_test_employee(db_session, "LEV_ADM", "adm.lev@company.com", UserRole.ADMIN)

    headers_emp = {"Authorization": f"Bearer {token_emp}"}
    headers_hr = {"Authorization": f"Bearer {token_hr}"}
    headers_admin = {"Authorization": f"Bearer {token_admin}"}

    # Employee submits leave request
    resp_create = client.post("/api/v1/leaves", json={"leave_type": "CASUAL", "start_date": "2026-11-01", "end_date": "2026-11-02"}, headers=headers_emp)
    leave_id = resp_create.json()["id"]

    # 1. Employee self-approval attempt -> 403 Forbidden
    resp_self_appr = client.patch(f"/api/v1/leaves/{leave_id}/approve", json={"review_comment": "Self approve"}, headers=headers_emp)
    assert resp_self_appr.status_code == 403

    # 2. HR approves leave -> 200 OK with APPROVED status
    resp_appr = client.patch(f"/api/v1/leaves/{leave_id}/approve", json={"review_comment": "Approved by HR"}, headers=headers_hr)
    assert resp_appr.status_code == 200
    data_appr = resp_appr.json()
    assert data_appr["status"] == "APPROVED"
    assert data_appr["reviewed_by"] == hr_emp.id
    assert data_appr["review_comment"] == "Approved by HR"

    # 3. Invalid state transition (re-rejecting approved leave) -> 409 Conflict
    resp_re_reject = client.patch(f"/api/v1/leaves/{leave_id}/reject", json={"review_comment": "Change mind"}, headers=headers_admin)
    assert resp_re_reject.status_code == 409
    assert resp_re_reject.json()["error"]["code"] == "CONFLICT"
