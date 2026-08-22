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


class LeaveStatusUpdateRequest(BaseModel):
    status: LeaveStatus = Field(..., description="Target leave status (APPROVED, REJECTED, CANCELLED)")
    review_comments: Optional[str] = Field(None, description="Optional review comment or feedback")


class LeaveDeductBalanceRequest(BaseModel):
    user_id: str = Field(..., description="Target user ID or employee ID")
    leave_type: LeaveType = Field(..., description="Type of leave to deduct from")
    days: int = Field(..., gt=0, description="Number of days to deduct")
    reason: Optional[str] = Field(None, description="Reason for balance deduction")


class LeaveDeductBalanceResponse(BaseModel):
    employee_id: str
    leave_type: LeaveType
    deducted_days: int
    remaining_balance: int

