"""Add verification_tokens table

Revision ID: 002_add_verification_tokens_table
Revises: 001_initial_hr_core_schema
Create Date: 2026-08-22 11:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '002_add_verification_tokens_table'
down_revision: Union[str, None] = '001_initial_hr_core_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'verification_tokens',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('token', sa.String(length=64), nullable=False),
        sa.Column('token_type', sa.String(length=50), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_used', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE')
    )
    op.create_index(op.f('ix_verification_tokens_token'), 'verification_tokens', ['token'], unique=True)
    op.create_index(op.f('ix_verification_tokens_user_id'), 'verification_tokens', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_verification_tokens_user_id'), table_name='verification_tokens')
    op.drop_index(op.f('ix_verification_tokens_token'), table_name='verification_tokens')
    op.drop_table('verification_tokens')
