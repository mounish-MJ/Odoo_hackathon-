import pytest
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)


def test_health_check_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "HEALTHY"
    assert data["service"] == "dayflow-ai-engine"


def test_copilot_chat_endpoint():
    headers = {"X-User-ID": "usr_88392", "X-User-Role": "EMPLOYEE"}
    payload = {
        "message": "Can I take 3 days off next week?",
        "user_id": "usr_88392",
        "user_role": "EMPLOYEE",
        "department": "Engineering"
    }
    response = client.post("/api/v1/ai/copilot/chat", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "intent" in data
    assert "message" in data
    assert data["intent"] in ["ASK", "EXPLAIN", "RECOMMEND", "ACT", "ACT_PREVIEW", "CLARIFICATION_REQUIRED", "POLICY_QA"]


def test_policy_query_endpoint():
    headers = {"X-User-ID": "usr_88392", "X-User-Role": "EMPLOYEE"}
    payload = {
        "query": "notice period for 3 days leave",
        "user_role": "EMPLOYEE",
        "top_k": 2
    }
    response = client.post("/api/v1/ai/policy/query", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "citations" in data


def test_leave_decision_endpoint():
    headers = {"X-User-ID": "usr_88392", "X-User-Role": "EMPLOYEE"}
    payload = {
        "user_id": "usr_88392",
        "leave_type": "PAID",
        "start_date": "2026-09-10",
        "end_date": "2026-09-12",
        "reason": "Personal trip"
    }
    response = client.post("/api/v1/ai/decision/leave-eligibility", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "recommendation" in data
    assert "rule_checks" in data


def test_attendance_anomaly_endpoint():
    headers = {"X-User-ID": "usr_10293", "X-User-Role": "MANAGER"}
    response = client.get("/api/v1/ai/anomalies/attendance", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "anomalies" in data


def test_payroll_anomaly_endpoint():
    headers = {"X-User-ID": "usr_admin", "X-User-Role": "HR_ADMIN"}
    response = client.get("/api/v1/ai/anomalies/payroll?month=8&year=2026", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "anomalies" in data
