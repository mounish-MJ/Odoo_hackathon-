import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, Enum as SQLEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


def utc_now():
    return datetime.now(timezone.utc)


class TokenType(str, enum.Enum):
    EMAIL_VERIFICATION = "EMAIL_VERIFICATION"
    PASSWORD_RESET = "PASSWORD_RESET"


class VerificationToken(Base):
    __tablename__ = "verification_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    token_type: Mapped[TokenType] = mapped_column(
        SQLEnum(TokenType, native_enum=False), default=TokenType.EMAIL_VERIFICATION, nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    user = relationship("User", backref="verification_tokens")
