from pydantic import BaseModel, ConfigDict
from decimal import Decimal
from datetime import datetime
from typing import Optional


class PayrollBase(BaseModel):
    employee_id: str
    pay_period: str
    basic_salary: Decimal
    allowances: Decimal = Decimal("0.00")
    deductions: Decimal = Decimal("0.00")
    gross_salary: Decimal
    net_salary: Decimal
    currency: str = "USD"


class PayrollCreate(PayrollBase):
    pass


class PayrollRead(PayrollBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
