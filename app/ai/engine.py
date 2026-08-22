from typing import Dict, Any, Optional
from pydantic import ValidationError
from sqlalchemy.orm import Session
from app.models.user import User
from app.core.exceptions import HRCoreException, EntityNotFoundError, ConflictError
from app.ai.schemas.tool_schemas import ToolExecutionContext, ToolResult
from app.ai.security.tool_authorization import authorize_tool_call
from app.ai.audit.tool_audit import ToolAuditService
from app.ai.tools.registry import ToolRegistry
import app.ai  # Ensures all tools are registered in ToolRegistry


class ToolExecutionEngine:

    @staticmethod
    def execute(
        db: Session,
        current_user: User,
        tool_name: str,
        arguments: Dict[str, Any],
        confirmed: bool = False,
        request_id: Optional[str] = None
    ) -> ToolResult:
        """
        Centralized AI Tool Execution Engine:
        1. Builds trusted ToolExecutionContext from JWT current_user
        2. Validates tool existence and input schemas
        3. Enforces account status, role matrix, and employee isolation
        4. Enforces write confirmation contract before mutating state
        5. Invokes existing domain service layer (NO DIRECT DB ACCESS)
        6. Normalizes results and records audit log
        """
        ctx = ToolExecutionContext(
            user_id=current_user.id,
            employee_id=current_user.employee_id,
            role=current_user.role,
            is_verified=current_user.is_verified,
            is_active=current_user.is_active,
            request_id=request_id
        )

        tool_def = ToolRegistry.get(tool_name)
        if not tool_def:
            error_dict = {"code": "TOOL_NOT_FOUND", "message": f"AI tool '{tool_name}' is not registered."}
            ToolAuditService.log_tool_execution(
                ctx=ctx, tool_name=tool_name, success=False, operation_type="UNKNOWN", error_code="TOOL_NOT_FOUND"
            )
            return ToolResult(success=False, status="error", error=error_dict)

        # Validate input schema
        try:
            parsed_args = tool_def.arg_schema.model_validate(arguments)
        except ValidationError as val_err:
            error_dict = {"code": "VALIDATION_ERROR", "message": "Invalid tool arguments.", "details": val_err.errors()}
            ToolAuditService.log_tool_execution(
                ctx=ctx, tool_name=tool_name, success=False, operation_type=tool_def.operation_type, error_code="VALIDATION_ERROR"
            )
            return ToolResult(success=False, status="error", error=error_dict)

        target_emp_id = getattr(parsed_args, "employee_id", None)

        # Enforce server-side authorization
        try:
            authorize_tool_call(tool_name=tool_name, ctx=ctx, target_employee_id=target_emp_id)
        except HRCoreException as exc:
            ToolAuditService.log_tool_execution(
                ctx=ctx, tool_name=tool_name, success=False, operation_type=tool_def.operation_type, error_code=exc.code
            )
            return ToolResult(success=False, status="error", error={"code": exc.code, "message": exc.message})

        # Enforce write action confirmation contract
        if tool_def.requires_confirmation and not confirmed:
            ToolAuditService.log_tool_execution(
                ctx=ctx,
                tool_name=tool_name,
                success=True,
                operation_type=tool_def.operation_type,
                requires_confirmation=True,
                extra={"status": "confirmation_requested"}
            )
            return ToolResult(
                success=True,
                status="confirmation_required",
                requires_confirmation=True,
                confirmation_summary=f"Executing write tool '{tool_name}' requires explicit confirmation.",
                data={"tool_name": tool_name, "arguments": arguments}
            )

        # Execute business logic handler (delegates strictly to existing domain service layer)
        try:
            result_data = tool_def.handler(db=db, current_user=current_user, args=parsed_args)
            ToolAuditService.log_tool_execution(
                ctx=ctx,
                tool_name=tool_name,
                success=True,
                operation_type=tool_def.operation_type,
                requires_confirmation=tool_def.requires_confirmation,
                extra={"status": "executed"}
            )
            return ToolResult(
                success=True,
                status="success",
                data=result_data,
                requires_confirmation=tool_def.requires_confirmation
            )
        except HRCoreException as exc:
            ToolAuditService.log_tool_execution(
                ctx=ctx, tool_name=tool_name, success=False, operation_type=tool_def.operation_type, error_code=exc.code
            )
            return ToolResult(success=False, status="error", error={"code": exc.code, "message": exc.message})
        except Exception as exc:
            ToolAuditService.log_tool_execution(
                ctx=ctx, tool_name=tool_name, success=False, operation_type=tool_def.operation_type, error_code="INTERNAL_ERROR"
            )
            return ToolResult(success=False, status="error", error={"code": "INTERNAL_ERROR", "message": "An unexpected error occurred."})
