from typing import Optional
from app.models.user import UserRole
from app.ai.schemas.tool_schemas import ToolExecutionContext
from app.core.exceptions import HRCoreException


ADMIN_ONLY_TOOLS = {"approve_leave", "reject_leave", "create_payroll", "update_payroll"}


def authorize_tool_call(tool_name: str, ctx: ToolExecutionContext, target_employee_id: Optional[str] = None):
    """Validates user account status, role matrix permissions, and employee isolation rules for tool calls."""
    if not ctx.is_active:
        raise HRCoreException(status_code=401, code="INACTIVE_ACCOUNT", message="User account is inactive.")

    if not ctx.is_verified:
        raise HRCoreException(status_code=401, code="UNVERIFIED_ACCOUNT", message="Email verification required.")

    # Check administrative tool permission
    if tool_name in ADMIN_ONLY_TOOLS and ctx.role not in [UserRole.HR, UserRole.ADMIN]:
        raise HRCoreException(status_code=403, code="FORBIDDEN", message=f"Access to tool '{tool_name}' is denied for role '{ctx.role.value}'.")

    # Check employee ownership isolation
    if ctx.role == UserRole.EMPLOYEE and target_employee_id:
        if ctx.employee_id and target_employee_id != ctx.employee_id:
            raise HRCoreException(
                status_code=403,
                code="FORBIDDEN",
                message="Employee isolation violation: Cannot access another employee's data via AI tool."
            )
