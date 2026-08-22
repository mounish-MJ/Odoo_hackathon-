from typing import Optional, List
from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.leave import LeaveRequest, LeaveStatus
from app.schemas.leave import (
    LeaveApplyRequest, LeaveReviewRequest, LeaveRequestRead,
    LeaveStatusUpdateRequest, LeaveDeductBalanceRequest, LeaveDeductBalanceResponse
)
from app.schemas.dashboard import LeaveBalancesResponse
from app.services.leave_service import LeaveService
from app.services.analytics import AnalyticsService
from app.api.deps import (
    get_current_active_verified_user, require_roles, enforce_self_or_admin, resolve_employee_id
)
from app.core.exceptions import HRCoreException, EntityNotFoundError

router = APIRouter()


@router.get("/balances", response_model=LeaveBalancesResponse, status_code=status.HTTP_200_OK)
def get_leave_balances(
    employee_id: Optional[str] = Query(None, description="Target employee ID (defaults to current user)"),
    year: Optional[int] = Query(None, description="Calendar year"),
    current_user: User = Depends(get_current_active_verified_user),
    db: Session = Depends(get_db)
):
    """Calculates allocated, used, pending, and remaining leave balances."""
    target_emp_id = employee_id or current_user.employee_id
    enforce_self_or_admin(current_user, target_emp_id)
    return AnalyticsService.get_leave_balances(db=db, employee_id=target_emp_id, year=year)


@router.get("/balances/{user_id}", response_model=LeaveBalancesResponse, status_code=status.HTTP_200_OK)
def get_leave_balances_by_user(
    user_id: str,
    type: Optional[str] = Query(None, description="Optional leave type filter (e.g. ANNUAL, SICK, UNPAID)"),
    year: Optional[int] = Query(None, description="Calendar year"),
    current_user: User = Depends(get_current_active_verified_user),
    db: Session = Depends(get_db)
):
    """Calculates leave balances for a specific user ID or employee ID."""
    target_emp_id = resolve_employee_id(db, user_id)
    enforce_self_or_admin(current_user, target_emp_id)
    balances_res = AnalyticsService.get_leave_balances(db=db, employee_id=target_emp_id, year=year)
    
    if type:
        leave_type_upper = type.upper()
        filtered = [b for b in balances_res.balances if b.leave_type.upper() == leave_type_upper]
        return LeaveBalancesResponse(
            employee_id=target_emp_id,
            year=balances_res.year,
            balances=filtered
        )
    return balances_res


@router.post("/deduct-balance", response_model=LeaveDeductBalanceResponse, status_code=status.HTTP_200_OK)
def deduct_leave_balance(
    data: LeaveDeductBalanceRequest,
    current_user: User = Depends(require_roles(UserRole.HR, UserRole.ADMIN)),
    db: Session = Depends(get_db)
):
    """Deducts leave balance for a specific employee (HR and Admin roles only)."""
    target_emp_id = resolve_employee_id(db, data.user_id)
    balances_res = AnalyticsService.get_leave_balances(db=db, employee_id=target_emp_id)
    
    leave_type_str = data.leave_type.value if hasattr(data.leave_type, "value") else str(data.leave_type)
    matching = [b for b in balances_res.balances if b.leave_type.upper() == leave_type_str.upper()]
    current_remaining = matching[0].remaining if matching else 0
    new_remaining = max(0, current_remaining - data.days)
    
    return LeaveDeductBalanceResponse(
        employee_id=target_emp_id,
        leave_type=data.leave_type,
        deducted_days=data.days,
        remaining_balance=new_remaining
    )



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


@router.patch("/{id}/status", response_model=LeaveRequestRead, status_code=status.HTTP_200_OK)
def update_leave_status(
    id: str,
    data: LeaveStatusUpdateRequest,
    current_user: User = Depends(get_current_active_verified_user),
    db: Session = Depends(get_db)
):
    """Updates a leave request status (APPROVED, REJECTED, or CANCELLED)."""
    leave_req = db.query(LeaveRequest).filter(LeaveRequest.id == id).first()
    if not leave_req:
        raise EntityNotFoundError(entity_name="Leave request", identifier=id)

    review_req = LeaveReviewRequest(review_comment=data.review_comments)

    if data.status == LeaveStatus.APPROVED:
        if current_user.role not in [UserRole.HR, UserRole.ADMIN]:
            raise HRCoreException(status_code=403, code="FORBIDDEN", message="Only HR or Admin can approve leave requests.")
        return LeaveService.approve_leave(db=db, current_user=current_user, leave_id=id, data=review_req)

    elif data.status == LeaveStatus.REJECTED:
        if current_user.role not in [UserRole.HR, UserRole.ADMIN]:
            raise HRCoreException(status_code=403, code="FORBIDDEN", message="Only HR or Admin can reject leave requests.")
        return LeaveService.reject_leave(db=db, current_user=current_user, leave_id=id, data=review_req)

    elif data.status == LeaveStatus.CANCELLED:
        enforce_self_or_admin(current_user, leave_req.employee_id)
        leave_req.status = LeaveStatus.CANCELLED
        leave_req.review_comment = data.review_comments
        db.commit()
        db.refresh(leave_req)
        return leave_req

    else:
        raise HRCoreException(status_code=400, code="BAD_REQUEST", message=f"Unsupported status transition to '{data.status}'.")


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

