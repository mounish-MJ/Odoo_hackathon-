from typing import Optional
from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.employee import EmployeeRead, EmployeeSelfUpdate, EmployeeAdminUpdate
from app.schemas.dashboard import EmployeeDashboardResponse
from app.services.employee_service import EmployeeService
from app.services.analytics import AnalyticsService
from app.api.deps import get_current_active_verified_user, require_roles, enforce_self_or_admin

router = APIRouter()


@router.get("/me", response_model=EmployeeRead, status_code=status.HTTP_200_OK)
def get_own_profile(
    current_user: User = Depends(get_current_active_verified_user),
    db: Session = Depends(get_db)
):
    """Returns profile information of the currently authenticated employee."""
    return EmployeeService.get_employee_me(db=db, current_user=current_user)


@router.patch("/me", response_model=EmployeeRead, status_code=status.HTTP_200_OK)
def update_own_profile(
    data: EmployeeSelfUpdate,
    current_user: User = Depends(get_current_active_verified_user),
    db: Session = Depends(get_db)
):
    """Updates permitted self-service fields (e.g. phone number) for the authenticated employee."""
    return EmployeeService.update_employee_me(db=db, current_user=current_user, data=data)


@router.get("/dashboard", response_model=EmployeeDashboardResponse, status_code=status.HTTP_200_OK)
def get_employee_dashboard(
    employee_id: Optional[str] = Query(None, description="Target employee ID (defaults to current user)"),
    current_user: User = Depends(get_current_active_verified_user),
    db: Session = Depends(get_db)
):
    """Aggregates unified employee dashboard metrics (profile, attendance streak, pending leaves, latest net pay)."""
    target_emp_id = employee_id or current_user.employee_id
    enforce_self_or_admin(current_user, target_emp_id)
    return AnalyticsService.get_employee_dashboard(db=db, employee_id=target_emp_id)


@router.get("/{employee_id}", response_model=EmployeeRead, status_code=status.HTTP_200_OK)
def get_employee_by_id(
    employee_id: str,
    current_user: User = Depends(get_current_active_verified_user),
    db: Session = Depends(get_db)
):
    """Retrieves an employee profile by ID. Enforces server-side authorization (Self or HR/Admin)."""
    return EmployeeService.get_employee_by_id(db=db, current_user=current_user, employee_id=employee_id)


@router.patch("/{employee_id}", response_model=EmployeeRead, status_code=status.HTTP_200_OK)
def update_employee_admin(
    employee_id: str,
    data: EmployeeAdminUpdate,
    current_user: User = Depends(require_roles(UserRole.HR, UserRole.ADMIN)),
    db: Session = Depends(get_db)
):
    """Updates administrative employee profile fields (HR and Admin roles only)."""
    return EmployeeService.update_employee_admin(db=db, current_user=current_user, employee_id=employee_id, data=data)
