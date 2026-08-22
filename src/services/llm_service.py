import json
import datetime
import logging
from typing import Dict, Any, Optional
from src.config import settings

logger = logging.getLogger("dayflow.llm_service")


class LLMService:
    """
    OpenAI LLM Integration Service.
    Performs Natural Language Understanding (NLU), Intent & Entity Extraction,
    Relative Date Resolution, and Evidence Explanation Synthesis.
    """
    def __init__(self):
        pass

    def extract_intent_and_entities(self, user_message: str, current_date: Optional[str] = None) -> Dict[str, Any]:
        """
        Invokes OpenAI gpt-4o-mini to extract structured intent, leave type, start_date, end_date, and reason.
        Converts relative dates ("tomorrow", "next Monday") to ISO format (YYYY-MM-DD).
        """
        today_str = current_date or datetime.date.today().isoformat()

        if settings.OPENAI_API_KEY and settings.OPENAI_API_KEY.startswith("sk-"):
            try:
                from openai import OpenAI
                client = OpenAI(api_key=settings.OPENAI_API_KEY)
                
                system_prompt = (
                    f"You are the NLU parser for DAYFLOW HR system. Today's date is {today_str}.\n"
                    "Extract structured intent and entities from the user prompt into JSON format:\n"
                    "{\n"
                    '  "intent": "leave_request" | "read_query" | "policy_qa" | "unknown",\n'
                    '  "leave_type": "PAID" | "SICK" | "CASUAL" | "UNPAID" | null,\n'
                    '  "start_date": "YYYY-MM-DD" | null,\n'
                    '  "end_date": "YYYY-MM-DD" | null,\n'
                    '  "reason": "string" | null,\n'
                    '  "confidence": 0.0 to 1.0,\n'
                    '  "missing_fields": ["leave_type" | "start_date" | "end_date"]\n'
                    "}"
                )

                resp = client.chat.completions.create(
                    model=settings.LLM_MODEL,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.0
                )
                parsed = json.loads(resp.choices[0].message.content)
                logger.info(f"OpenAI LLM NLU Extracted: {parsed}")
                return parsed
            except Exception as e:
                logger.warning(f"OpenAI Chat API call failed ({e}). Falling back to rule-based parser.")

        # Heuristic Date & Entity Resolution for offline/test mode
        return self._heuristic_extract(user_message, today_str)

    def _heuristic_extract(self, user_message: str, today_str: str) -> Dict[str, Any]:
        """Fallback rule-based entity parser for test/offline resilience."""
        msg_lower = user_message.lower()
        today = datetime.date.fromisoformat(today_str)
        
        intent = "unknown"
        leave_type = None
        start_date = None
        end_date = None
        reason = None
        missing = []

        if any(w in msg_lower for w in ["leave", "vacation", "off", "time off"]):
            intent = "leave_request"
            
            # Extract leave type
            if "casual" in msg_lower:
                leave_type = "CASUAL"
            elif "sick" in msg_lower:
                leave_type = "SICK"
            elif "unpaid" in msg_lower:
                leave_type = "UNPAID"
            elif "paid" in msg_lower or "annual" in msg_lower:
                leave_type = "PAID"
            else:
                missing.append("leave_type")

            # Extract relative dates
            if "tomorrow" in msg_lower:
                start_date = (today + datetime.timedelta(days=1)).isoformat()
                end_date = start_date
            elif "next monday" in msg_lower:
                days_ahead = 0 - today.weekday() + 7
                d1 = today + datetime.timedelta(days=days_ahead)
                start_date = d1.isoformat()
                end_date = (d1 + datetime.timedelta(days=1)).isoformat() if "tuesday" in msg_lower else d1.isoformat()
            else:
                missing.append("start_date")
                missing.append("end_date")

            # Extract reason if present
            if "family function" in msg_lower:
                reason = "Family function"
            elif "personal" in msg_lower or "vacation" in msg_lower:
                reason = "Personal"

        elif any(w in msg_lower for w in ["absent today", "how many employees", "payroll summary"]):
            intent = "read_query"
        elif any(w in msg_lower for w in ["policy", "notice period", "handbook", "allowance"]):
            intent = "policy_qa"

        confidence = 0.95 if (intent != "unknown" and not missing) else (0.60 if missing else 0.40)
        
        return {
            "intent": intent,
            "leave_type": leave_type,
            "start_date": start_date,
            "end_date": end_date,
            "reason": reason,
            "confidence": confidence,
            "missing_fields": missing
        }


llm_service = LLMService()
