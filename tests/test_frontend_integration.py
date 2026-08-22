import pytest
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)


def test_frontend_static_root_served():
    resp = client.get("/")
    assert resp.status_code == 200
    assert "<title>DAYFLOW" in resp.text


def test_frontend_static_assets_served():
    resp = client.get("/static/app.js")
    assert resp.status_code == 200
    assert "class ApiClient" in resp.text


def test_frontend_auth_login_flow():
    payload = {"email": "test.employee@dayflow.com", "password": "TestPassword123!"}
    resp = client.post("/api/v1/auth/login", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "SUCCESS"
    assert "access_token" in data


def test_frontend_get_employee_profile():
    headers = {"Authorization": "Bearer mock_jwt_test_token_88392"}
    resp = client.get("/api/v1/employees/me", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "id" in data or "user_id" in data


def test_frontend_get_leaves():
    headers = {"Authorization": "Bearer mock_jwt_test_token_88392"}
    resp = client.get("/api/v1/leaves", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "CASUAL" in data or isinstance(data, list)


def test_frontend_create_leave_201():
    headers = {"Authorization": "Bearer mock_jwt_test_token_88392"}
    payload = {
        "leave_type": "CASUAL",
        "start_date": "2026-11-01",
        "end_date": "2026-11-02",
        "reason": "Family function"
    }
    resp = client.post("/api/v1/leaves", json=payload, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "SUCCESS"
    assert data["status_code"] == 201


def test_frontend_get_attendance_daily():
    headers = {"Authorization": "Bearer mock_jwt_test_token_88392"}
    resp = client.get("/api/v1/attendance/daily?date=2026-08-20", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "records" in data or "date" in data


def test_frontend_get_attendance_weekly():
    headers = {"Authorization": "Bearer mock_jwt_test_token_88392"}
    resp = client.get("/api/v1/attendance/weekly?ref_date=2026-08-20", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "total_days_present" in data


def test_frontend_get_payroll():
    headers = {"Authorization": "Bearer mock_jwt_test_token_88392"}
    resp = client.get("/api/v1/payroll?pay_period=2026-08", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, (dict, list))
