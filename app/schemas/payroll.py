from pydantic import BaseModel, ConfigDict, Field
from decimal import Decimal
from datetime import datetime
from typing import Optional


class PayrollBase(BaseModel):
    employee_id: str = Field(..., description="Target employee ID")
    pay_period: str = Field(..., description="Pay period in YYYY-MM format e.g. 2026-08")
    basic_salary: Decimal = Field(..., description="Basic salary amount")
    allowances: Decimal = Field(default=Decimal("0.00"), description="Allowances amount")
    deductions: Decimal = Field(default=Decimal("0.00"), description="Deductions amount")
    currency: str = Field(default="USD", description="Currency code (3 chars)")


class PayrollCreate(PayrollBase):
    pass


class PayrollUpdate(BaseModel):
    basic_salary: Optional[Decimal] = Field(None, description="Basic salary amount")
    allowances: Optional[Decimal] = Field(None, description="Allowances amount")
    deductions: Optional[Decimal] = Field(None, description="Deductions amount")
    currency: Optional[str] = Field(None, description="Currency code")

    model_config = ConfigDict(extra="ignore")


class PayrollRead(PayrollBase):
    id: str
    gross_salary: Decimal
    net_salary: Decimal
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
