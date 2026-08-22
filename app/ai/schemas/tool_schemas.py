from pydantic import BaseModel, ConfigDict, Field
from datetime import date as date_type
from decimal import Decimal
from typing import Optional, Any, List
from app.models.user import UserRole
from app.models.leave import LeaveType, LeaveStatus


class ToolExecutionContext(BaseModel):
    user_id: str
    employee_id: Optional[str] = None
    role: UserRole
    is_verified: bool = True
    is_active: bool = True
    request_id: Optional[str] = None


class ToolResult(BaseModel):
    success: bool
    status: str = Field(..., description="Status: 'success', 'confirmation_required', 'error'")
    data: Optional[Any] = None
    error: Optional[dict] = None
    requires_confirmation: bool = False
    confirmation_summary: Optional[str] = None


# Tool Input Argument Schemas

class GetEmployeeProfileArgs(BaseModel):
    employee_id: Optional[str] = Field(None, description="Employee ID to lookup (defaults to own profile for employees)")


class GetAttendanceArgs(BaseModel):
    query_date: Optional[date_type] = Field(None, alias="date", description="Target date (defaults to today)")
    employee_id: Optional[str] = Field(None, description="Employee ID (defaults to self for employees)")


class GetWeeklyAttendanceArgs(BaseModel):
    ref_date: Optional[date_type] = Field(None, description="Reference date in target week")
    employee_id: Optional[str] = Field(None, description="Employee ID (defaults to self for employees)")


class GetLeaveRequestsArgs(BaseModel):
    status: Optional[LeaveStatus] = Field(None, description="Optional leave status filter")
    employee_id: Optional[str] = Field(None, description="Employee ID (defaults to self for employees)")


class ApplyLeaveArgs(BaseModel):
    leave_type: LeaveType = Field(..., description="Leave type (ANNUAL, SICK, CASUAL, MATERNITY, PATERNITY, UNPAID)")
    start_date: date_type = Field(..., description="Start date of leave")
    end_date: date_type = Field(..., description="End date of leave")
    reason: Optional[str] = Field(None, description="Reason for leave request")


class ApproveLeaveArgs(BaseModel):
    leave_id: str = Field(..., description="Target leave request ID to approve")
    review_comment: Optional[str] = Field(None, description="Approval review comment")


class RejectLeaveArgs(BaseModel):
    leave_id: str = Field(..., description="Target leave request ID to reject")
    review_comment: Optional[str] = Field(None, description="Rejection review comment")


class GetPayrollArgs(BaseModel):
    pay_period: Optional[str] = Field(None, description="Pay period filter (e.g. 2026-08)")
    employee_id: Optional[str] = Field(None, description="Employee ID (defaults to self for employees)")


class CreatePayrollArgs(BaseModel):
    employee_id: str = Field(..., description="Target employee ID")
    pay_period: str = Field(..., description="Pay period (YYYY-MM)")
    basic_salary: Decimal = Field(..., description="Basic salary amount")
    allowances: Decimal = Field(default=Decimal("0.00"), description="Allowances amount")
    deductions: Decimal = Field(default=Decimal("0.00"), description="Deductions amount")
    currency: str = Field(default="USD", description="Currency code")


class UpdatePayrollArgs(BaseModel):
    payroll_id: str = Field(..., description="Target payroll record ID")
    basic_salary: Optional[Decimal] = Field(None, description="Basic salary amount")
    allowances: Optional[Decimal] = Field(None, description="Allowances amount")
    deductions: Optional[Decimal] = Field(None, description="Deductions amount")
    currency: Optional[str] = Field(None, description="Currency code")
