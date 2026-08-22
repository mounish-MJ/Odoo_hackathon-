from fastapi import APIRouter, HTTPException, Depends, status
from src.schemas.decision import LeaveEligibilityRequest, LeaveEligibilityResponse
from src.services.decision_engine import decision_engine
from src.security.auth import get_current_user, AuthenticatedUser

router = APIRouter(prefix="/api/v1/ai/decision", tags=["AI Decision Engine"])


@router.post("/leave-eligibility", response_model=LeaveEligibilityResponse, status_code=status.HTTP_200_OK)
def evaluate_leave_eligibility(
    request: LeaveEligibilityRequest,
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Evaluates leave request eligibility using Stage 1 deterministic HR business rules
    and Stage 2 LLM evidence synthesis with policy citations.
    Enforces user authorization (users can evaluate their own leave; managers can evaluate for team).
    """
    if current_user.role == "EMPLOYEE" and request.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: You cannot evaluate leave eligibility for another employee."
        )

    try:
        response = decision_engine.evaluate_leave_eligibility(request)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Decision Engine error: {str(e)}")
