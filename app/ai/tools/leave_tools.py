from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from app.schemas.leave import LeaveApplyRequest, LeaveReviewRequest, LeaveRequestRead
from app.services.leave_service import LeaveService
from app.ai.schemas.tool_schemas import GetLeaveRequestsArgs, ApplyLeaveArgs, ApproveLeaveArgs, RejectLeaveArgs
from app.ai.tools.registry import ToolRegistry, ToolDefinition


def handle_get_leave_requests(db: Session, current_user: User, args: GetLeaveRequestsArgs) -> list:
    requests = LeaveService.get_leave_requests(
        db=db,
        current_user=current_user,
        status_filter=args.status,
        target_employee_id=args.employee_id
    )
    return [LeaveRequestRead.model_validate(r).model_dump(mode="json") for r in requests]


def handle_apply_leave(db: Session, current_user: User, args: ApplyLeaveArgs) -> dict:
    data = LeaveApplyRequest(
        leave_type=args.leave_type,
        start_date=args.start_date,
        end_date=args.end_date,
        reason=args.reason
    )
    leave_req = LeaveService.apply_leave(db=db, current_user=current_user, data=data)
    return LeaveRequestRead.model_validate(leave_req).model_dump(mode="json")


def handle_approve_leave(db: Session, current_user: User, args: ApproveLeaveArgs) -> dict:
    data = LeaveReviewRequest(review_comment=args.review_comment)
    leave_req = LeaveService.approve_leave(db=db, current_user=current_user, leave_id=args.leave_id, data=data)
    return LeaveRequestRead.model_validate(leave_req).model_dump(mode="json")


def handle_reject_leave(db: Session, current_user: User, args: RejectLeaveArgs) -> dict:
    data = LeaveReviewRequest(review_comment=args.review_comment)
    leave_req = LeaveService.reject_leave(db=db, current_user=current_user, leave_id=args.leave_id, data=data)
    return LeaveRequestRead.model_validate(leave_req).model_dump(mode="json")


get_leave_requests_tool = ToolDefinition(
    name="get_leave_requests",
    description="Retrieves leave requests for an employee or filter by status.",
    operation_type="READ",
    requires_confirmation=False,
    allowed_roles=[UserRole.EMPLOYEE, UserRole.HR, UserRole.ADMIN],
    arg_schema=GetLeaveRequestsArgs,
    handler=handle_get_leave_requests
)

apply_leave_tool = ToolDefinition(
    name="apply_leave",
    description="Submits a new leave application with PENDING initial status.",
    operation_type="WRITE",
    requires_confirmation=True,
    allowed_roles=[UserRole.EMPLOYEE, UserRole.HR, UserRole.ADMIN],
    arg_schema=ApplyLeaveArgs,
    handler=handle_apply_leave
)

approve_leave_tool = ToolDefinition(
    name="approve_leave",
    description="Approves a PENDING leave request (HR and Admin roles only).",
    operation_type="WRITE",
    requires_confirmation=True,
    allowed_roles=[UserRole.HR, UserRole.ADMIN],
    arg_schema=ApproveLeaveArgs,
    handler=handle_approve_leave
)

reject_leave_tool = ToolDefinition(
    name="reject_leave",
    description="Rejects a PENDING leave request (HR and Admin roles only).",
    operation_type="WRITE",
    requires_confirmation=True,
    allowed_roles=[UserRole.HR, UserRole.ADMIN],
    arg_schema=RejectLeaveArgs,
    handler=handle_reject_leave
)

ToolRegistry.register(get_leave_requests_tool)
ToolRegistry.register(apply_leave_tool)
ToolRegistry.register(approve_leave_tool)
ToolRegistry.register(reject_leave_tool)
