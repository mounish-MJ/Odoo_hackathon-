from typing import Optional
from app.core.config import settings
from app.ai.providers.base import LLMProvider
from app.ai.providers.mock_provider import MockLLMProvider
from app.ai.providers.openai_provider import OpenAIProvider


class LLMProviderFactory:
    @staticmethod
    def get_provider(provider_name: Optional[str] = None) -> LLMProvider:
        name = (provider_name or settings.LLM_PROVIDER).lower()

        if name == "mock":
            return MockLLMProvider(model_name=settings.LLM_MODEL)
        elif name == "openai":
            return OpenAIProvider(api_key=settings.LLM_API_KEY, model_name=settings.LLM_MODEL)
        else:
            # Fallback to Mock Provider for unrecognized or unconfigured provider
            return MockLLMProvider(model_name=settings.LLM_MODEL)
