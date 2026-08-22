import uuid
import json
import hashlib
from enum import Enum
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from app.core.exceptions import HRCoreException

WORKFLOW_CONFIRMATION_TIMEOUT_SECONDS = 600  # 10 minutes timeout


class StepStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    WAITING_CONFIRMATION = "WAITING_CONFIRMATION"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    SKIPPED = "SKIPPED"


class WorkflowStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    WAITING_CONFIRMATION = "WAITING_CONFIRMATION"
    COMPLETED = "COMPLETED"
    PARTIALLY_COMPLETED = "PARTIALLY_COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def generate_confirmation_hash(user_id: str, tool_name: str, arguments: Dict[str, Any]) -> str:
    """Generates SHA-256 confirmation hash strictly bound to user_id, tool_name, and canonical arguments."""
    canonical_args = json.dumps(arguments, sort_keys=True)
    raw_payload = f"{user_id}:{tool_name}:{canonical_args}"
    return hashlib.sha256(raw_payload.encode("utf-8")).hexdigest()


class WorkflowStep(BaseModel):
    step_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    step_index: int
    tool_name: str
    arguments: Dict[str, Any] = Field(default_factory=dict)
    status: StepStatus = StepStatus.PENDING
    requires_confirmation: bool = False
    result: Optional[Any] = None
    error: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class WorkflowState(BaseModel):
    workflow_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    conversation_id: str
    user_id: str
    status: WorkflowStatus = WorkflowStatus.PENDING
    current_step_index: int = 0
    steps: List[WorkflowStep] = Field(default_factory=list)
    confirmation_hash: Optional[str] = None
    expires_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class WorkflowManager:
    _workflows: Dict[str, WorkflowState] = {}

    @classmethod
    def create_workflow(cls, conversation_id: str, user_id: str, step_proposals: List[Dict[str, Any]]) -> WorkflowState:
        """Initializes a new WorkflowState session with sequential step proposals."""
        workflow_id = str(uuid.uuid4())
        steps = []
        for idx, prop in enumerate(step_proposals):
            steps.append(WorkflowStep(
                step_index=idx,
                tool_name=prop["tool_name"],
                arguments=prop.get("arguments", {}),
                requires_confirmation=prop.get("requires_confirmation", False)
            ))

        workflow = WorkflowState(
            workflow_id=workflow_id,
            conversation_id=conversation_id,
            user_id=user_id,
            steps=steps
        )
        cls._workflows[workflow_id] = workflow
        return workflow

    @classmethod
    def get_workflow(cls, workflow_id: str, user_id: str) -> WorkflowState:
        """Retrieves active workflow state with strict user ownership and timeout expiration checks."""
        if workflow_id not in cls._workflows:
            raise HRCoreException(status_code=404, code="WORKFLOW_NOT_FOUND", message=f"Workflow '{workflow_id}' not found.")

        workflow = cls._workflows[workflow_id]
        if workflow.user_id != user_id:
            raise HRCoreException(
                status_code=403,
                code="FORBIDDEN",
                message="Workflow isolation violation: Cannot access another user's workflow session."
            )

        # Check expiration for workflows waiting confirmation
        if workflow.status == WorkflowStatus.WAITING_CONFIRMATION and workflow.expires_at:
            if utc_now() > workflow.expires_at:
                workflow.status = WorkflowStatus.EXPIRED
                workflow.updated_at = utc_now()
                raise HRCoreException(
                    status_code=400,
                    code="WORKFLOW_EXPIRED",
                    message="Pending workflow confirmation has expired (10-minute timeout)."
                )

        return workflow

    @classmethod
    def cancel_workflow(cls, workflow_id: str, user_id: str) -> WorkflowState:
        """Cancels a pending workflow session."""
        workflow = cls.get_workflow(workflow_id, user_id)
        workflow.status = WorkflowStatus.CANCELLED
        workflow.updated_at = utc_now()
        for step in workflow.steps:
            if step.status in [StepStatus.PENDING, StepStatus.WAITING_CONFIRMATION]:
                step.status = StepStatus.CANCELLED
                step.updated_at = utc_now()
        return workflow
