import uuid
import logging
from typing import Optional, Dict, Any
from src.schemas.copilot import ToolCall, CopilotChatResponse
from src.services.policy_rag import policy_rag_service
from src.services.context_engine import employee_context_engine
from src.services.llm_service import llm_service
from src.adapters.member1_adapter import member1_adapter
from src.security.guardrails import sanitize_and_check_guardrails
from src.config import settings

logger = logging.getLogger("dayflow.tool_router")

ROLE_PERMISSIONS = {
    "EMPLOYEE": ["submit_leave_request", "mark_attendance", "view_payslip", "query_policy"],
    "MANAGER": ["submit_leave_request", "mark_attendance", "view_payslip", "query_policy", "approve_leave_request", "view_team_anomalies"],
    "HR_ADMIN": ["submit_leave_request", "mark_attendance", "view_payslip", "query_policy", "approve_leave_request", "view_team_anomalies", "ingest_policy", "run_payroll_audit"]
}

# In-memory store for pending tool confirmations (2-Step confirmation flow)
_pending_confirmations: Dict[str, Dict[str, Any]] = {}


class ToolRouter:
    """
    AI Tool Router & Safety Proxy.
    Performs LLM-based NLU, Dynamic Entity Extraction, 2-Step Action Confirmation,
    and Member 1 API Tool Invocation with Member 4 Audit Actor Metadata.
    """
    def __init__(self):
        pass

    def route_chat_query(
        self,
        message: str,
        user_id: str,
        user_role: str = "EMPLOYEE",
        department: str = "Engineering",
        conversation_id: Optional[str] = None,
        confirm: bool = False,
        confirm_token: Optional[str] = None,
        auth_token: Optional[str] = None
    ) -> CopilotChatResponse:
        conv_id = conversation_id or f"conv_{uuid.uuid4().hex[:8]}"

        # 1. Security & Guardrail Check (Prompt Injection / Sensitive Data Access)
        is_safe, refusal_reason, cleaned_input = sanitize_and_check_guardrails(message)
        if not is_safe:
            return CopilotChatResponse(
                conversation_id=conv_id,
                intent="SECURITY_REFUSAL",
                message=refusal_reason,
                citations=[],
                suggested_action=None,
                confidence=0.0
            )

        # 2. Handle Step 2 Action Execution Confirmation
        if confirm and confirm_token:
            if confirm_token in _pending_confirmations:
                pending = _pending_confirmations.pop(confirm_token)
                tool_name = pending["tool_name"]
                params = pending["parameters"]

                # RBAC Verification
                if tool_name not in ROLE_PERMISSIONS.get(user_role, []):
                    return CopilotChatResponse(
                        conversation_id=conv_id,
                        intent="ACT_CONFIRMED",
                        message=f"🔒 **Access Denied:** Role `{user_role}` is not authorized to execute `{tool_name}`.",
                        citations=[],
                        suggested_action=None,
                        confidence=0.0
                    )

                # Member 4 Audit Actor Metadata
                actor_metadata = {
                    "actor": {
                        "type": "AI",
                        "agent": "DAYFLOW_MEMBER_2",
                        "user_id": user_id,
                        "request_id": f"req_{uuid.uuid4().hex[:8]}"
                    }
                }

                # Invoke Member 1 API Tool
                api_result = member1_adapter.create_leave_request(
                    user_id=params["user_id"],
                    leave_type=params["leave_type"],
                    start_date=params["start_date"],
                    end_date=params["end_date"],
                    reason=params.get("reason", "Personal"),
                    actor_metadata=actor_metadata,
                    auth_token=auth_token
                )

                response_text = (
                    f"✅ **Leave Request Submitted Successfully via Member 1 HR API!**\n\n"
                    f"- **Leave Request ID:** `{api_result.get('leave_request_id')}`\n"
                    f"- **Type:** {params['leave_type']}\n"
                    f"- **Dates:** {params['start_date']} to {params['end_date']}\n"
                    f"- **Status:** `{api_result.get('state', 'PENDING_MANAGER_APPROVAL')}`\n\n"
                    f"*Submitted with Member 4 Audit Trace ID: `{actor_metadata['actor']['request_id']}`*"
                )

                return CopilotChatResponse(
                    conversation_id=conv_id,
                    intent="ACT_CONFIRMED",
                    message=response_text,
                    citations=[],
                    suggested_action=None,
                    confidence=1.0
                )
            else:
                return CopilotChatResponse(
                    conversation_id=conv_id,
                    intent="ACT_FAILED",
                    message="⚠️ Confirmation token expired or invalid. Please submit your leave request again.",
                    citations=[],
                    suggested_action=None,
                    confidence=0.0
                )

        # 3. LLM NLU Intent & Entity Extraction
        nlu = llm_service.extract_intent_and_entities(message)
        intent = nlu.get("intent", "unknown")
        confidence = nlu.get("confidence", 0.5)

        # 4. Low Confidence Fallback / Missing Info Check
        missing = nlu.get("missing_fields", [])
        if intent == "leave_request" and (confidence < 0.70 or missing):
            missing_desc = ", ".join([f"`{m}`" for m in missing]) if missing else "specific dates or leave category"
            return CopilotChatResponse(
                conversation_id=conv_id,
                intent="CLARIFICATION_REQUIRED",
                message=f"I understood you want to request leave, but I need clarification on {missing_desc}. Could you specify the exact dates and leave type (e.g., Casual, Sick, Paid)?",
                citations=[],
                suggested_action=None,
                confidence=confidence
            )

        # 5. Handle Intent: LEAVE_REQUEST (Step 1 Confirmation Preview)
        if intent == "leave_request":
            leave_type = nlu.get("leave_type") or "PAID"
            start_date = nlu.get("start_date")
            end_date = nlu.get("end_date")
            reason = nlu.get("reason") or "Personal reason"

            # Retrieve Policy Citations
            citations = policy_rag_service.retrieve_relevant_chunks(
                query=f"{leave_type} leave notice period entitlement",
                category="LEAVE",
                top_k=2
            )

            # Generate Confirmation Token
            token = f"tok_{uuid.uuid4().hex[:8]}"
            _pending_confirmations[token] = {
                "tool_name": "submit_leave_request",
                "parameters": {
                    "user_id": user_id,
                    "leave_type": leave_type,
                    "start_date": start_date,
                    "end_date": end_date,
                    "reason": reason
                }
            }

            suggested_action = ToolCall(
                tool_name="submit_leave_request",
                parameters={
                    "user_id": user_id,
                    "leave_type": leave_type,
                    "start_date": start_date,
                    "end_date": end_date,
                    "reason": reason,
                    "confirm_token": token
                },
                requires_approval=True
            )

            response_text = (
                f"I understood your leave application request:\n\n"
                f"- **Leave Type:** `{leave_type}`\n"
                f"- **Start Date:** `{start_date}`\n"
                f"- **End Date:** `{end_date}`\n"
                f"- **Reason:** `{reason}`\n\n"
                f"Would you like me to submit this request to your manager via Member 1 HR API?"
            )

            return CopilotChatResponse(
                conversation_id=conv_id,
                intent="ACT_PREVIEW",
                message=response_text,
                citations=citations,
                suggested_action=suggested_action,
                confidence=confidence
            )

        # 6. Handle Intent: READ_QUERY (Read-Only Queries over Member 1 APIs)
        elif intent == "read_query":
            context = employee_context_engine.get_employee_context(user_id=user_id, auth_token=auth_token)
            att = context.get("attendance_summary", {})
            balances = context.get("leave_balances", {})

            response_text = (
                f"📊 **Read-Only HR Summary:**\n\n"
                f"- **Attendance (Last 30 Days):** Present: {att.get('present_days', 0)} days, Late: {att.get('late_checkins', 0)} check-ins.\n"
                f"- **Paid Leave Available:** {balances.get('PAID', {}).get('available', 0)} days\n"
                f"- **Sick Leave Available:** {balances.get('SICK', {}).get('available', 0)} days\n"
                f"- **Casual Leave Available:** {balances.get('CASUAL', {}).get('available', 0)} days"
            )
            return CopilotChatResponse(
                conversation_id=conv_id,
                intent="READ_QUERY",
                message=response_text,
                citations=[],
                suggested_action=None,
                confidence=0.95
            )

        # 7. Default Intent: POLICY_QA (Vector Policy RAG)
        else:
            citations = policy_rag_service.retrieve_relevant_chunks(message, top_k=3)
            
            if citations:
                context_str = "\n\n".join([f"- **{c.policy_name} ({c.section}):** {c.content_snippet}" for c in citations])
                response_text = f"Here is the relevant HR policy information:\n\n{context_str}"
            else:
                response_text = "I couldn't find sufficient policy evidence to answer confidently."
            
            return CopilotChatResponse(
                conversation_id=conv_id,
                intent="POLICY_QA",
                message=response_text,
                citations=citations,
                suggested_action=None,
                confidence=0.85 if citations else 0.40
            )


tool_router = ToolRouter()
