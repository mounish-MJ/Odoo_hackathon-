from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from src.schemas.rag import Citation


class LeaveEligibilityRequest(BaseModel):
    user_id: str = Field(..., description="Target employee user ID")
    leave_type: str = Field(..., description="Leave type: PAID, SICK, CASUAL, UNPAID")
    start_date: str = Field(..., description="Start date (YYYY-MM-DD)")
    end_date: str = Field(..., description="End date (YYYY-MM-DD)")
    reason: str = Field(..., description="Reason for leave request")


class RuleCheckResult(BaseModel):
    rule_code: str
    rule_name: str
    passed: bool
    details: str


class LeaveEligibilityResponse(BaseModel):
    user_id: str
    leave_type: str
    days_requested: int
    eligible: bool
    recommendation: str = Field(..., description="Recommendation: APPROVE, REJECT, MANUAL_REVIEW")
    rule_checks: List[RuleCheckResult]
    citations: List[Citation]
    explanation: str = Field(..., description="Natural language evidence explanation for HR/Manager")
    confidence_score: float = Field(0.95, description="Confidence score of recommendation")
    ai_suggested: bool = Field(True, description="Identifies recommendation as an AI suggestion")
    requires_human_approval: bool = Field(True, description="Human approval is mandatory")
