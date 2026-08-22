import pytest
import datetime
from src.schemas.decision import LeaveEligibilityRequest
from src.services.decision_engine import decision_engine, calculate_days_requested


def test_calculate_days_requested():
    assert calculate_days_requested("2026-09-01", "2026-09-01") == 1
    assert calculate_days_requested("2026-09-01", "2026-09-03") == 3


def test_leave_eligibility_approved():
    # Advance start date to fulfill 5-day notice requirement for 3 days leave
    future_start = (datetime.date.today() + datetime.timedelta(days=10)).isoformat()
    future_end = (datetime.date.today() + datetime.timedelta(days=12)).isoformat()

    req = LeaveEligibilityRequest(
        user_id="usr_88392",
        leave_type="PAID",
        start_date=future_start,
        end_date=future_end,
        reason="Vacation trip"
    )
    res = decision_engine.evaluate_leave_eligibility(req)
    assert res.days_requested == 3
    assert res.eligible is True
    assert res.recommendation == "APPROVE"
    assert len(res.rule_checks) == 3


def test_leave_eligibility_insufficient_balance():
    future_start = (datetime.date.today() + datetime.timedelta(days=15)).isoformat()
    future_end = (datetime.date.today() + datetime.timedelta(days=35)).isoformat() # 21 days > 12 available

    req = LeaveEligibilityRequest(
        user_id="usr_88392",
        leave_type="PAID",
        start_date=future_start,
        end_date=future_end,
        reason="Extended travel"
    )
    res = decision_engine.evaluate_leave_eligibility(req)
    assert res.eligible is False
    assert res.recommendation == "REJECT"
