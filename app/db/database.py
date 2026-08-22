from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from app.core.config import settings
from app.core.logging import logger

def get_engine_args():
    db_url = settings.DATABASE_URL
    engine_kwargs = {}
    if db_url.startswith("sqlite"):
        engine_kwargs["connect_args"] = {"check_same_thread": False}
    else:
        engine_kwargs["pool_size"] = 10
        engine_kwargs["max_overflow"] = 20
        engine_kwargs["pool_pre_ping"] = True
        engine_kwargs["pool_recycle"] = 1800
    return engine_kwargs

engine = create_engine(
    settings.DATABASE_URL,
    **get_engine_args()
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def check_database_connection() -> bool:
    """
    Executes a lightweight query (`SELECT 1`) to verify database connection health.
    Returns True if database is healthy, False otherwise.
    """
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except (OperationalError, SQLAlchemyError, Exception) as e:
        logger.error(f"Database health check failed: {str(e)}")
        return False
