from typing import Optional, List
from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.leave import LeaveStatus
from app.schemas.leave import LeaveApplyRequest, LeaveReviewRequest, LeaveRequestRead
from app.services.leave_service import LeaveService
from app.api.deps import get_current_active_verified_user, require_roles

router = APIRouter()


@router.post("", response_model=LeaveRequestRead, status_code=status.HTTP_201_CREATED)
def apply_leave(
    data: LeaveApplyRequest,
    current_user: User = Depends(get_current_active_verified_user),
    db: Session = Depends(get_db)
):
    """Submits a new leave request for the authenticated employee with PENDING initial status."""
    return LeaveService.apply_leave(db=db, current_user=current_user, data=data)


@router.get("", response_model=List[LeaveRequestRead], status_code=status.HTTP_200_OK)
def get_leave_requests(
    leave_status: Optional[LeaveStatus] = Query(None, alias="status", description="Filter by leave status"),
    employee_id: Optional[str] = Query(None, description="Employee ID (defaults to current user for employees)"),
    current_user: User = Depends(get_current_active_verified_user),
    db: Session = Depends(get_db)
):
    """Lists leave requests. Employees can view own requests; HR and Admin can view any or filter by status/employee."""
    return LeaveService.get_leave_requests(
        db=db,
        current_user=current_user,
        status_filter=leave_status,
        target_employee_id=employee_id
    )


@router.patch("/{leave_id}/approve", response_model=LeaveRequestRead, status_code=status.HTTP_200_OK)
def approve_leave(
    leave_id: str,
    data: Optional[LeaveReviewRequest] = None,
    current_user: User = Depends(require_roles(UserRole.HR, UserRole.ADMIN)),
    db: Session = Depends(get_db)
):
    """Approves a PENDING leave request (HR and Admin roles only)."""
    return LeaveService.approve_leave(db=db, current_user=current_user, leave_id=leave_id, data=data)


@router.patch("/{leave_id}/reject", response_model=LeaveRequestRead, status_code=status.HTTP_200_OK)
def reject_leave(
    leave_id: str,
    data: Optional[LeaveReviewRequest] = None,
    current_user: User = Depends(require_roles(UserRole.HR, UserRole.ADMIN)),
    db: Session = Depends(get_db)
):
    """Rejects a PENDING leave request (HR and Admin roles only)."""
    return LeaveService.reject_leave(db=db, current_user=current_user, leave_id=leave_id, data=data)
