import json
import logging
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.user import User
from app.core.config import settings
from app.ai.providers.base import LLMMessage
from app.ai.providers.factory import LLMProviderFactory
from app.ai.tools.registry import ToolRegistry
from app.ai.engine import ToolExecutionEngine
from app.ai.agent.prompts import get_hr_agent_system_prompt
from app.ai.agent.agent_state import SessionManager, ConversationSession

logger = logging.getLogger("hr_core.ai.agent")


class HRAgent:

    @staticmethod
    def process_chat(
        db: Session,
        current_user: User,
        user_message: str,
        conversation_id: Optional[str] = None,
        confirmed: bool = False
    ) -> Dict[str, Any]:
        """
        Executes HR Agent conversational flow:
        1. Context Resolution & Session Isolation
        2. Role-filtered Tool Discovery
        3. Intent & Tool Selection Loop
        4. ToolExecutionEngine invocation (NO DIRECT DB ACCESS)
        5. Write Confirmation pauses
        6. Human-readable response formatting
        """
        session = SessionManager.get_or_create_session(conversation_id=conversation_id, user_id=current_user.id)

        # Initialize system prompt if new session
        if not session.messages or session.messages[0].role != "system":
            system_prompt_msg = LLMMessage(role="system", content=get_hr_agent_system_prompt())
            session.messages.insert(0, system_prompt_msg)

        # Append user message to history
        session.append_message(LLMMessage(role="user", content=user_message))

        provider = LLMProviderFactory.get_provider()
        tools = ToolRegistry.get_tools_for_role(role=current_user.role)

        iteration = 0
        while iteration < settings.MAX_TOOL_ITERATIONS:
            iteration += 1

            try:
                llm_resp = provider.generate_response(messages=session.messages, tools=tools)
            except Exception as exc:
                logger.error(f"LLM Provider failure: {exc}")
                return {
                    "conversation_id": session.conversation_id,
                    "status": "error",
                    "message": "AI service is temporarily unavailable. Please try again."
                }

            # Check if LLM requested tool execution
            if llm_resp.tool_calls:
                for call in llm_resp.tool_calls:
                    fn = call.get("function", {})
                    tool_name = fn.get("name")
                    raw_args = fn.get("arguments", "{}")

                    try:
                        arguments = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
                    except Exception:
                        arguments = {}

                    # Execute proposed tool through Phase 5 ToolExecutionEngine
                    tool_res = ToolExecutionEngine.execute(
                        db=db,
                        current_user=current_user,
                        tool_name=tool_name,
                        arguments=arguments,
                        confirmed=confirmed
                    )

                    # Pause loop if write confirmation is required
                    if tool_res.status == "confirmation_required":
                        summary = tool_res.confirmation_summary or f"Action '{tool_name}' requires confirmation."
                        return {
                            "conversation_id": session.conversation_id,
                            "status": "confirmation_required",
                            "message": summary,
                            "confirmation": {
                                "tool": tool_name,
                                "arguments": arguments
                            }
                        }

                    # Append tool result to conversation history for LLM synthesis
                    tool_content = json.dumps(tool_res.data if tool_res.success else tool_res.error)
                    session.append_message(LLMMessage(
                        role="tool",
                        content=tool_content,
                        tool_call_id=call.get("id")
                    ))
            else:
                # LLM produced final text response
                assistant_msg = llm_resp.content or "I have processed your request."
                session.append_message(LLMMessage(role="assistant", content=assistant_msg))
                return {
                    "conversation_id": session.conversation_id,
                    "status": "completed",
                    "message": assistant_msg
                }

        # Safety fallback if max iterations reached
        fallback_msg = "I was unable to complete the request within the maximum allowed steps."
        session.append_message(LLMMessage(role="assistant", content=fallback_msg))
        return {
            "conversation_id": session.conversation_id,
            "status": "completed",
            "message": fallback_msg
        }
