from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional
from app.models.user import UserRole
from app.schemas.user import UserRead


class SignupRequest(BaseModel):
    employee_code: Optional[str] = Field(None, description="HR Employee Code (e.g. EMP001)")
    email: EmailStr
    password: str = Field(..., min_length=8, description="Password (min 8 characters)")
    role: UserRole = Field(default=UserRole.EMPLOYEE, description="Requested user role")


class SignupResponse(BaseModel):
    user: UserRead
    message: str
    verification_token_stub: Optional[str] = Field(None, description="Development stub verification token")

    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead

    model_config = ConfigDict(from_attributes=True)


class VerifyEmailRequest(BaseModel):
    token: str


class VerifyEmailResponse(BaseModel):
    message: str
    is_verified: bool
