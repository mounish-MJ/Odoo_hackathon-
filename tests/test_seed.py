from unittest.mock import patch
from scripts.seed_db import seed_database
from app.models import User, Employee, Attendance, LeaveRequest, Payroll


def test_seed_database_execution(db_session):
    with patch("scripts.seed_db.SessionLocal", return_value=db_session), \
         patch("scripts.seed_db.engine", db_session.bind):
        
        # Execute seed
        seed_database()

        users_count = db_session.query(User).count()
        employees_count = db_session.query(Employee).count()
        attendance_count = db_session.query(Attendance).count()
        leave_count = db_session.query(LeaveRequest).count()
        payroll_count = db_session.query(Payroll).count()

        assert users_count >= 3
        assert employees_count >= 3
        assert attendance_count > 0
        assert leave_count > 0
        assert payroll_count > 0

        # Run seed again to verify idempotency
        seed_database()
        assert db_session.query(User).count() == users_count
