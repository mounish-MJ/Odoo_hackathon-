import pytest
from src.services.anomaly_engine import anomaly_engine


def test_detect_attendance_anomalies():
    res = anomaly_engine.detect_attendance_anomalies()
    assert res.total_anomalies >= 1
    types = [a.anomaly_type for a in res.anomalies]
    assert "UNANNOUNCED_ABSENCE" in types or "LATE_CHECKIN_SPIKE" in types


def test_detect_payroll_anomalies():
    res = anomaly_engine.detect_payroll_anomalies(month=8, year=2026)
    assert res.total_anomalies >= 1
    assert any(a.variance_percentage >= 15.0 for a in res.anomalies)
