from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.schemas.attendance import CheckInResponse, CheckOutResponse, DailyAttendanceRead, WeeklyAttendanceRead
from app.schemas.dashboard import AttendanceSummaryResponse
from app.services.attendance_service import AttendanceService
from app.services.analytics import AnalyticsService
from app.api.deps import get_current_active_verified_user, enforce_self_or_admin

router = APIRouter()


@router.post("/check-in", response_model=CheckInResponse, status_code=status.HTTP_201_CREATED)
def check_in(
    current_user: User = Depends(get_current_active_verified_user),
    db: Session = Depends(get_db)
):
    """Records check-in timestamp for current authenticated employee using server time."""
    return AttendanceService.check_in(db=db, current_user=current_user)


@router.post("/check-out", response_model=CheckOutResponse, status_code=status.HTTP_200_OK)
def check_out(
    current_user: User = Depends(get_current_active_verified_user),
    db: Session = Depends(get_db)
):
    """Records check-out timestamp for current authenticated employee."""
    return AttendanceService.check_out(db=db, current_user=current_user)


@router.get("/summary", response_model=AttendanceSummaryResponse, status_code=status.HTTP_200_OK)
def get_attendance_summary(
    employee_id: Optional[str] = Query(None, description="Target employee ID (defaults to current user)"),
    year_month: Optional[str] = Query(None, description="Year and month (YYYY-MM)"),
    current_user: User = Depends(get_current_active_verified_user),
    db: Session = Depends(get_db)
):
    """Calculates monthly attendance summary statistics (present days, absent days, total hours)."""
    target_emp_id = employee_id or current_user.employee_id
    enforce_self_or_admin(current_user, target_emp_id)
    return AnalyticsService.get_attendance_summary(db=db, employee_id=target_emp_id, year_month=year_month)


@router.get("/daily", response_model=DailyAttendanceRead, status_code=status.HTTP_200_OK)
def get_daily_attendance(
    attendance_date: Optional[date] = Query(None, alias="date", description="Target date (defaults to today)"),
    employee_id: Optional[str] = Query(None, description="Employee ID (defaults to current user)"),
    current_user: User = Depends(get_current_active_verified_user),
    db: Session = Depends(get_db)
):
    """Retrieves daily attendance record. Enforces server-side employee isolation."""
    return AttendanceService.get_daily_attendance(
        db=db,
        current_user=current_user,
        query_date=attendance_date,
        target_employee_id=employee_id
    )


@router.get("/weekly", response_model=WeeklyAttendanceRead, status_code=status.HTTP_200_OK)
def get_weekly_attendance(
    ref_date: Optional[date] = Query(None, description="Reference date within the target week"),
    employee_id: Optional[str] = Query(None, description="Employee ID (defaults to current user)"),
    current_user: User = Depends(get_current_active_verified_user),
    db: Session = Depends(get_db)
):
    """Retrieves weekly attendance summary (Monday through Sunday). Enforces server-side employee isolation."""
    return AttendanceService.get_weekly_attendance(
        db=db,
        current_user=current_user,
        ref_date=ref_date,
        target_employee_id=employee_id
    )
