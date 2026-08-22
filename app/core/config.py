from typing import List, Union, Any
import json
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "HR Core Platform"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"

    # Database
    DATABASE_URL: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/hr_core_db",
        description="PostgreSQL Database Connection String"
    )

    # Security
    JWT_SECRET_KEY: str = "development_jwt_secret_key_change_in_production_32bytes_min"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # LLM & AI Agent Configuration
    LLM_PROVIDER: str = Field(default="mock", description="LLM provider name: 'mock', 'openai', 'anthropic', 'groq', 'ollama'")
    LLM_MODEL: str = Field(default="mock-hr-agent", description="LLM model identifier")
    LLM_API_KEY: str = Field(default="", description="LLM API key (never commit real credentials)")
    MAX_TOOL_ITERATIONS: int = Field(default=5, description="Maximum tool execution iterations per request")
    MAX_HISTORY_MESSAGES: int = Field(default=20, description="Maximum conversation history messages retained")

    # CORS Origins
    CORS_ORIGINS: Union[List[str], str] = ["http://localhost:3000", "http://localhost:8000", "http://127.0.0.1:3000", "http://127.0.0.1:8000"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, str) and v.startswith("["):
            return json.loads(v)
        elif isinstance(v, list):
            return v
        raise ValueError(v)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )


settings = Settings()
