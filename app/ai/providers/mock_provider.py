import json
from typing import List, Dict, Any, Optional
from app.ai.providers.base import LLMProvider, LLMMessage, LLMResponse


class MockLLMProvider(LLMProvider):
    def __init__(self, model_name: str = "mock-hr-agent"):
        self.model_name = model_name

    def provider_name(self) -> str:
        return "mock"

    def supports_tools(self) -> bool:
        return True

    def generate_response(
        self,
        messages: List[LLMMessage],
        tools: Optional[List[Dict[str, Any]]] = None
    ) -> LLMResponse:
        # Check if the last message is a tool response
        last_msg = messages[-1] if messages else None
        if last_msg and last_msg.role == "tool":
            try:
                data = json.loads(last_msg.content or "{}")
                return LLMResponse(
                    content=f"Here is the requested information: {json.dumps(data, indent=2)}",
                    finish_reason="stop"
                )
            except Exception:
                return LLMResponse(content=f"Tool execution completed: {last_msg.content}", finish_reason="stop")

        # Otherwise examine user message intent
        user_msgs = [m for m in messages if m.role == "user"]
        text = user_msgs[-1].content.lower() if user_msgs and user_msgs[-1].content else ""

        # Map natural language intents to tools
        if "profile" in text or "who am i" in text:
            return LLMResponse(
                tool_calls=[{"id": "call_1", "function": {"name": "get_employee_profile", "arguments": "{}"}}],
                finish_reason="tool_calls"
            )
        elif "weekly attendance" in text or "worked this week" in text or "days present" in text:
            return LLMResponse(
                tool_calls=[{"id": "call_2", "function": {"name": "get_weekly_attendance", "arguments": "{}"}}],
                finish_reason="tool_calls"
            )
        elif "daily attendance" in text or "attendance today" in text or "work today" in text or "attendance" in text:
            return LLMResponse(
                tool_calls=[{"id": "call_3", "function": {"name": "get_attendance", "arguments": "{}"}}],
                finish_reason="tool_calls"
            )
        elif "pending leave" in text:
            return LLMResponse(
                tool_calls=[{"id": "call_4", "function": {"name": "get_leave_requests", "arguments": '{"status": "PENDING"}'}}],
                finish_reason="tool_calls"
            )
        elif "leave request" in text or "my leaves" in text:
            return LLMResponse(
                tool_calls=[{"id": "call_5", "function": {"name": "get_leave_requests", "arguments": "{}"}}],
                finish_reason="tool_calls"
            )
        elif "apply" in text and "leave" in text:
            # Simple extraction for demo mock
            return LLMResponse(
                tool_calls=[{
                    "id": "call_6",
                    "function": {
                        "name": "apply_leave",
                        "arguments": '{"leave_type": "ANNUAL", "start_date": "2026-11-10", "end_date": "2026-11-12", "reason": "Family vacation"}'
                    }
                }],
                finish_reason="tool_calls"
            )
        elif "approve leave" in text:
            return LLMResponse(
                tool_calls=[{
                    "id": "call_7",
                    "function": {
                        "name": "approve_leave",
                        "arguments": '{"leave_id": "target_leave_id", "review_comment": "Approved"}'
                    }
                }],
                finish_reason="tool_calls"
            )
        elif "reject leave" in text:
            return LLMResponse(
                tool_calls=[{
                    "id": "call_8",
                    "function": {
                        "name": "reject_leave",
                        "arguments": '{"leave_id": "target_leave_id", "review_comment": "Rejected"}'
                    }
                }],
                finish_reason="tool_calls"
            )
        elif "payroll" in text or "salary" in text or "payslip" in text:
            return LLMResponse(
                tool_calls=[{"id": "call_9", "function": {"name": "get_payroll", "arguments": "{}"}}],
                finish_reason="tool_calls"
            )
        elif "create payroll" in text:
            return LLMResponse(
                tool_calls=[{
                    "id": "call_10",
                    "function": {
                        "name": "create_payroll",
                        "arguments": '{"employee_id": "emp_123", "pay_period": "2026-08", "basic_salary": "5000.00"}'
                    }
                }],
                finish_reason="tool_calls"
            )
        else:
            return LLMResponse(
                content="Hello! I am your HR Assistant. How can I help you today with your profile, attendance, leave, or payroll?",
                finish_reason="stop"
            )
