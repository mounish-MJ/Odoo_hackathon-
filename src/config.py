import os
from typing import Optional
from pydantic import BaseModel


class Settings(BaseModel):
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    JWT_SECRET: str = os.getenv("JWT_SECRET", "dayflow_super_secret_jwt_key_2026_change_in_production")

    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "gpt-4o-mini")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
    EMBEDDING_DIMENSION: int = int(os.getenv("EMBEDDING_DIMENSION", "1536"))

    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/dayflow_db")

    RAG_TOP_K: int = int(os.getenv("RAG_TOP_K", "3"))
    RAG_SIMILARITY_THRESHOLD: float = float(os.getenv("RAG_SIMILARITY_THRESHOLD", "0.60"))

    # Member 1 Core HR REST API Configuration
    MEMBER1_API_BASE_URL: str = os.getenv("MEMBER1_API_BASE_URL", "http://localhost:8000/api/v1")
    MEMBER1_TEST_EMAIL: str = os.getenv("MEMBER1_TEST_EMAIL", "test.employee@dayflow.com")
    MEMBER1_TEST_PASSWORD: str = os.getenv("MEMBER1_TEST_PASSWORD", "TestPassword123!")


settings = Settings()
