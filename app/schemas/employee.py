from pydantic import BaseModel, EmailStr, ConfigDict
from datetime import date, datetime
from typing import Optional
from app.models.employee import EmploymentStatus


class EmployeeBase(BaseModel):
    employee_code: str
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    department: str
    designation: str
    date_of_joining: date
    employment_status: EmploymentStatus = EmploymentStatus.FULL_TIME
    manager_id: Optional[str] = None


class EmployeeCreate(EmployeeBase):
    user_id: Optional[str] = None


class EmployeeRead(EmployeeBase):
    id: str
    user_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
