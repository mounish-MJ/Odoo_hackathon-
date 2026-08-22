from typing import Optional
from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from app.models.employee import Employee
from app.schemas.employee import EmployeeSelfUpdate, EmployeeAdminUpdate
from app.core.exceptions import EntityNotFoundError, HRCoreException
from app.api.deps import enforce_self_or_admin


class EmployeeService:

    @staticmethod
    def get_employee_me(db: Session, current_user: User) -> Employee:
        """Retrieves profile of currently authenticated user."""
        if not current_user.employee_id:
            # Fallback lookup by user_id
            employee = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        else:
            employee = db.query(Employee).filter(Employee.id == current_user.employee_id).first()

        if not employee:
            raise EntityNotFoundError(entity_name="Employee profile for user", identifier=current_user.email)
        return employee

    @staticmethod
    def update_employee_me(db: Session, current_user: User, data: EmployeeSelfUpdate) -> Employee:
        """Updates permitted self-service fields (e.g. phone) for current user."""
        employee = EmployeeService.get_employee_me(db, current_user)
        
        if data.phone is not None:
            employee.phone = data.phone

        db.commit()
        db.refresh(employee)
        return employee

    @staticmethod
    def get_employee_by_id(db: Session, current_user: User, employee_id: str) -> Employee:
        """Retrieves employee profile by ID. Enforces server-side self vs admin authorization."""
        enforce_self_or_admin(current_user=current_user, target_employee_id=employee_id)
        
        employee = db.query(Employee).filter(Employee.id == employee_id).first()
        if not employee:
            raise EntityNotFoundError(entity_name="Employee", identifier=employee_id)
        return employee

    @staticmethod
    def update_employee_admin(db: Session, current_user: User, employee_id: str, data: EmployeeAdminUpdate) -> Employee:
        """Updates administrative employee profile fields (HR / Admin only)."""
        employee = db.query(Employee).filter(Employee.id == employee_id).first()
        if not employee:
            raise EntityNotFoundError(entity_name="Employee", identifier=employee_id)

        update_dict = data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            if hasattr(employee, key) and value is not None:
                setattr(employee, key, value)

        db.commit()
        db.refresh(employee)
        return employee
