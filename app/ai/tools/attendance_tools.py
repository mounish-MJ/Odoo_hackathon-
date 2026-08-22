from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from app.schemas.attendance import DailyAttendanceRead, WeeklyAttendanceRead
from app.services.attendance_service import AttendanceService
from app.ai.schemas.tool_schemas import GetAttendanceArgs, GetWeeklyAttendanceArgs
from app.ai.tools.registry import ToolRegistry, ToolDefinition


def handle_get_attendance(db: Session, current_user: User, args: GetAttendanceArgs) -> dict:
    result = AttendanceService.get_daily_attendance(
        db=db,
        current_user=current_user,
        query_date=args.query_date,
        target_employee_id=args.employee_id
    )
    return DailyAttendanceRead.model_validate(result).model_dump(mode="json")


def handle_get_weekly_attendance(db: Session, current_user: User, args: GetWeeklyAttendanceArgs) -> dict:
    result = AttendanceService.get_weekly_attendance(
        db=db,
        current_user=current_user,
        ref_date=args.ref_date,
        target_employee_id=args.employee_id
    )
    return WeeklyAttendanceRead.model_validate(result).model_dump(mode="json")


get_attendance_tool = ToolDefinition(
    name="get_attendance",
    description="Retrieves daily attendance record for specified date and employee.",
    operation_type="READ",
    requires_confirmation=False,
    allowed_roles=[UserRole.EMPLOYEE, UserRole.HR, UserRole.ADMIN],
    arg_schema=GetAttendanceArgs,
    handler=handle_get_attendance
)

get_weekly_attendance_tool = ToolDefinition(
    name="get_weekly_attendance",
    description="Retrieves weekly attendance summary (Monday through Sunday) for specified employee.",
    operation_type="READ",
    requires_confirmation=False,
    allowed_roles=[UserRole.EMPLOYEE, UserRole.HR, UserRole.ADMIN],
    arg_schema=GetWeeklyAttendanceArgs,
    handler=handle_get_weekly_attendance
)

ToolRegistry.register(get_attendance_tool)
ToolRegistry.register(get_weekly_attendance_tool)
