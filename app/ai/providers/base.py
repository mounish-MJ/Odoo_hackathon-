from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class LLMMessage(BaseModel):
    role: str = Field(..., description="Message role: 'system', 'user', 'assistant', 'tool'")
    content: Optional[str] = Field(None, description="Text content of the message")
    tool_calls: Optional[List[Dict[str, Any]]] = Field(None, description="Tool calls proposed by assistant")
    tool_call_id: Optional[str] = Field(None, description="Tool call ID for tool role messages")


class LLMResponse(BaseModel):
    content: Optional[str] = Field(None, description="Text response content")
    tool_calls: Optional[List[Dict[str, Any]]] = Field(None, description="Proposed tool calls")
    finish_reason: str = Field(default="stop", description="Finish reason: 'stop', 'tool_calls'")


class LLMProvider(ABC):
    @abstractmethod
    def generate_response(
        self,
        messages: List[LLMMessage],
        tools: Optional[List[Dict[str, Any]]] = None
    ) -> LLMResponse:
        """Generates a text response or tool proposals from the LLM provider."""
        pass

    @abstractmethod
    def supports_tools(self) -> bool:
        """Returns True if the provider supports tool calling capabilities."""
        pass

    @abstractmethod
    def provider_name(self) -> str:
        """Returns the provider name identifier."""
        pass
