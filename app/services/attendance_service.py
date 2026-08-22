from datetime import date, datetime, timedelta, timezone
from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.employee import Employee
from app.models.attendance import Attendance, AttendanceStatus
from app.schemas.attendance import CheckInResponse, CheckOutResponse, DailyAttendanceRead, WeeklyAttendanceRead
from app.core.exceptions import HRCoreException, ConflictError, EntityNotFoundError
from app.api.deps import enforce_self_or_admin


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AttendanceService:

    @staticmethod
    def check_in(db: Session, current_user: User) -> CheckInResponse:
        """Processes check-in for the currently authenticated employee using authoritative server timestamp."""
        if not current_user.employee_id:
            raise HRCoreException(
                status_code=400,
                code="NO_EMPLOYEE_PROFILE",
                message="User account is not linked to an employee profile."
            )

        now = utc_now()
        today = now.date()

        # Check existing attendance record for today
        existing = db.query(Attendance).filter(
            Attendance.employee_id == current_user.employee_id,
            Attendance.attendance_date == today
        ).first()

        if existing:
            raise ConflictError(message="Employee has already checked in for today.")

        attendance = Attendance(
            employee_id=current_user.employee_id,
            attendance_date=today,
            check_in=now,
            check_out=None,
            status=AttendanceStatus.PRESENT
        )
        db.add(attendance)
        db.commit()
        db.refresh(attendance)

        return CheckInResponse(
            message="Check-in recorded successfully.",
            attendance=attendance
        )

    @staticmethod
    def check_out(db: Session, current_user: User) -> CheckOutResponse:
        """Processes check-out for the currently authenticated employee."""
        if not current_user.employee_id:
            raise HRCoreException(
                status_code=400,
                code="NO_EMPLOYEE_PROFILE",
                message="User account is not linked to an employee profile."
            )

        now = utc_now()
        today = now.date()

        attendance = db.query(Attendance).filter(
            Attendance.employee_id == current_user.employee_id,
            Attendance.attendance_date == today
        ).first()

        if not attendance or not attendance.check_in:
            raise HRCoreException(
                status_code=400,
                code="NO_CHECK_IN",
                message="No active check-in record found for today. Cannot check out without checking in."
            )

        if attendance.check_out is not None:
            raise ConflictError(message="Employee has already checked out for today.")

        attendance.check_out = now
        db.commit()
        db.refresh(attendance)

        return CheckOutResponse(
            message="Check-out recorded successfully.",
            attendance=attendance
        )

    @staticmethod
    def get_daily_attendance(
        db: Session,
        current_user: User,
        query_date: Optional[date] = None,
        target_employee_id: Optional[str] = None
    ) -> DailyAttendanceRead:
        """Retrieves daily attendance record for specified employee and date."""
        emp_id = target_employee_id or current_user.employee_id
        if not emp_id:
            raise HRCoreException(status_code=400, code="NO_EMPLOYEE_PROFILE", message="Employee ID required.")

        enforce_self_or_admin(current_user=current_user, target_employee_id=emp_id)

        target_date = query_date or utc_now().date()
        attendance = db.query(Attendance).filter(
            Attendance.employee_id == emp_id,
            Attendance.attendance_date == target_date
        ).first()

        return DailyAttendanceRead(
            date=target_date,
            employee_id=emp_id,
            attendance=attendance
        )

    @staticmethod
    def get_weekly_attendance(
        db: Session,
        current_user: User,
        ref_date: Optional[date] = None,
        target_employee_id: Optional[str] = None
    ) -> WeeklyAttendanceRead:
        """Retrieves weekly attendance summary (Monday through Sunday) for specified employee."""
        emp_id = target_employee_id or current_user.employee_id
        if not emp_id:
            raise HRCoreException(status_code=400, code="NO_EMPLOYEE_PROFILE", message="Employee ID required.")

        enforce_self_or_admin(current_user=current_user, target_employee_id=emp_id)

        base_date = ref_date or utc_now().date()
        monday = base_date - timedelta(days=base_date.weekday())
        sunday = monday + timedelta(days=6)

        records = db.query(Attendance).filter(
            Attendance.employee_id == emp_id,
            Attendance.attendance_date >= monday,
            Attendance.attendance_date <= sunday
        ).order_by(Attendance.attendance_date.asc()).all()

        present_count = sum(1 for r in records if r.status in [AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.HALF_DAY])

        return WeeklyAttendanceRead(
            start_date=monday,
            end_date=sunday,
            employee_id=emp_id,
            total_days_present=present_count,
            records=records
        )
