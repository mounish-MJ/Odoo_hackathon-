from typing import Dict, Any
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.ai.workflows.workflow_state import WorkflowManager
from app.ai.workflows.workflow_engine import WorkflowOrchestrator
from app.api.deps import get_current_active_verified_user

router = APIRouter()


@router.get("/workflows/{workflow_id}", status_code=status.HTTP_200_OK)
def get_workflow_status(
    workflow_id: str,
    current_user: User = Depends(get_current_active_verified_user)
):
    """Retrieves current state and step execution logs for a workflow session."""
    workflow = WorkflowManager.get_workflow(workflow_id=workflow_id, user_id=current_user.id)
    return workflow.model_dump(mode="json")


@router.post("/workflows/{workflow_id}/confirm", status_code=status.HTTP_200_OK)
def confirm_workflow_step(
    workflow_id: str,
    current_user: User = Depends(get_current_active_verified_user),
    db: Session = Depends(get_db)
):
    """Confirms and executes the pending write step of a workflow. Validates confirmation hash and timeout expiration."""
    return WorkflowOrchestrator.execute_workflow(
        db=db,
        current_user=current_user,
        workflow_id=workflow_id,
        confirmed=True
    )


@router.post("/workflows/{workflow_id}/cancel", status_code=status.HTTP_200_OK)
def cancel_workflow_session(
    workflow_id: str,
    current_user: User = Depends(get_current_active_verified_user)
):
    """Cancels a pending workflow session and marks remaining steps as CANCELLED."""
    workflow = WorkflowManager.cancel_workflow(workflow_id=workflow_id, user_id=current_user.id)
    return workflow.model_dump(mode="json")
