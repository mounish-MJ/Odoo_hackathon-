from pydantic import BaseModel, EmailStr, ConfigDict, Field
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


class EmployeeSelfUpdate(BaseModel):
    phone: Optional[str] = Field(None, description="Contact phone number")

    model_config = ConfigDict(extra="forbid")  # Rejects attempts to update restricted fields


class EmployeeAdminUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    employment_status: Optional[EmploymentStatus] = None
    manager_id: Optional[str] = None

    model_config = ConfigDict(extra="ignore")


class EmployeeRead(EmployeeBase):
    id: str
    user_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
