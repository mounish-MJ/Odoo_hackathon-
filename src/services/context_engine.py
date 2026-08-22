import logging
from typing import Dict, Any, Optional
from src.adapters.member1_adapter import member1_adapter

logger = logging.getLogger("dayflow.context_engine")


class EmployeeContextEngine:
    """
    Employee Context Engine.
    Retrieves authorized employee context snapshots via Member 1 REST APIs.
    Member 2 NEVER holds Member 1 database credentials or directly queries Member 1 SQL tables.
    """
    def __init__(self):
        pass

    def get_employee_context(self, user_id: str, auth_token: Optional[str] = None) -> Dict[str, Any]:
        """
        Fetches employee profile, leave balances, and 30-day attendance stats via Member 1 APIs.
        Strips PII (salary, SSN, home address) before compiling AI prompt context.
        """
        profile = member1_adapter.get_employee_profile(user_id=user_id, auth_token=auth_token)
        balances = member1_adapter.get_leave_balances(user_id=user_id, auth_token=auth_token)
        attendance = member1_adapter.get_attendance_summary(user_id=user_id, auth_token=auth_token)

        context_snapshot = {
            "user_id": profile.get("user_id", user_id),
            "role": profile.get("role", "EMPLOYEE"),
            "department": profile.get("department", "Engineering"),
            "leave_balances": balances,
            "attendance_summary": attendance
        }
        logger.info(f"Retrieved minimal employee context via Member 1 API for {user_id}")
        return context_snapshot


employee_context_engine = EmployeeContextEngine()
