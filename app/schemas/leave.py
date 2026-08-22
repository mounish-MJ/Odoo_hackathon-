from pydantic import BaseModel, ConfigDict
from datetime import date, datetime
from typing import Optional
from app.models.leave import LeaveType, LeaveStatus


class LeaveRequestBase(BaseModel):
    employee_id: str
    leave_type: LeaveType
    start_date: date
    end_date: date
    reason: Optional[str] = None


class LeaveRequestCreate(LeaveRequestBase):
    pass


class LeaveRequestRead(LeaveRequestBase):
    id: str
    status: LeaveStatus
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_comment: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
