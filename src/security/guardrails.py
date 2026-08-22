import re
import logging
from typing import Tuple

logger = logging.getLogger("dayflow.security.guardrails")

# Pattern definitions for common prompt injection / jailbreak attacks
PROMPT_INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous\s+)?instructions",
    r"reveal\s+(your\s+)?system\s+prompt",
    r"override\s+(policy|system|rules)",
    r"system\s+prompt\s+is",
    r"change\s+my\s+salary",
    r"set\s+my\s+salary",
    r"approve\s+(my\s+)?leave\s+without\s+check",
    r"bypass\s+rbac",
    r"you\s+are\s+now\s+in\s+dan\s+mode"
]

SENSITIVE_DATA_PATTERNS = [
    r"show\s+me\s+another\s+employee'?s?\s+salary",
    r"what\s+is\s+.*'?s?\s+salary",
    r"list\s+all\s+passwords",
    r"show\s+all\s+bank\s+accounts"
]


def sanitize_and_check_guardrails(user_input: str) -> Tuple[bool, str, str]:
    """
    Sanitizes user input and checks for prompt injection / unauthorized data requests.
    Returns: (is_safe, refusal_reason, cleaned_input)
    """
    input_lower = user_input.lower().strip()

    # 1. Prompt Injection Check
    for pattern in PROMPT_INJECTION_PATTERNS:
        if re.search(pattern, input_lower):
            logger.warning(f"Security Alert: Prompt injection pattern detected: '{pattern}'")
            return False, "🛡️ **Security Alert:** Request refused due to unauthorized instruction override attempt.", user_input

    # 2. Sensitive Data Access Check
    for pattern in SENSITIVE_DATA_PATTERNS:
        if re.search(pattern, input_lower):
            logger.warning(f"Security Alert: Unauthorized sensitive data query detected: '{pattern}'")
            return False, "🔒 **Access Denied:** You are not authorized to view compensation or confidential data for other employees.", user_input

    return True, "", user_input
