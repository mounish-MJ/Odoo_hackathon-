from fastapi import APIRouter
from app.api.v1.endpoints import health, auth, employees

api_router = APIRouter()
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication & RBAC"])
api_router.include_router(employees.router, prefix="/employees", tags=["Employee Management"])
