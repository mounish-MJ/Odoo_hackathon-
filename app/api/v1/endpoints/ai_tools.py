from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.ai.tools.registry import ToolRegistry
from app.ai.schemas.tool_schemas import ToolResult
from app.ai.engine import ToolExecutionEngine
from app.api.deps import get_current_active_verified_user

router = APIRouter()


class ToolExecuteRequest(BaseModel):
    arguments: Dict[str, Any] = Field(default_factory=dict, description="Tool input arguments")
    confirmed: bool = Field(default=False, description="Set to true to explicitly confirm write operations")


@router.get("/tools", status_code=status.HTTP_200_OK)
def list_available_ai_tools(
    current_user: User = Depends(get_current_active_verified_user)
):
    """Returns role-filtered available AI tools for the currently authenticated user."""
    return {"tools": ToolRegistry.get_tools_for_role(role=current_user.role)}


@router.post("/tools/{tool_name}/execute", response_model=ToolResult, status_code=status.HTTP_200_OK)
def execute_ai_tool(
    tool_name: str,
    body: ToolExecuteRequest,
    current_user: User = Depends(get_current_active_verified_user),
    db: Session = Depends(get_db)
):
    """
    Executes an AI tool securely. Enforces active JWT context, RBAC permissions, employee isolation,
    write confirmation requirements, and service layer validation.
    """
    return ToolExecutionEngine.execute(
        db=db,
        current_user=current_user,
        tool_name=tool_name,
        arguments=body.arguments,
        confirmed=body.confirmed
    )
