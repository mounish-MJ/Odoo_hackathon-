from decimal import Decimal
from datetime import date
from app.models.user import User, UserRole
from app.models.employee import Employee, EmploymentStatus
from app.models.payroll import Payroll
from app.core.security import hash_password, create_access_token


def create_test_employee(db_session, code: str, email: str, role: UserRole) -> tuple[Employee, User, str]:
    emp = Employee(
        employee_code=code,
        first_name="Pay",
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


def test_payroll_creation_and_decimal_calculation(client, db_session):
    emp, _, token_emp = create_test_employee(db_session, "PAY_001", "pay1@company.com", UserRole.EMPLOYEE)
    _, _, token_hr = create_test_employee(db_session, "PAY_HR", "payhr@company.com", UserRole.HR)

    headers_hr = {"Authorization": f"Bearer {token_hr}"}

    payload = {
        "employee_id": emp.id,
        "pay_period": "2026-08",
        "basic_salary": "5000.50",
        "allowances": "1000.25",
        "deductions": "500.25",
        "currency": "USD"
    }

    response = client.post("/api/v1/payroll", json=payload, headers=headers_hr)
    assert response.status_code == 201
    data = response.json()

    # Verify gross = 5000.50 + 1000.25 = 6000.75, net = 6000.75 - 500.25 = 5500.50
    assert Decimal(str(data["gross_salary"])) == Decimal("6000.75")
    assert Decimal(str(data["net_salary"])) == Decimal("5500.50")


def test_payroll_employee_isolation_and_cross_access_rejection(client, db_session):
    emp_a, _, token_a = create_test_employee(db_session, "PAY_A", "paya@company.com", UserRole.EMPLOYEE)
    emp_b, _, _ = create_test_employee(db_session, "PAY_B", "payb@company.com", UserRole.EMPLOYEE)
    _, _, token_hr = create_test_employee(db_session, "PAY_HR2", "payhr2@company.com", UserRole.HR)

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_hr = {"Authorization": f"Bearer {token_hr}"}

    # HR creates payroll for Emp A and Emp B
    p_a = Payroll(employee_id=emp_a.id, pay_period="2026-08", basic_salary=Decimal("4000.00"), gross_salary=Decimal("4000.00"), net_salary=Decimal("4000.00"))
    p_b = Payroll(employee_id=emp_b.id, pay_period="2026-08", basic_salary=Decimal("6000.00"), gross_salary=Decimal("6000.00"), net_salary=Decimal("6000.00"))
    db_session.add_all([p_a, p_b])
    db_session.commit()

    # 1. Emp A views own payroll list -> 200 OK (1 item for Emp A)
    resp_own = client.get("/api/v1/payroll", headers=headers_a)
    assert resp_own.status_code == 200
    records = resp_own.json()
    assert len(records) == 1
    assert records[0]["employee_id"] == emp_a.id

    # 2. Emp A views own payroll by ID -> 200 OK
    resp_own_id = client.get(f"/api/v1/payroll/{p_a.id}", headers=headers_a)
    assert resp_own_id.status_code == 200

    # 3. Emp A attempts to query Emp B payroll -> 403 Forbidden
    resp_cross_query = client.get(f"/api/v1/payroll?employee_id={emp_b.id}", headers=headers_a)
    assert resp_cross_query.status_code == 403

    # 4. Emp A attempts to query Emp B payroll by ID -> 403 Forbidden
    resp_cross_id = client.get(f"/api/v1/payroll/{p_b.id}", headers=headers_a)
    assert resp_cross_id.status_code == 403

    # 5. HR queries Emp B payroll -> 200 OK
    resp_hr = client.get(f"/api/v1/payroll/{p_b.id}", headers=headers_hr)
    assert resp_hr.status_code == 200
    assert resp_hr.json()["employee_id"] == emp_b.id


def test_payroll_validation_negative_monetary_values(client, db_session):
    emp, _, token_hr = create_test_employee(db_session, "PAY_VAL", "payval@company.com", UserRole.HR)
    headers_hr = {"Authorization": f"Bearer {token_hr}"}

    # Negative basic salary -> 400 Bad Request
    payload_neg = {
        "employee_id": emp.id,
        "pay_period": "2026-08",
        "basic_salary": "-1000.00",
        "allowances": "0.00",
        "deductions": "0.00"
    }
    resp = client.post("/api/v1/payroll", json=payload_neg, headers=headers_hr)
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_MONETARY_VALUE"


def test_payroll_duplicate_period_rejection(client, db_session):
    emp, _, token_hr = create_test_employee(db_session, "PAY_DUP", "paydup@company.com", UserRole.HR)
    headers_hr = {"Authorization": f"Bearer {token_hr}"}

    payload = {
        "employee_id": emp.id,
        "pay_period": "2026-08",
        "basic_salary": "5000.00",
        "allowances": "0.00",
        "deductions": "0.00"
    }
    # First creation -> 201 Created
    client.post("/api/v1/payroll", json=payload, headers=headers_hr)

    # Second creation same period -> 409 Conflict
    resp_dup = client.post("/api/v1/payroll", json=payload, headers=headers_hr)
    assert resp_dup.status_code == 409
    assert resp_dup.json()["error"]["code"] == "CONFLICT"


def test_employee_creation_and_update_denial(client, db_session):
    emp, _, token_emp = create_test_employee(db_session, "PAY_DENY", "paydeny@company.com", UserRole.EMPLOYEE)
    headers_emp = {"Authorization": f"Bearer {token_emp}"}

    payload = {
        "employee_id": emp.id,
        "pay_period": "2026-08",
        "basic_salary": "99999.00",
        "allowances": "0.00",
        "deductions": "0.00"
    }
    # Employee creation attempt -> 403 Forbidden
    resp_create = client.post("/api/v1/payroll", json=payload, headers=headers_emp)
    assert resp_create.status_code == 403
