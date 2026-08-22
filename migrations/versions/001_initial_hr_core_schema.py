"""Initial HR Core Schema

Revision ID: 001_initial_hr_core_schema
Revises: 
Create Date: 2026-08-22 11:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '001_initial_hr_core_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('employee_id', sa.String(length=36), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # 2. Create employees table
    op.create_table(
        'employees',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=True),
        sa.Column('employee_code', sa.String(length=50), nullable=False),
        sa.Column('first_name', sa.String(length=100), nullable=False),
        sa.Column('last_name', sa.String(length=100), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('department', sa.String(length=100), nullable=False),
        sa.Column('designation', sa.String(length=100), nullable=False),
        sa.Column('date_of_joining', sa.Date(), nullable=False),
        sa.Column('employment_status', sa.String(length=50), nullable=False),
        sa.Column('manager_id', sa.String(length=36), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['manager_id'], ['employees.id'], ondelete='SET NULL'),
        sa.UniqueConstraint('user_id')
    )
    op.create_index(op.f('ix_employees_email'), 'employees', ['email'], unique=True)
    op.create_index(op.f('ix_employees_employee_code'), 'employees', ['employee_code'], unique=True)

    # Add foreign key from users.employee_id to employees.id using batch_alter_table
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.create_foreign_key('fk_users_employee_id', 'employees', ['employee_id'], ['id'], ondelete='SET NULL')

    # 3. Create attendance table
    op.create_table(
        'attendance',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('employee_id', sa.String(length=36), nullable=False),
        sa.Column('attendance_date', sa.Date(), nullable=False),
        sa.Column('check_in', sa.DateTime(timezone=True), nullable=True),
        sa.Column('check_out', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('employee_id', 'attendance_date', name='uq_employee_attendance_date'),
        sa.CheckConstraint('check_out >= check_in OR check_out IS NULL', name='chk_attendance_check_out')
    )
    op.create_index(op.f('ix_attendance_attendance_date'), 'attendance', ['attendance_date'], unique=False)
    op.create_index(op.f('ix_attendance_employee_id'), 'attendance', ['employee_id'], unique=False)

    # 4. Create leave_requests table
    op.create_table(
        'leave_requests',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('employee_id', sa.String(length=36), nullable=False),
        sa.Column('leave_type', sa.String(length=50), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('reviewed_by', sa.String(length=36), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('review_comment', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['reviewed_by'], ['employees.id'], ondelete='SET NULL'),
        sa.CheckConstraint('end_date >= start_date', name='chk_leave_dates')
    )
    op.create_index(op.f('ix_leave_requests_employee_id'), 'leave_requests', ['employee_id'], unique=False)
    op.create_index(op.f('ix_leave_requests_status'), 'leave_requests', ['status'], unique=False)

    # 5. Create payroll table
    op.create_table(
        'payroll',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('employee_id', sa.String(length=36), nullable=False),
        sa.Column('pay_period', sa.String(length=7), nullable=False),
        sa.Column('basic_salary', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('allowances', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('deductions', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('gross_salary', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('net_salary', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False, server_default='USD'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('employee_id', 'pay_period', name='uq_employee_pay_period')
    )
    op.create_index(op.f('ix_payroll_employee_id'), 'payroll', ['employee_id'], unique=False)
    op.create_index(op.f('ix_payroll_pay_period'), 'payroll', ['pay_period'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_payroll_pay_period'), table_name='payroll')
    op.drop_index(op.f('ix_payroll_employee_id'), table_name='payroll')
    op.drop_table('payroll')

    op.drop_index(op.f('ix_leave_requests_status'), table_name='leave_requests')
    op.drop_index(op.f('ix_leave_requests_employee_id'), table_name='leave_requests')
    op.drop_table('leave_requests')

    op.drop_index(op.f('ix_attendance_employee_id'), table_name='attendance')
    op.drop_index(op.f('ix_attendance_attendance_date'), table_name='attendance')
    op.drop_table('attendance')

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_constraint('fk_users_employee_id', type_='foreignkey')

    op.drop_index(op.f('ix_employees_employee_code'), table_name='employees')
    op.drop_index(op.f('ix_employees_email'), table_name='employees')
    op.drop_table('employees')

    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
