from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from app.models.employee import Employee
from app.models.leave import LeaveRequest, LeaveType, LeaveStatus
from app.schemas.leave import LeaveApplyRequest, LeaveReviewRequest
from app.core.exceptions import HRCoreException, ConflictError, EntityNotFoundError
from app.api.deps import enforce_self_or_admin


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class LeaveService:

    @staticmethod
    def apply_leave(db: Session, current_user: User, data: LeaveApplyRequest) -> LeaveRequest:
        """Submits a new leave application with PENDING initial status and date validation."""
        if not current_user.employee_id:
            raise HRCoreException(
                status_code=400,
                code="NO_EMPLOYEE_PROFILE",
                message="User account is not linked to an employee profile."
            )

        if data.start_date > data.end_date:
            raise HRCoreException(
                status_code=400,
                code="INVALID_DATE_RANGE",
                message="Leave start date cannot be after end date."
            )

        leave_req = LeaveRequest(
            employee_id=current_user.employee_id,
            leave_type=data.leave_type,
            start_date=data.start_date,
            end_date=data.end_date,
            reason=data.reason,
            status=LeaveStatus.PENDING
        )
        db.add(leave_req)
        db.commit()
        db.refresh(leave_req)

        return leave_req

    @staticmethod
    def get_leave_requests(
        db: Session,
        current_user: User,
        status_filter: Optional[LeaveStatus] = None,
        target_employee_id: Optional[str] = None
    ) -> List[LeaveRequest]:
        """Lists leave requests. Employees can only view own requests; HR/Admin can view any or filter."""
        query = db.query(LeaveRequest)

        if target_employee_id:
            enforce_self_or_admin(current_user=current_user, target_employee_id=target_employee_id)
            query = query.filter(LeaveRequest.employee_id == target_employee_id)
        elif current_user.role == UserRole.EMPLOYEE:
            if not current_user.employee_id:
                return []
            query = query.filter(LeaveRequest.employee_id == current_user.employee_id)

        if status_filter:
            query = query.filter(LeaveRequest.status == status_filter)

        return query.order_by(LeaveRequest.created_at.desc()).all()

    @staticmethod
    def approve_leave(
        db: Session,
        current_user: User,
        leave_id: str,
        data: Optional[LeaveReviewRequest] = None
    ) -> LeaveRequest:
        """Approves a PENDING leave request (HR/Admin only)."""
        leave_req = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
        if not leave_req:
            raise EntityNotFoundError(entity_name="Leave request", identifier=leave_id)

        if leave_req.status != LeaveStatus.PENDING:
            raise ConflictError(
                message=f"Cannot approve leave request in '{leave_req.status.value}' state. Only PENDING requests can be approved."
            )

        leave_req.status = LeaveStatus.APPROVED
        leave_req.reviewed_by = current_user.employee_id
        leave_req.reviewed_at = utc_now()
        leave_req.review_comment = data.review_comment if data else None

        db.commit()
        db.refresh(leave_req)
        return leave_req

    @staticmethod
    def reject_leave(
        db: Session,
        current_user: User,
        leave_id: str,
        data: Optional[LeaveReviewRequest] = None
    ) -> LeaveRequest:
        """Rejects a PENDING leave request (HR/Admin only)."""
        leave_req = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
        if not leave_req:
            raise EntityNotFoundError(entity_name="Leave request", identifier=leave_id)

        if leave_req.status != LeaveStatus.PENDING:
            raise ConflictError(
                message=f"Cannot reject leave request in '{leave_req.status.value}' state. Only PENDING requests can be rejected."
            )

        leave_req.status = LeaveStatus.REJECTED
        leave_req.reviewed_by = current_user.employee_id
        leave_req.reviewed_at = utc_now()
        leave_req.review_comment = data.review_comment if data else None

        db.commit()
        db.refresh(leave_req)
        return leave_req
