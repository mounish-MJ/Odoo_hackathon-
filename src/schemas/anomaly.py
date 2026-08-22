from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class AttendanceAnomalyItem(BaseModel):
    anomaly_id: str
    user_id: str
    employee_name: str
    date: str
    anomaly_type: str = Field(..., description="LATE_CHECKIN_SPIKE, SHORT_SHIFT, UNANNOUNCED_ABSENCE")
    metric_value: float
    expected_value: float
    z_score: float
    severity: str = Field("MEDIUM", description="LOW, MEDIUM, HIGH, CRITICAL")
    recommended_action: str = Field("HR_REVIEW", description="Neutral recommendation action")
    explanation: str
    ai_suggested: bool = Field(True, description="Identifies report as AI suggested pattern detection")


class AttendanceAnomalyResponse(BaseModel):
    total_anomalies: int
    department: Optional[str]
    anomalies: List[AttendanceAnomalyItem]
    ai_suggested: bool = Field(True, description="Identifies response as AI suggested pattern detection")


class PayrollAnomalyItem(BaseModel):
    anomaly_id: str
    user_id: str
    employee_name: str
    month: int
    year: int
    anomaly_type: str = Field(..., description="SALARY_VARIANCE_SPIKE, OVERTIME_ANOMALY, DUPLICATE_DEDUCTION")
    current_gross: float
    baseline_gross: float
    variance_percentage: float
    severity: str = Field("MEDIUM", description="LOW, MEDIUM, HIGH, CRITICAL")
    recommended_action: str = Field("HR_AUDIT", description="Neutral recommendation action")
    explanation: str
    ai_suggested: bool = Field(True, description="Identifies report as AI suggested pattern detection")


class PayrollAnomalyResponse(BaseModel):
    total_anomalies: int
    month: int
    year: int
    anomalies: List[PayrollAnomalyItem]
    ai_suggested: bool = Field(True, description="Identifies response as AI suggested pattern detection")
