from datetime import date, datetime, timedelta, timezone
from app.models.user import User, UserRole
from app.models.employee import Employee, EmploymentStatus
from app.core.security import hash_password, create_access_token


def create_test_employee(db_session, code: str, email: str, role: UserRole) -> tuple[Employee, User, str]:
    emp = Employee(
        employee_code=code,
        first_name="Att",
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


def test_check_in_and_duplicate_prevention(client, db_session):
    emp, user, token = create_test_employee(db_session, "ATT_001", "att1@company.com", UserRole.EMPLOYEE)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. First check-in -> 201 Created
    response = client.post("/api/v1/attendance/check-in", headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["attendance"]["employee_id"] == emp.id
    assert data["attendance"]["check_in"] is not None
    assert data["attendance"]["check_out"] is None

    # 2. Duplicate check-in -> 409 Conflict
    resp_dup = client.post("/api/v1/attendance/check-in", headers=headers)
    assert resp_dup.status_code == 409
    assert resp_dup.json()["error"]["code"] == "CONFLICT"


def test_check_out_and_invalid_scenarios(client, db_session):
    emp, user, token = create_test_employee(db_session, "ATT_002", "att2@company.com", UserRole.EMPLOYEE)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Check-out without check-in -> 400 Bad Request
    resp_no_in = client.post("/api/v1/attendance/check-out", headers=headers)
    assert resp_no_in.status_code == 400
    assert resp_no_in.json()["error"]["code"] == "NO_CHECK_IN"

    # 2. Check in first
    client.post("/api/v1/attendance/check-in", headers=headers)

    # 3. Successful check-out -> 200 OK
    resp_out = client.post("/api/v1/attendance/check-out", headers=headers)
    assert resp_out.status_code == 200
    assert resp_out.json()["attendance"]["check_out"] is not None

    # 4. Duplicate check-out -> 409 Conflict
    resp_dup_out = client.post("/api/v1/attendance/check-out", headers=headers)
    assert resp_dup_out.status_code == 409
    assert resp_dup_out.json()["error"]["code"] == "CONFLICT"


def test_daily_and_weekly_attendance_isolation(client, db_session):
    emp_a, _, token_a = create_test_employee(db_session, "ATT_A", "atta@company.com", UserRole.EMPLOYEE)
    emp_b, _, _ = create_test_employee(db_session, "ATT_B", "attb@company.com", UserRole.EMPLOYEE)
    _, _, token_hr = create_test_employee(db_session, "ATT_HR", "atthr@company.com", UserRole.HR)

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_hr = {"Authorization": f"Bearer {token_hr}"}

    # Check in Emp A
    client.post("/api/v1/attendance/check-in", headers=headers_a)

    # Emp A views own daily -> 200 OK
    resp_daily = client.get("/api/v1/attendance/daily", headers=headers_a)
    assert resp_daily.status_code == 200
    assert resp_daily.json()["attendance"]["employee_id"] == emp_a.id

    # Emp A attempts to view Emp B daily -> 403 Forbidden
    resp_daily_other = client.get(f"/api/v1/attendance/daily?employee_id={emp_b.id}", headers=headers_a)
    assert resp_daily_other.status_code == 403

    # Emp A views own weekly -> 200 OK
    resp_weekly = client.get("/api/v1/attendance/weekly", headers=headers_a)
    assert resp_weekly.status_code == 200
    assert resp_weekly.json()["employee_id"] == emp_a.id
    assert resp_weekly.json()["total_days_present"] == 1

    # HR views Emp A weekly -> 200 OK
    resp_hr_weekly = client.get(f"/api/v1/attendance/weekly?employee_id={emp_a.id}", headers=headers_hr)
    assert resp_hr_weekly.status_code == 200
    assert resp_hr_weekly.json()["total_days_present"] == 1
