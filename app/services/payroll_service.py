from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from app.models.employee import Employee
from app.models.payroll import Payroll
from app.schemas.payroll import PayrollCreate, PayrollUpdate
from app.core.exceptions import HRCoreException, ConflictError, EntityNotFoundError
from app.api.deps import enforce_self_or_admin


def quantize_money(amount: Decimal) -> Decimal:
    """Quantizes a Decimal to 2 decimal places with standard HALF_UP rounding."""
    return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calculate_salaries(basic: Decimal, allowances: Decimal, deductions: Decimal) -> Tuple[Decimal, Decimal]:
    """Calculates gross and net salaries with financial validation."""
    if basic < Decimal("0.00") or allowances < Decimal("0.00") or deductions < Decimal("0.00"):
        raise HRCoreException(
            status_code=400,
            code="INVALID_MONETARY_VALUE",
            message="Monetary values (basic_salary, allowances, deductions) cannot be negative."
        )

    gross = basic + allowances
    net = gross - deductions

    if net < Decimal("0.00"):
        raise HRCoreException(
            status_code=400,
            code="INVALID_MONETARY_VALUE",
            message="Calculated net salary cannot be negative (deductions exceed gross salary)."
        )

    return quantize_money(gross), quantize_money(net)


class PayrollService:

    @staticmethod
    def get_payroll_records(
        db: Session,
        current_user: User,
        pay_period: Optional[str] = None,
        target_employee_id: Optional[str] = None
    ) -> List[Payroll]:
        """Lists payroll records. Employees can only view own records; HR/Admin can query any or filter by period."""
        query = db.query(Payroll)

        if target_employee_id:
            enforce_self_or_admin(current_user=current_user, target_employee_id=target_employee_id)
            query = query.filter(Payroll.employee_id == target_employee_id)
        elif current_user.role == UserRole.EMPLOYEE:
            if not current_user.employee_id:
                return []
            query = query.filter(Payroll.employee_id == current_user.employee_id)

        if pay_period:
            query = query.filter(Payroll.pay_period == pay_period)

        return query.order_by(Payroll.pay_period.desc()).all()

    @staticmethod
    def get_payroll_by_id(db: Session, current_user: User, payroll_id: str) -> Payroll:
        """Retrieves a detailed payroll record by ID. Enforces server-side self vs admin authorization."""
        payroll = db.query(Payroll).filter(Payroll.id == payroll_id).first()
        if not payroll:
            raise EntityNotFoundError(entity_name="Payroll record", identifier=payroll_id)

        enforce_self_or_admin(current_user=current_user, target_employee_id=payroll.employee_id)
        return payroll

    @staticmethod
    def create_payroll_record(db: Session, current_user: User, data: PayrollCreate) -> Payroll:
        """Creates a new employee payroll record (HR and Admin roles only)."""
        employee = db.query(Employee).filter(Employee.id == data.employee_id).first()
        if not employee:
            raise EntityNotFoundError(entity_name="Employee", identifier=data.employee_id)

        existing = db.query(Payroll).filter(
            Payroll.employee_id == data.employee_id,
            Payroll.pay_period == data.pay_period
        ).first()
        if existing:
            raise ConflictError(message=f"Payroll record for employee '{data.employee_id}' and pay period '{data.pay_period}' already exists.")

        basic = quantize_money(data.basic_salary)
        allowances = quantize_money(data.allowances)
        deductions = quantize_money(data.deductions)

        gross, net = calculate_salaries(basic, allowances, deductions)

        payroll = Payroll(
            employee_id=data.employee_id,
            pay_period=data.pay_period,
            basic_salary=basic,
            allowances=allowances,
            deductions=deductions,
            gross_salary=gross,
            net_salary=net,
            currency=data.currency
        )
        db.add(payroll)
        db.commit()
        db.refresh(payroll)
        return payroll

    @staticmethod
    def update_payroll_record(db: Session, current_user: User, payroll_id: str, data: PayrollUpdate) -> Payroll:
        """Updates an existing payroll record (HR and Admin roles only)."""
        payroll = db.query(Payroll).filter(Payroll.id == payroll_id).first()
        if not payroll:
            raise EntityNotFoundError(entity_name="Payroll record", identifier=payroll_id)

        basic = quantize_money(data.basic_salary) if data.basic_salary is not None else payroll.basic_salary
        allowances = quantize_money(data.allowances) if data.allowances is not None else payroll.allowances
        deductions = quantize_money(data.deductions) if data.deductions is not None else payroll.deductions

        gross, net = calculate_salaries(basic, allowances, deductions)

        payroll.basic_salary = basic
        payroll.allowances = allowances
        payroll.deductions = deductions
        payroll.gross_salary = gross
        payroll.net_salary = net

        if data.currency:
            payroll.currency = data.currency

        db.commit()
        db.refresh(payroll)
        return payroll
