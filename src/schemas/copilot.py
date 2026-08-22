from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from src.schemas.rag import Citation


class ToolCall(BaseModel):
    tool_name: str = Field(..., description="Name of the tool to execute")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Parameters for the tool call")
    requires_approval: bool = Field(True, description="Whether explicit user approval is required")


class CopilotChatRequest(BaseModel):
    message: str = Field(..., description="User prompt or chat message")
    conversation_id: Optional[str] = Field(None, description="Optional conversation ID for context history")
    user_id: str = Field("usr_default", description="User ID making the request")
    user_role: str = Field("EMPLOYEE", description="Role of the requesting user")
    department: str = Field("Engineering", description="Department of the user")
    confirm: bool = Field(False, description="Whether user explicitly confirms a candidate action")
    confirm_token: Optional[str] = Field(None, description="Confirmation token for 2-step tool execution")


class CopilotChatResponse(BaseModel):
    conversation_id: str
    intent: str = Field(..., description="Detected intent: ACT_PREVIEW, ACT_CONFIRMED, READ_QUERY, POLICY_QA, CLARIFICATION_REQUIRED, SECURITY_REFUSAL")
    message: str = Field(..., description="AI response text in Markdown format")
    citations: List[Citation] = Field(default_factory=list, description="Policy evidence citations")
    suggested_action: Optional[ToolCall] = Field(None, description="Optional candidate tool call")
    confidence: float = Field(1.0, description="Confidence score of response")
    ai_suggested: bool = Field(True, description="Identifies response as an AI-generated suggestion")
    requires_human_approval: bool = Field(True, description="Identifies that human approval is required for state changes")
