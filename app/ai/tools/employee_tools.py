from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from app.schemas.employee import EmployeeRead
from app.services.employee_service import EmployeeService
from app.ai.schemas.tool_schemas import GetEmployeeProfileArgs
from app.ai.tools.registry import ToolRegistry, ToolDefinition


def handle_get_employee_profile(db: Session, current_user: User, args: GetEmployeeProfileArgs) -> dict:
    if args.employee_id:
        emp = EmployeeService.get_employee_by_id(db=db, current_user=current_user, employee_id=args.employee_id)
    else:
        emp = EmployeeService.get_employee_me(db=db, current_user=current_user)
    return EmployeeRead.model_validate(emp).model_dump(mode="json")


get_employee_profile_tool = ToolDefinition(
    name="get_employee_profile",
    description="Retrieves profile information for the authenticated employee or specified employee ID.",
    operation_type="READ",
    requires_confirmation=False,
    allowed_roles=[UserRole.EMPLOYEE, UserRole.HR, UserRole.ADMIN],
    arg_schema=GetEmployeeProfileArgs,
    handler=handle_get_employee_profile
)

ToolRegistry.register(get_employee_profile_tool)
