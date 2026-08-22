import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from app.ai.schemas.tool_schemas import ToolExecutionContext

logger = logging.getLogger("hr_core.ai.audit")


class ToolAuditService:
    @staticmethod
    def log_tool_execution(
        ctx: ToolExecutionContext,
        tool_name: str,
        success: bool,
        operation_type: str,
        error_code: Optional[str] = None,
        requires_confirmation: bool = False,
        extra: Optional[Dict[str, Any]] = None
    ):
        """Logs AI tool invocation details cleanly to audit logger without exposing secrets or JWTs."""
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "request_id": ctx.request_id,
            "user_id": ctx.user_id,
            "employee_id": ctx.employee_id,
            "role": ctx.role.value if hasattr(ctx.role, "value") else str(ctx.role),
            "tool_name": tool_name,
            "operation_type": operation_type,
            "success": success,
            "error_code": error_code,
            "requires_confirmation": requires_confirmation,
            "extra": extra or {}
        }
        logger.info(f"AI_TOOL_AUDIT: {log_entry}")
