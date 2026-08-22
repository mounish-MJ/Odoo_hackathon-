from typing import Optional, List
from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.payroll import PayrollCreate, PayrollUpdate, PayrollRead
from app.services.payroll_service import PayrollService
from app.api.deps import get_current_active_verified_user, require_roles

router = APIRouter()


@router.get("", response_model=List[PayrollRead], status_code=status.HTTP_200_OK)
def get_payroll_records(
    pay_period: Optional[str] = Query(None, description="Filter by pay period (e.g. 2026-08)"),
    employee_id: Optional[str] = Query(None, description="Employee ID (defaults to self for employees)"),
    current_user: User = Depends(get_current_active_verified_user),
    db: Session = Depends(get_db)
):
    """Lists payroll records. Employees can view own records; HR/Admin can query any employee or filter by period."""
    return PayrollService.get_payroll_records(
        db=db,
        current_user=current_user,
        pay_period=pay_period,
        target_employee_id=employee_id
    )


@router.get("/{payroll_id}", response_model=PayrollRead, status_code=status.HTTP_200_OK)
def get_payroll_by_id(
    payroll_id: str,
    current_user: User = Depends(get_current_active_verified_user),
    db: Session = Depends(get_db)
):
    """Retrieves a detailed payroll record by ID. Enforces server-side employee isolation."""
    return PayrollService.get_payroll_by_id(db=db, current_user=current_user, payroll_id=payroll_id)


@router.post("", response_model=PayrollRead, status_code=status.HTTP_201_CREATED)
def create_payroll_record(
    data: PayrollCreate,
    current_user: User = Depends(require_roles(UserRole.HR, UserRole.ADMIN)),
    db: Session = Depends(get_db)
):
    """Creates a new employee payroll record with calculated gross/net salaries (HR and Admin roles only)."""
    return PayrollService.create_payroll_record(db=db, current_user=current_user, data=data)


@router.patch("/{payroll_id}", response_model=PayrollRead, status_code=status.HTTP_200_OK)
def update_payroll_record(
    payroll_id: str,
    data: PayrollUpdate,
    current_user: User = Depends(require_roles(UserRole.HR, UserRole.ADMIN)),
    db: Session = Depends(get_db)
):
    """Updates an existing payroll record and recalculates gross/net salaries (HR and Admin roles only)."""
    return PayrollService.update_payroll_record(db=db, current_user=current_user, payroll_id=payroll_id, data=data)
