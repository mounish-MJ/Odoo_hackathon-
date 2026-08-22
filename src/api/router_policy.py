from fastapi import APIRouter, HTTPException, Depends, status
from src.schemas.rag import PolicyIngestRequest, PolicyIngestResponse, PolicyQueryRequest, PolicyQueryResponse
from src.services.policy_rag import policy_rag_service
from src.security.auth import get_current_user, AuthenticatedUser

router = APIRouter(prefix="/api/v1/ai/policy", tags=["Policy RAG"])


@router.post("/ingest", response_model=PolicyIngestResponse, status_code=status.HTTP_201_CREATED)
def ingest_policy(
    request: PolicyIngestRequest,
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Ingests an HR Policy document into the RAG vector store.
    Enforces HR_ADMIN or MANAGER role authorization.
    """
    if current_user.role not in ["HR_ADMIN", "MANAGER", "SYSTEM_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role '{current_user.role}' is not authorized to ingest policy documents."
        )
    try:
        response = policy_rag_service.ingest_policy(request)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Policy ingestion error: {str(e)}")


@router.post("/query", response_model=PolicyQueryResponse, status_code=status.HTTP_200_OK)
def query_policy(
    request: PolicyQueryRequest,
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Vector RAG search endpoint against HR Policy documents with evidence citations.
    """
    try:
        citations = policy_rag_service.retrieve_relevant_chunks(
            query=request.query,
            category=request.category,
            user_role=current_user.role,
            top_k=request.top_k
        )
        
        if citations:
            answer = f"Found {len(citations)} policy section(s) relevant to your query:\n\n"
            answer += "\n\n".join([f"### {c.policy_name} - {c.section}\n{c.content_snippet}" for c in citations])
        else:
            answer = "I couldn't find sufficient policy evidence to answer confidently."

        return PolicyQueryResponse(
            query=request.query,
            answer=answer,
            citations=citations,
            retrieved_chunks_count=len(citations)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Policy query error: {str(e)}")
