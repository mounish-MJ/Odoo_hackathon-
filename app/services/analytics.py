from decimal import Decimal
from datetime import date, datetime
from typing import List, Dict, Any
from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.models.leave import LeaveRequest, LeaveStatus, LeaveType
from app.models.attendance import Attendance, AttendanceStatus
from app.models.payroll import Payroll
from app.core.exceptions import EntityNotFoundError
from app.schemas.dashboard import (
    LeaveBalancesResponse,
    LeaveBalanceDetail,
    EmployeeDashboardResponse,
    AttendanceSummaryResponse,
    PayrollSummaryResponse,
    DepartmentSummaryResponse,
    DepartmentSummaryItem
)

# Annual Leave Policy Allocations
ALLOCATIONS = {
    LeaveType.ANNUAL: 20,
    LeaveType.SICK: 10,
    LeaveType.UNPAID: 30
}


class AnalyticsService:
    @staticmethod
    def _get_employee(db: Session, employee_id: str) -> Employee:
        emp = db.query(Employee).filter(Employee.id == employee_id).first()
        if not emp:
            raise EntityNotFoundError(entity_name="Employee", identifier=employee_id)
        return emp

    @staticmethod
    def get_leave_balances(db: Session, employee_id: str, year: int = None) -> LeaveBalancesResponse:
        AnalyticsService._get_employee(db, employee_id)
        current_year = year or date.today().year

        leaves = db.query(LeaveRequest).filter(
            LeaveRequest.employee_id == employee_id
        ).all()

        balances_map = {
            LeaveType.ANNUAL: {"used": 0, "pending": 0},
            LeaveType.SICK: {"used": 0, "pending": 0},
            LeaveType.UNPAID: {"used": 0, "pending": 0}
        }

        for leave in leaves:
            if leave.start_date.year == current_year:
                days = (leave.end_date - leave.start_date).days + 1
                if leave.status == LeaveStatus.APPROVED:
                    if leave.leave_type in balances_map:
                        balances_map[leave.leave_type]["used"] += days
                elif leave.status == LeaveStatus.PENDING:
                    if leave.leave_type in balances_map:
                        balances_map[leave.leave_type]["pending"] += days

        details = []
        for l_type, alloc in ALLOCATIONS.items():
            used = balances_map[l_type]["used"]
            pending = balances_map[l_type]["pending"]
            remaining = max(0, alloc - used)
            details.append(
                LeaveBalanceDetail(
                    leave_type=l_type.value,
                    allocated=alloc,
                    used=used,
                    pending=pending,
                    remaining=remaining
                )
            )

        return LeaveBalancesResponse(employee_id=employee_id, year=current_year, balances=details)

    @staticmethod
    def get_employee_dashboard(db: Session, employee_id: str) -> EmployeeDashboardResponse:
        emp = AnalyticsService._get_employee(db, employee_id)

        # Count pending leaves
        pending_count = db.query(LeaveRequest).filter(
            LeaveRequest.employee_id == employee_id,
            LeaveRequest.status == LeaveStatus.PENDING
        ).count()

        # Count attendance streak / days present
        present_count = db.query(Attendance).filter(
            Attendance.employee_id == employee_id,
            Attendance.status == AttendanceStatus.PRESENT
        ).count()

        # Fetch latest payroll net pay
        latest_payroll = db.query(Payroll).filter(
            Payroll.employee_id == employee_id
        ).order_by(Payroll.pay_period.desc()).first()

        net_pay = latest_payroll.net_salary if latest_payroll else None

        return EmployeeDashboardResponse(
            employee_id=emp.id,
            first_name=emp.first_name,
            last_name=emp.last_name,
            email=emp.email,
            department=emp.department,
            designation=emp.designation,
            attendance_streak_days=present_count,
            pending_leaves_count=pending_count,
            latest_net_pay=net_pay
        )

    @staticmethod
    def get_attendance_summary(db: Session, employee_id: str, year_month: str = None) -> AttendanceSummaryResponse:
        AnalyticsService._get_employee(db, employee_id)
        ym = year_month or date.today().strftime("%Y-%m")

        attendances = db.query(Attendance).filter(
            Attendance.employee_id == employee_id
        ).all()

        monthly_records = [a for a in attendances if a.attendance_date.strftime("%Y-%m") == ym]

        present = sum(1 for a in monthly_records if a.status == AttendanceStatus.PRESENT)
        absent = sum(1 for a in monthly_records if a.status == AttendanceStatus.ABSENT)
        total_hours = 0.0
        for a in monthly_records:
            if a.check_in and a.check_out:
                duration = (a.check_out - a.check_in).total_seconds() / 3600.0
                total_hours += max(0.0, duration)

        return AttendanceSummaryResponse(
            employee_id=employee_id,
            year_month=ym,
            total_days_present=present,
            total_days_absent=absent,
            total_hours_worked=round(total_hours, 2)
        )

    @staticmethod
    def get_payroll_summary(db: Session, employee_id: str, year: int = None) -> PayrollSummaryResponse:
        AnalyticsService._get_employee(db, employee_id)
        target_year = year or date.today().year

        payrolls = db.query(Payroll).filter(
            Payroll.employee_id == employee_id
        ).all()

        yearly_payrolls = [p for p in payrolls if p.pay_period.startswith(str(target_year))]

        gross_ytd = sum((p.gross_salary for p in yearly_payrolls), Decimal('0.00'))
        net_ytd = sum((p.net_salary for p in yearly_payrolls), Decimal('0.00'))
        deductions_ytd = sum((p.deductions for p in yearly_payrolls), Decimal('0.00'))

        return PayrollSummaryResponse(
            employee_id=employee_id,
            year=target_year,
            gross_ytd=gross_ytd,
            net_ytd=net_ytd,
            deductions_ytd=deductions_ytd
        )

    @staticmethod
    def get_department_summaries(db: Session) -> DepartmentSummaryResponse:
        employees = db.query(Employee).all()
        dept_map: Dict[str, List[Employee]] = {}
        for emp in employees:
            dept = emp.department or "General"
            dept_map.setdefault(dept, []).append(emp)

        items = []
        for dept_name, dept_emps in dept_map.items():
            emp_ids = [e.id for e in dept_emps]
            active_leaves_count = db.query(LeaveRequest).filter(
                LeaveRequest.employee_id.in_(emp_ids),
                LeaveRequest.status == LeaveStatus.APPROVED
            ).count()

            # Sum latest monthly payroll
            monthly_payroll_sum = Decimal('0.00')
            for emp_id in emp_ids:
                pay = db.query(Payroll).filter(
                    Payroll.employee_id == emp_id
                ).order_by(Payroll.pay_period.desc()).first()
                if pay:
                    monthly_payroll_sum += pay.net_salary

            items.append(
                DepartmentSummaryItem(
                    department=dept_name,
                    total_employees=len(dept_emps),
                    active_leaves=active_leaves_count,
                    total_monthly_payroll=monthly_payroll_sum
                )
            )

        return DepartmentSummaryResponse(departments=items)
