from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from app.schemas.payroll import PayrollCreate, PayrollUpdate, PayrollRead
from app.services.payroll_service import PayrollService
from app.ai.schemas.tool_schemas import GetPayrollArgs, CreatePayrollArgs, UpdatePayrollArgs
from app.ai.tools.registry import ToolRegistry, ToolDefinition


def handle_get_payroll(db: Session, current_user: User, args: GetPayrollArgs) -> list:
    records = PayrollService.get_payroll_records(
        db=db,
        current_user=current_user,
        pay_period=args.pay_period,
        target_employee_id=args.employee_id
    )
    return [PayrollRead.model_validate(p).model_dump(mode="json") for p in records]


def handle_create_payroll(db: Session, current_user: User, args: CreatePayrollArgs) -> dict:
    data = PayrollCreate(
        employee_id=args.employee_id,
        pay_period=args.pay_period,
        basic_salary=args.basic_salary,
        allowances=args.allowances,
        deductions=args.deductions,
        currency=args.currency
    )
    payroll = PayrollService.create_payroll_record(db=db, current_user=current_user, data=data)
    return PayrollRead.model_validate(payroll).model_dump(mode="json")


def handle_update_payroll(db: Session, current_user: User, args: UpdatePayrollArgs) -> dict:
    data = PayrollUpdate(
        basic_salary=args.basic_salary,
        allowances=args.allowances,
        deductions=args.deductions,
        currency=args.currency
    )
    payroll = PayrollService.update_payroll_record(db=db, current_user=current_user, payroll_id=args.payroll_id, data=data)
    return PayrollRead.model_validate(payroll).model_dump(mode="json")


get_payroll_tool = ToolDefinition(
    name="get_payroll",
    description="Retrieves payroll records for an employee or pay period.",
    operation_type="READ",
    requires_confirmation=False,
    allowed_roles=[UserRole.EMPLOYEE, UserRole.HR, UserRole.ADMIN],
    arg_schema=GetPayrollArgs,
    handler=handle_get_payroll
)

create_payroll_tool = ToolDefinition(
    name="create_payroll",
    description="Creates a new employee payroll record (HR and Admin roles only).",
    operation_type="WRITE",
    requires_confirmation=True,
    allowed_roles=[UserRole.HR, UserRole.ADMIN],
    arg_schema=CreatePayrollArgs,
    handler=handle_create_payroll
)

update_payroll_tool = ToolDefinition(
    name="update_payroll",
    description="Updates an existing payroll record (HR and Admin roles only).",
    operation_type="WRITE",
    requires_confirmation=True,
    allowed_roles=[UserRole.HR, UserRole.ADMIN],
    arg_schema=UpdatePayrollArgs,
    handler=handle_update_payroll
)

ToolRegistry.register(get_payroll_tool)
ToolRegistry.register(create_payroll_tool)
ToolRegistry.register(update_payroll_tool)
