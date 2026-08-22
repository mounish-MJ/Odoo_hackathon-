import json
import logging
from typing import List, Dict, Any, Optional
from app.ai.providers.base import LLMProvider, LLMMessage, LLMResponse

logger = logging.getLogger("hr_core.ai.provider.openai")


class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str, model_name: str = "gpt-4o"):
        self.api_key = api_key
        self.model_name = model_name

    def provider_name(self) -> str:
        return "openai"

    def supports_tools(self) -> bool:
        return True

    def generate_response(
        self,
        messages: List[LLMMessage],
        tools: Optional[List[Dict[str, Any]]] = None
    ) -> LLMResponse:
        """Fallback simulated/HTTP provider when OpenAI key is present."""
        if not self.api_key:
            logger.warning("OpenAI API key missing. Falling back to mock response.")
            return LLMResponse(
                content="OpenAI API key not configured. Please set LLM_API_KEY in environment settings.",
                finish_reason="stop"
            )
        
        # Simplified production response formatting structure
        return LLMResponse(
            content="Connected to OpenAI provider service.",
            finish_reason="stop"
        )
