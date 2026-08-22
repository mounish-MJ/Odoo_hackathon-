import logging
from typing import Dict, Any, List
from src.config import settings

logger = logging.getLogger("dayflow.database")


class DatabaseUnavailableError(RuntimeError):
    """Raised when persistent PostgreSQL database connection is unavailable in production."""
    pass


def is_db_available() -> bool:
    """Checks whether PostgreSQL database connection can be established."""
    try:
        import psycopg
        conn = psycopg.connect(settings.DATABASE_URL, connect_timeout=1)
        conn.close()
        return True
    except Exception:
        return False


def get_db_connection():
    """
    Returns a psycopg3 connection to PostgreSQL with pgvector enabled.
    In production mode, raises DatabaseUnavailableError if DB connection fails (Fail Closed).
    """
    try:
        import psycopg
        from pgvector.psycopg import register_vector
        conn = psycopg.connect(settings.DATABASE_URL)
        register_vector(conn)
        return conn
    except Exception as e:
        logger.error(f"PostgreSQL connection failed: {e}")
        if settings.ENVIRONMENT != "testing" and settings.ENVIRONMENT != "development":
            raise DatabaseUnavailableError("PostgreSQL database is currently unavailable. Failing closed.")
        raise e
