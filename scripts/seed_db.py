import sys
import os
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

# Add root directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import SessionLocal, engine
from app.db.base import Base
from app.core.security import hash_password
from app.core.logging import logger
from app.models import (
    User, UserRole,
    Employee, EmploymentStatus,
    Attendance, AttendanceStatus,
    LeaveRequest, LeaveType, LeaveStatus,
    Payroll
)


def seed_database():
    """Populates the database with realistic demo dataset for development & testing."""
    logger.info("Initializing database tables for seed script...")
    Base.metadata.create_all(bind=engine)

    session = SessionLocal()
    try:
        # Check if database already has users
        existing_users = session.query(User).count()
        if existing_users > 0:
            logger.info("Database already seeded. Skipping seed execution.")
            return

        logger.info("Seeding demo HR Core dataset...")

        # 1. Create Employees
        emp_admin = Employee(
            employee_code="EMP001",
            first_name="Alice",
            last_name="SystemAdmin",
            email="admin@company.com",
            phone="+1-555-0101",
            department="Executive",
            designation="System Administrator",
            date_of_joining=date(2023, 1, 15),
            employment_status=EmploymentStatus.FULL_TIME
        )
        emp_hr = Employee(
            employee_code="EMP002",
            first_name="Bob",
            last_name="HRManager",
            email="hr.bob@company.com",
            phone="+1-555-0102",
            department="Human Resources",
            designation="HR Manager",
            date_of_joining=date(2023, 3, 1),
            employment_status=EmploymentStatus.FULL_TIME
        )
        session.add_all([emp_admin, emp_hr])
        session.flush()

        emp_dev = Employee(
            employee_code="EMP003",
            first_name="Charlie",
            last_name="SoftwareEngineer",
            email="charlie.dev@company.com",
            phone="+1-555-0103",
            department="Engineering",
            designation="Senior Software Engineer",
            date_of_joining=date(2023, 6, 15),
            employment_status=EmploymentStatus.FULL_TIME,
            manager_id=emp_admin.id
        )
        session.add(emp_dev)
        session.flush()

        # 2. Create Users linked to Employees
        default_password = hash_password("DevPassword123!")

        user_admin = User(
            email="admin@company.com",
            password_hash=default_password,
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
            employee_id=emp_admin.id
        )
        user_hr = User(
            email="hr.bob@company.com",
            password_hash=default_password,
            role=UserRole.HR,
            is_active=True,
            is_verified=True,
            employee_id=emp_hr.id
        )
        user_dev = User(
            email="charlie.dev@company.com",
            password_hash=default_password,
            role=UserRole.EMPLOYEE,
            is_active=True,
            is_verified=True,
            employee_id=emp_dev.id
        )
        session.add_all([user_admin, user_hr, user_dev])
        session.flush()

        # Link user_id back to Employee profiles
        emp_admin.user_id = user_admin.id
        emp_hr.user_id = user_hr.id
        emp_dev.user_id = user_dev.id

        # 3. Create Attendance History
        today = date.today()
        attendance_entries = []
        for days_ago in range(5, 0, -1):
            att_date = today - timedelta(days=days_ago)
            # Skip weekend
            if att_date.weekday() in (5, 6):
                continue
            
            att_entry = Attendance(
                employee_id=emp_dev.id,
                attendance_date=att_date,
                check_in=datetime.combine(att_date, datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=9),
                check_out=datetime.combine(att_date, datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=17),
                status=AttendanceStatus.PRESENT
            )
            attendance_entries.append(att_entry)
        
        session.add_all(attendance_entries)

        # 4. Create Leave Request
        leave_req = LeaveRequest(
            employee_id=emp_dev.id,
            leave_type=LeaveType.ANNUAL,
            start_date=today + timedelta(days=10),
            end_date=today + timedelta(days=12),
            reason="Annual vacation leave request",
            status=LeaveStatus.APPROVED,
            reviewed_by=emp_hr.id,
            reviewed_at=datetime.now(timezone.utc),
            review_comment="Approved. Enjoy your vacation!"
        )
        session.add(leave_req)

        # 5. Create Payroll Records
        pay_period = today.strftime("%Y-%m")
        payroll_dev = Payroll(
            employee_id=emp_dev.id,
            pay_period=pay_period,
            basic_salary=Decimal("8000.00"),
            allowances=Decimal("1200.00"),
            deductions=Decimal("1500.00"),
            gross_salary=Decimal("9200.00"),
            net_salary=Decimal("7700.00"),
            currency="USD"
        )
        session.add(payroll_dev)

        session.commit()
        logger.info("Successfully seeded demo HR Core database!")

    except Exception as e:
        session.rollback()
        logger.error(f"Failed to seed database: {str(e)}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    seed_database()
