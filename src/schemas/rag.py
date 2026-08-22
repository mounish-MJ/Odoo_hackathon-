from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import date


class PolicyIngestRequest(BaseModel):
    title: str = Field(..., description="Title of the HR Policy document")
    category: str = Field("LEAVE", description="Category: LEAVE, ATTENDANCE, PAYROLL, GENERAL")
    content: str = Field(..., description="Markdown or text content of the policy")
    version: str = Field("1.0", description="Policy version string")
    effective_date: str = Field(default_factory=lambda: date.today().isoformat(), description="Effective date (YYYY-MM-DD)")
    access_roles: List[str] = Field(default_factory=lambda: ["EMPLOYEE", "MANAGER", "HR_ADMIN"], description="Roles allowed to access this policy")


class PolicyIngestResponse(BaseModel):
    policy_id: str
    title: str
    category: str
    version: str
    chunks_created: int
    status: str = "SUCCESS"


class PolicyQueryRequest(BaseModel):
    query: str = Field(..., description="Search query or policy question")
    category: Optional[str] = Field(None, description="Optional category filter")
    user_role: str = Field("EMPLOYEE", description="Role of the requesting user")
    top_k: int = Field(3, description="Number of context chunks to retrieve")


class Citation(BaseModel):
    policy_name: str
    section: str
    content_snippet: str
    similarity_score: float


class PolicyQueryResponse(BaseModel):
    query: str
    answer: str
    citations: List[Citation]
    retrieved_chunks_count: int
