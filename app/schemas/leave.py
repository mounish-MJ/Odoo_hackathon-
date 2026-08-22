from pydantic import BaseModel, ConfigDict, Field
from datetime import date, datetime
from typing import Optional
from app.models.leave import LeaveType, LeaveStatus


class LeaveApplyRequest(BaseModel):
    leave_type: LeaveType = Field(..., description="Type of leave requested")
    start_date: date = Field(..., description="Leave start date")
    end_date: date = Field(..., description="Leave end date")
    reason: Optional[str] = Field(None, description="Reason for leave application")


class LeaveReviewRequest(BaseModel):
    review_comment: Optional[str] = Field(None, description="Reviewer feedback or approval/rejection comment")


class LeaveRequestRead(BaseModel):
    id: str
    employee_id: str
    leave_type: LeaveType
    start_date: date
    end_date: date
    reason: Optional[str] = None
    status: LeaveStatus
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_comment: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
