from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.dashboard import DepartmentSummaryResponse
from app.services.analytics import AnalyticsService
from app.api.deps import require_roles

router = APIRouter()


@router.get("/departments/summary", response_model=DepartmentSummaryResponse, status_code=status.HTTP_200_OK)
def get_department_summaries(
    current_user: User = Depends(require_roles(UserRole.HR, UserRole.ADMIN)),
    db: Session = Depends(get_db)
):
    """Calculates department headcounts, active leave counts, and total monthly payrolls (HR and Admin roles only)."""
    return AnalyticsService.get_department_summaries(db=db)
