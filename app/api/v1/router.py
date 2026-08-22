from fastapi import APIRouter
from app.api.v1.endpoints import health, auth, employees, attendance, leaves

api_router = APIRouter()
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication & RBAC"])
api_router.include_router(employees.router, prefix="/employees", tags=["Employee Management"])
api_router.include_router(attendance.router, prefix="/attendance", tags=["Attendance Tracking"])
api_router.include_router(leaves.router, prefix="/leaves", tags=["Leave Management"])
