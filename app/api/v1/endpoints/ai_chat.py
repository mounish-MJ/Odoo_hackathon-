from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.ai.agent.hr_agent import HRAgent
from app.api.deps import get_current_active_verified_user

router = APIRouter()


class ChatRequest(BaseModel):
    message: str = Field(..., description="Natural language user input message")
    conversation_id: Optional[str] = Field(None, description="Optional conversation session ID")
    confirmed: bool = Field(default=False, description="Set to true to confirm requested write operations")


class ChatResponse(BaseModel):
    conversation_id: str
    status: str = Field(..., description="Response status: 'completed', 'confirmation_required', 'error'")
    message: str = Field(..., description="Human-readable response or confirmation summary")
    confirmation: Optional[Dict[str, Any]] = Field(None, description="Confirmation details if write action requires confirmation")


@router.post("/chat", response_model=ChatResponse, status_code=status.HTTP_200_OK)
def chat_with_hr_agent(
    body: ChatRequest,
    current_user: User = Depends(get_current_active_verified_user),
    db: Session = Depends(get_db)
):
    """
    Interacts with the Secure HR Conversational Agent.
    Resolves natural language intent, proposes role-filtered AI tool calls, enforces write confirmations,
    and returns human-readable responses.
    """
    return HRAgent.process_chat(
        db=db,
        current_user=current_user,
        user_message=body.message,
        conversation_id=body.conversation_id,
        confirmed=body.confirmed
    )
