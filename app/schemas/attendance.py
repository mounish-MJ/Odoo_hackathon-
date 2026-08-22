from pydantic import BaseModel, ConfigDict
from datetime import date, datetime
from typing import Optional, List
from app.models.attendance import AttendanceStatus


class AttendanceBase(BaseModel):
    employee_id: str
    attendance_date: date
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    status: AttendanceStatus = AttendanceStatus.PRESENT


class AttendanceCreate(AttendanceBase):
    pass


class AttendanceRead(AttendanceBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CheckInResponse(BaseModel):
    message: str
    attendance: AttendanceRead


class CheckOutResponse(BaseModel):
    message: str
    attendance: AttendanceRead


class DailyAttendanceRead(BaseModel):
    date: date
    employee_id: str
    attendance: Optional[AttendanceRead] = None


class WeeklyAttendanceRead(BaseModel):
    start_date: date
    end_date: date
    employee_id: str
    total_days_present: int
    records: List[AttendanceRead]
