from fastapi import APIRouter
from app.api.v1.endpoints import health, auth, employees, attendance, leaves, payroll, ai_tools, ai_chat, ai_workflows

api_router = APIRouter()
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication & RBAC"])
api_router.include_router(employees.router, prefix="/employees", tags=["Employee Management"])
api_router.include_router(attendance.router, prefix="/attendance", tags=["Attendance Tracking"])
api_router.include_router(leaves.router, prefix="/leaves", tags=["Leave Management"])
api_router.include_router(payroll.router, prefix="/payroll", tags=["Payroll Management"])
api_router.include_router(ai_tools.router, prefix="/ai", tags=["AI Tools"])
api_router.include_router(ai_chat.router, prefix="/ai", tags=["AI Conversational Agent"])
api_router.include_router(ai_workflows.router, prefix="/ai", tags=["AI Workflows"])
