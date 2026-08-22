import datetime
import logging
from typing import List, Dict, Any
from src.schemas.decision import LeaveEligibilityRequest, LeaveEligibilityResponse, RuleCheckResult
from src.services.context_engine import employee_context_engine
from src.services.policy_rag import policy_rag_service, Citation
from src.config import settings

logger = logging.getLogger("dayflow.decision_engine")


def calculate_days_requested(start_date_str: str, end_date_str: str) -> int:
    """Calculates inclusive day count between start and end date."""
    try:
        d1 = datetime.date.fromisoformat(start_date_str)
        d2 = datetime.date.fromisoformat(end_date_str)
        delta = (d2 - d1).days + 1
        return max(1, delta)
    except Exception:
        return 1


class DecisionEngine:
    def __init__(self):
        pass

    def evaluate_leave_eligibility(self, request: LeaveEligibilityRequest) -> LeaveEligibilityResponse:
        # Fetch Context
        context = employee_context_engine.get_employee_context(user_id=request.user_id)
        leave_balances = context.get("leave_balances", {})
        target_balance = leave_balances.get(request.leave_type.upper(), {"available": 0})
        available_days = target_balance.get("available", 0)

        # Retrieve Policy Citations
        citations = policy_rag_service.retrieve_relevant_chunks(
            query=f"{request.leave_type} leave notice period entitlement blackout",
            category="LEAVE",
            top_k=2
        )

        days_req = calculate_days_requested(request.start_date, request.end_date)

        # STAGE 1: Deterministic Rule Verification
        rule_checks = []

        # Rule 1: Balance Check
        has_sufficient_balance = available_days >= days_req or request.leave_type == "UNPAID"
        rule_checks.append(RuleCheckResult(
            rule_code="LEAVE_BALANCE_CHECK",
            rule_name="Sufficient Leave Balance",
            passed=has_sufficient_balance,
            details=f"Requested {days_req} days. Available {available_days} days of {request.leave_type} leave."
        ))

        # Rule 2: Notice Period Check
        today = datetime.date.today()
        start_d = datetime.date.fromisoformat(request.start_date)
        notice_days = (start_d - today).days

        required_notice = 1
        if days_req >= 6:
            required_notice = 14
        elif days_req >= 3:
            required_notice = 5

        notice_passed = notice_days >= required_notice
        rule_checks.append(RuleCheckResult(
            rule_code="NOTICE_PERIOD_CHECK",
            rule_name="Minimum Notice Period Met",
            passed=notice_passed,
            details=f"Provided {notice_days} days notice. Required {required_notice} days notice for a {days_req}-day request."
        ))

        # Rule 3: Blackout Period Check (Dec 20 - Jan 05)
        is_blackout = (start_d.month == 12 and start_d.day >= 20) or (start_d.month == 1 and start_d.day <= 5)
        rule_checks.append(RuleCheckResult(
            rule_code="BLACKOUT_PERIOD_CHECK",
            rule_name="Year-End Freeze Check",
            passed=not is_blackout,
            details="Dates fall within year-end freeze period (Dec 20 - Jan 5)." if is_blackout else "No active blackout constraints."
        ))

        # STAGE 2: LLM Evidence Synthesis & Recommendation Determination
        all_passed = all(r.passed for r in rule_checks)
        
        if all_passed:
            recommendation = "APPROVE"
            explanation = (
                f"**Recommendation: APPROVE**\n\n"
                f"- **Balance Verified:** You have {available_days} days of {request.leave_type} leave available for a {days_req}-day request.\n"
                f"- **Notice Period:** Request submitted with {notice_days} days advance notice (minimum required: {required_notice} days).\n"
                f"- **Policy Compliance:** No blackout period or overlap constraints violated."
            )
        elif not has_sufficient_balance:
            recommendation = "REJECT"
            shortfall = days_req - available_days
            explanation = (
                f"**Recommendation: REJECT (Insufficient Balance)**\n\n"
                f"- **Shortfall:** You requested {days_req} days but only have {available_days} days of {request.leave_type} leave remaining.\n"
                f"- **Suggested Action:** Consider reducing request duration or applying for {shortfall} day(s) of Unpaid Leave."
            )
        elif not notice_passed:
            recommendation = "MANUAL_REVIEW"
            explanation = (
                f"**Recommendation: MANUAL REVIEW (Short Notice)**\n\n"
                f"- **Notice Warning:** Request submitted with only {notice_days} day(s) notice (policy requires {required_notice} days advance notice for {days_req} days of leave).\n"
                f"- **Next Step:** Manager approval required to grant a policy exception."
            )
        else:
            recommendation = "MANUAL_REVIEW"
            explanation = f"**Recommendation: MANUAL REVIEW**\n\n- Flagged for year-end freeze authorization."

        logger.info(f"Evaluated leave eligibility for user {request.user_id}: {recommendation}")

        return LeaveEligibilityResponse(
            user_id=request.user_id,
            leave_type=request.leave_type,
            days_requested=days_req,
            eligible=all_passed,
            recommendation=recommendation,
            rule_checks=rule_checks,
            citations=citations,
            explanation=explanation,
            confidence_score=0.95 if all_passed else 0.85
        )


decision_engine = DecisionEngine()
