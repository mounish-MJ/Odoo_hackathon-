from pydantic import BaseModel, EmailStr, ConfigDict
from datetime import datetime
from typing import Optional
from app.models.user import UserRole


class UserBase(BaseModel):
    email: EmailStr
    role: UserRole = UserRole.EMPLOYEE
    is_active: bool = True
    is_verified: bool = False


class UserCreate(UserBase):
    password: str
    employee_id: Optional[str] = None


class UserRead(UserBase):
    id: str
    employee_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    last_login_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
