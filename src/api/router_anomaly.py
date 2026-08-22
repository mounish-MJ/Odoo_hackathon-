from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Depends, status
from src.schemas.anomaly import AttendanceAnomalyResponse, PayrollAnomalyResponse
from src.services.anomaly_engine import anomaly_engine
from src.security.auth import get_current_user, AuthenticatedUser

router = APIRouter(prefix="/api/v1/ai/anomalies", tags=["Anomaly Intelligence"])


@router.get("/attendance", response_model=AttendanceAnomalyResponse, status_code=status.HTTP_200_OK)
def get_attendance_anomalies(
    department: Optional[str] = Query(None, description="Optional department filter"),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Returns attendance anomaly reports based on statistical pattern analysis.
    Enforces MANAGER or HR_ADMIN role authorization.
    """
    if current_user.role not in ["MANAGER", "HR_ADMIN", "SYSTEM_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role '{current_user.role}' is not authorized to view team attendance anomalies."
        )
    try:
        return anomaly_engine.detect_attendance_anomalies(department=department)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Attendance anomaly detection error: {str(e)}")


@router.get("/payroll", response_model=PayrollAnomalyResponse, status_code=status.HTTP_200_OK)
def get_payroll_anomalies(
    month: int = Query(8, ge=1, le=12, description="Payroll month (1-12)"),
    year: int = Query(2026, ge=2020, le=2030, description="Payroll year"),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Returns payroll anomaly reports based on percentage variance analysis.
    Enforces HR_ADMIN role authorization.
    """
    if current_user.role not in ["HR_ADMIN", "SYSTEM_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role '{current_user.role}' is not authorized to view payroll anomaly audits."
        )
    try:
        return anomaly_engine.detect_payroll_anomalies(month=month, year=year)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Payroll anomaly detection error: {str(e)}")
