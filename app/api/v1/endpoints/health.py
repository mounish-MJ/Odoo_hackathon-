from fastapi import APIRouter, status
from app.core.config import settings
from app.db.database import check_database_connection
from app.core.exceptions import DatabaseConnectionError

router = APIRouter()


@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    """Returns application health status."""
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "environment": settings.ENVIRONMENT
    }


@router.get("/health/db", status_code=status.HTTP_200_OK)
async def database_health_check():
    """Returns PostgreSQL / database connection status."""
    is_connected = check_database_connection()
    if not is_connected:
        raise DatabaseConnectionError(message="Database connection failed or unavailable.")
    return {
        "status": "ok",
        "database": "connected"
    }
