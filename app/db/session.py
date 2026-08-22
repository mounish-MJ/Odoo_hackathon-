from typing import Generator
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.core.logging import logger


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that provides a transactional database session per request.
    Ensures clean session closure and automatic rollback on exception.
    """
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        logger.error(f"Database session exception, rolling back: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()
