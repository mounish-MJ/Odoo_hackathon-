from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from app.models import (
    User, UserRole,
    Employee, EmploymentStatus,
    Attendance, AttendanceStatus,
    LeaveRequest, LeaveType, LeaveStatus,
    Payroll
)
from app.core.security import hash_password, verify_password


def test_user_and_employee_relationship(db_session):
    # Create employee profile
    employee = Employee(
        employee_code="TEST001",
        first_name="Jane",
        last_name="Doe",
        email="jane.doe@example.com",
        phone="+1234567890",
        department="Engineering",
        designation="Software Engineer",
        date_of_joining=date(2024, 1, 1),
        employment_status=EmploymentStatus.FULL_TIME
    )
    db_session.add(employee)
    db_session.flush()

    # Create user account
    hashed_pwd = hash_password("Secret123!")
    user = User(
        email="jane.doe@example.com",
        password_hash=hashed_pwd,
        role=UserRole.EMPLOYEE,
        employee_id=employee.id
    )
    db_session.add(user)
    db_session.flush()

    employee.user_id = user.id
    db_session.commit()

    # Verify query
    saved_user = db_session.query(User).filter_by(email="jane.doe@example.com").first()
    assert saved_user is not None
    assert verify_password("Secret123!", saved_user.password_hash) is True
    assert saved_user.employee.employee_code == "TEST001"
    assert saved_user.role == UserRole.EMPLOYEE


def test_attendance_model(db_session):
    employee = Employee(
        employee_code="TEST002",
        first_name="John",
        last_name="Smith",
        email="john.smith@example.com",
        department="Sales",
        designation="Account Executive",
        date_of_joining=date(2024, 2, 1)
    )
    db_session.add(employee)
    db_session.flush()

    today = date.today()
    now_utc = datetime.now(timezone.utc)
    attendance = Attendance(
        employee_id=employee.id,
        attendance_date=today,
        check_in=now_utc - timedelta(hours=8),
        check_out=now_utc,
        status=AttendanceStatus.PRESENT
    )
    db_session.add(attendance)
    db_session.commit()

    saved_att = db_session.query(Attendance).filter_by(employee_id=employee.id).first()
    assert saved_att is not None
    assert saved_att.attendance_date == today
    assert saved_att.status == AttendanceStatus.PRESENT


def test_leave_request_model(db_session):
    employee = Employee(
        employee_code="TEST003",
        first_name="Bob",
        last_name="Builder",
        email="bob.builder@example.com",
        department="Operations",
        designation="Operations Lead",
        date_of_joining=date(2024, 3, 1)
    )
    db_session.add(employee)
    db_session.flush()

    leave = LeaveRequest(
        employee_id=employee.id,
        leave_type=LeaveType.SICK,
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 3),
        reason="Flu symptoms",
        status=LeaveStatus.PENDING
    )
    db_session.add(leave)
    db_session.commit()

    saved_leave = db_session.query(LeaveRequest).filter_by(employee_id=employee.id).first()
    assert saved_leave is not None
    assert saved_leave.leave_type == LeaveType.SICK
    assert saved_leave.status == LeaveStatus.PENDING


def test_payroll_model(db_session):
    employee = Employee(
        employee_code="TEST004",
        first_name="Mary",
        last_name="Poppins",
        email="mary.poppins@example.com",
        department="Finance",
        designation="Financial Analyst",
        date_of_joining=date(2024, 4, 1)
    )
    db_session.add(employee)
    db_session.flush()

    payroll = Payroll(
        employee_id=employee.id,
        pay_period="2026-08",
        basic_salary=Decimal("5000.00"),
        allowances=Decimal("500.00"),
        deductions=Decimal("300.00"),
        gross_salary=Decimal("5500.00"),
        net_salary=Decimal("5200.00"),
        currency="USD"
    )
    db_session.add(payroll)
    db_session.commit()

    saved_payroll = db_session.query(Payroll).filter_by(employee_id=employee.id).first()
    assert saved_payroll is not None
    assert saved_payroll.pay_period == "2026-08"
    assert saved_payroll.net_salary == Decimal("5200.00")
