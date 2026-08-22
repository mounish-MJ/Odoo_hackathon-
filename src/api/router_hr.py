from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Header, Query, status
from pydantic import BaseModel
from src.adapters.member1_adapter import member1_adapter
from src.security.auth import get_current_user, AuthenticatedUser

router = APIRouter(prefix="/api/v1", tags=["HR Core Services"])


class CreateLeaveRequestPayload(BaseModel):
    leave_type: str
    start_date: str
    end_date: str
    reason: str


@router.get("/employees/me", status_code=status.HTTP_200_OK)
def get_current_employee_profile(
    current_user: AuthenticatedUser = Depends(get_current_user),
    authorization: Optional[str] = Header(None)
):
    """Returns profile for currently authenticated user via Member 1 Adapter."""
    token = authorization.split(" ")[1] if authorization and "Bearer " in authorization else None
    return member1_adapter.get_current_employee(auth_token=token)


@router.get("/leaves", status_code=status.HTTP_200_OK)
def get_leaves(
    status: Optional[str] = Query(None),
    employee_id: Optional[str] = Query(None),
    current_user: AuthenticatedUser = Depends(get_current_user),
    authorization: Optional[str] = Header(None)
):
    """Fetches leave summary and balances for authenticated employee."""
    token = authorization.split(" ")[1] if authorization and "Bearer " in authorization else None
    user_id = employee_id or current_user.user_id
    return member1_adapter.get_leave_balances(user_id=user_id, auth_token=token)


@router.post("/leaves", status_code=status.HTTP_201_CREATED)
def create_leave(
    payload: CreateLeaveRequestPayload,
    current_user: AuthenticatedUser = Depends(get_current_user),
    authorization: Optional[str] = Header(None)
):
    """Creates a leave application via Member 1 Adapter."""
    token = authorization.split(" ")[1] if authorization and "Bearer " in authorization else None
    res = member1_adapter.create_leave_request(
        user_id=current_user.user_id,
        leave_type=payload.leave_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        reason=payload.reason,
        auth_token=token
    )
    if isinstance(res, dict) and res.get("status") == "ERROR":
        raise HTTPException(
            status_code=res.get("status_code", status.HTTP_400_BAD_REQUEST),
            detail=res.get("message", "Leave creation failed.")
        )
    return res


@router.get("/attendance/daily", status_code=status.HTTP_200_OK)
def get_daily_attendance(
    date: str = Query("2026-08-20"),
    current_user: AuthenticatedUser = Depends(get_current_user),
    authorization: Optional[str] = Header(None)
):
    """Fetches daily attendance via Member 1 Adapter."""
    token = authorization.split(" ")[1] if authorization and "Bearer " in authorization else None
    return member1_adapter.get_daily_attendance(date=date, auth_token=token)


@router.get("/attendance/weekly", status_code=status.HTTP_200_OK)
def get_weekly_attendance(
    ref_date: str = Query("2026-08-20"),
    current_user: AuthenticatedUser = Depends(get_current_user),
    authorization: Optional[str] = Header(None)
):
    """Fetches weekly attendance summary via Member 1 Adapter."""
    token = authorization.split(" ")[1] if authorization and "Bearer " in authorization else None
    return member1_adapter.get_weekly_attendance(ref_date=ref_date, auth_token=token)


@router.get("/payroll", status_code=status.HTTP_200_OK)
def get_payroll(
    pay_period: str = Query("2026-08"),
    current_user: AuthenticatedUser = Depends(get_current_user),
    authorization: Optional[str] = Header(None)
):
    """Fetches payroll summary via Member 1 Adapter."""
    token = authorization.split(" ")[1] if authorization and "Bearer " in authorization else None
    return member1_adapter.get_payroll_summary(pay_period=pay_period, auth_token=token)
