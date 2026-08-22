from datetime import timedelta, datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.user import User
from app.core.exceptions import HRCoreException
from app.ai.tools.registry import ToolRegistry
from app.ai.engine import ToolExecutionEngine
from app.ai.workflows.workflow_state import (
    WorkflowState,
    WorkflowStep,
    WorkflowStatus,
    StepStatus,
    WorkflowManager,
    generate_confirmation_hash,
    WORKFLOW_CONFIRMATION_TIMEOUT_SECONDS,
    utc_now
)

MAX_WORKFLOW_STEPS = 10


class WorkflowOrchestrator:

    @staticmethod
    def execute_workflow(
        db: Session,
        current_user: User,
        workflow_id: str,
        confirmed: bool = False
    ) -> Dict[str, Any]:
        """
        Orchestrates multi-step workflow execution with confirmation hash-binding,
        anti-replay protection, 10-minute timeout expiration, and partial completion failure recovery.
        """
        workflow = WorkflowManager.get_workflow(workflow_id=workflow_id, user_id=current_user.id)

        if len(workflow.steps) > MAX_WORKFLOW_STEPS:
            raise HRCoreException(status_code=400, code="WORKFLOW_LIMIT_EXCEEDED", message=f"Workflow steps count exceeds maximum limit ({MAX_WORKFLOW_STEPS}).")

        if workflow.status in [WorkflowStatus.COMPLETED, WorkflowStatus.CANCELLED, WorkflowStatus.FAILED, WorkflowStatus.EXPIRED]:
            return {
                "workflow_id": workflow.workflow_id,
                "status": workflow.status.value,
                "message": f"Workflow is already in '{workflow.status.value}' status.",
                "steps": [s.model_dump(mode="json") for s in workflow.steps]
            }

        workflow.status = WorkflowStatus.RUNNING
        workflow.updated_at = utc_now()

        completed_count = 0
        failed_count = 0

        while workflow.current_step_index < len(workflow.steps):
            step = workflow.steps[workflow.current_step_index]
            tool_def = ToolRegistry.get(step.tool_name)

            if not tool_def:
                step.status = StepStatus.FAILED
                step.error = {"code": "TOOL_NOT_FOUND", "message": f"Tool '{step.tool_name}' not found."}
                failed_count += 1
                break

            # Handle write confirmation requirements
            if tool_def.requires_confirmation:
                expected_hash = generate_confirmation_hash(
                    user_id=current_user.id,
                    tool_name=step.tool_name,
                    arguments=step.arguments
                )

                if not confirmed:
                    step.status = StepStatus.WAITING_CONFIRMATION
                    workflow.status = WorkflowStatus.WAITING_CONFIRMATION
                    workflow.confirmation_hash = expected_hash
                    workflow.expires_at = utc_now() + timedelta(seconds=WORKFLOW_CONFIRMATION_TIMEOUT_SECONDS)
                    workflow.updated_at = utc_now()

                    return {
                        "workflow_id": workflow.workflow_id,
                        "conversation_id": workflow.conversation_id,
                        "status": WorkflowStatus.WAITING_CONFIRMATION.value,
                        "message": f"Step {step.step_index + 1} ({step.tool_name}) requires explicit confirmation.",
                        "pending_action": {
                            "step_index": step.step_index,
                            "tool_name": step.tool_name,
                            "arguments": step.arguments,
                            "confirmation_hash": expected_hash
                        },
                        "steps": [s.model_dump(mode="json") for s in workflow.steps]
                    }

                # If confirmed=True, validate confirmation hash match
                if not workflow.confirmation_hash or workflow.confirmation_hash != expected_hash:
                    raise HRCoreException(
                        status_code=400,
                        code="INVALID_CONFIRMATION_HASH",
                        message="Confirmation hash mismatch or arguments modified. Step execution blocked."
                    )

            # Execute tool through Phase 5 ToolExecutionEngine
            step.status = StepStatus.RUNNING
            res = ToolExecutionEngine.execute(
                db=db,
                current_user=current_user,
                tool_name=step.tool_name,
                arguments=step.arguments,
                confirmed=True
            )

            if res.success and res.status == "success":
                step.status = StepStatus.COMPLETED
                step.result = res.data
                step.updated_at = utc_now()
                completed_count += 1
                workflow.current_step_index += 1
            else:
                step.status = StepStatus.FAILED
                step.error = res.error or {"code": "EXECUTION_FAILED", "message": "Step execution failed."}
                step.updated_at = utc_now()
                failed_count += 1
                break

        # Determine overall workflow status
        if failed_count > 0:
            if completed_count > 0:
                workflow.status = WorkflowStatus.PARTIALLY_COMPLETED
            else:
                workflow.status = WorkflowStatus.FAILED
        else:
            workflow.status = WorkflowStatus.COMPLETED

        workflow.updated_at = utc_now()

        return {
            "workflow_id": workflow.workflow_id,
            "conversation_id": workflow.conversation_id,
            "status": workflow.status.value,
            "message": f"Workflow execution finished with status '{workflow.status.value}'.",
            "steps": [s.model_dump(mode="json") for s in workflow.steps]
        }
