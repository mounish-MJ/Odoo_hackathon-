import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from app.core.config import settings
from app.core.exceptions import HRCoreException
from app.ai.providers.base import LLMMessage


class ConversationSession(BaseModel):
    conversation_id: str
    user_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    messages: List[LLMMessage] = Field(default_factory=list)

    def append_message(self, msg: LLMMessage):
        self.messages.append(msg)
        self.updated_at = datetime.now(timezone.utc)

        # Enforce max history truncation
        if len(self.messages) > settings.MAX_HISTORY_MESSAGES:
            # Preserve system message if first
            system_msg = [m for m in self.messages if m.role == "system"]
            recent_msgs = [m for m in self.messages if m.role != "system"][-(settings.MAX_HISTORY_MESSAGES - 1):]
            self.messages = system_msg + recent_msgs


class SessionManager:
    _sessions: Dict[str, ConversationSession] = {}

    @classmethod
    def get_or_create_session(cls, conversation_id: Optional[str], user_id: str) -> ConversationSession:
        """Retrieves an existing session with strict user ownership check, or initializes a new session."""
        if conversation_id and conversation_id in cls._sessions:
            session = cls._sessions[conversation_id]
            if session.user_id != user_id:
                raise HRCoreException(
                    status_code=403,
                    code="FORBIDDEN",
                    message="Conversation isolation violation: Cannot access another user's conversation session."
                )
            return session

        new_id = conversation_id or str(uuid.uuid4())
        session = ConversationSession(conversation_id=new_id, user_id=user_id)
        cls._sessions[new_id] = session
        return session
