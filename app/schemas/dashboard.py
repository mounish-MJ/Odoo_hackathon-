from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class LeaveBalanceDetail(BaseModel):
    leave_type: str
    allocated: int
    used: int
    pending: int
    remaining: int

    model_config = ConfigDict(from_attributes=True)


class LeaveBalancesResponse(BaseModel):
    employee_id: str
    year: int
    balances: List[LeaveBalanceDetail]

    model_config = ConfigDict(from_attributes=True)


class EmployeeDashboardResponse(BaseModel):
    employee_id: str
    first_name: str
    last_name: str
    email: str
    department: Optional[str] = None
    designation: Optional[str] = None
    attendance_streak_days: int = 0
    pending_leaves_count: int = 0
    latest_net_pay: Optional[Decimal] = None

    model_config = ConfigDict(from_attributes=True)


class AttendanceSummaryResponse(BaseModel):
    employee_id: str
    year_month: str
    total_days_present: int
    total_days_absent: int
    total_hours_worked: float

    model_config = ConfigDict(from_attributes=True)


class PayrollSummaryResponse(BaseModel):
    employee_id: str
    year: int
    gross_ytd: Decimal
    net_ytd: Decimal
    deductions_ytd: Decimal

    model_config = ConfigDict(from_attributes=True)


class DepartmentSummaryItem(BaseModel):
    department: str
    total_employees: int
    active_leaves: int
    total_monthly_payroll: Decimal

    model_config = ConfigDict(from_attributes=True)


class DepartmentSummaryResponse(BaseModel):
    departments: List[DepartmentSummaryItem]

    model_config = ConfigDict(from_attributes=True)
