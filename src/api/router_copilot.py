from fastapi import APIRouter, HTTPException, Depends, Header, status
from typing import Optional
from src.schemas.copilot import CopilotChatRequest, CopilotChatResponse
from src.services.tool_router import tool_router
from src.security.auth import get_current_user, AuthenticatedUser

router = APIRouter(prefix="/api/v1/ai/copilot", tags=["AI Copilot"])


@router.post("/chat", response_model=CopilotChatResponse, status_code=status.HTTP_200_OK)
def copilot_chat(
    request: CopilotChatRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    authorization: Optional[str] = Header(None)
):
    """
    Main HR AI Copilot Chat Endpoint.
    Authenticates requesting user identity, routes intent, performs 2-step confirmation,
    and returns standardized AI output schema.
    """
    try:
        # Use authenticated identity from JWT / service headers
        user_id = current_user.user_id
        user_role = current_user.role
        department = current_user.department

        response = tool_router.route_chat_query(
            message=request.message,
            user_id=user_id,
            user_role=user_role,
            department=department,
            conversation_id=request.conversation_id,
            confirm=request.confirm,
            confirm_token=request.confirm_token,
            auth_token=authorization
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Copilot processing error: {str(e)}")
