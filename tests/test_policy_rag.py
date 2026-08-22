import pytest
from src.schemas.rag import PolicyIngestRequest
from src.services.policy_rag import policy_rag_service, chunk_markdown_text


def test_chunk_markdown_text():
    sample_text = (
        "# Leave Policy\n\nSection 1 content.\n\n"
        "## Sick Leave\n\nEmployees get 12 days of sick leave per calendar year."
    )
    chunks = chunk_markdown_text(sample_text, max_chunk_size=200)
    assert len(chunks) >= 1
    assert any("Sick Leave" in c["content"] or "Sick Leave" in c["section"] for c in chunks)


def test_policy_rag_ingest_and_retrieve():
    req = PolicyIngestRequest(
        title="Test Expense Policy",
        category="GENERAL",
        content="# Travel Expenses\n\nEmployees may claim up to $50 per day for meals during business travel.",
        version="1.0"
    )
    res = policy_rag_service.ingest_policy(req)
    assert res.policy_id.startswith("pol_")
    assert res.chunks_created >= 1

    citations = policy_rag_service.retrieve_relevant_chunks(
        query="meal claim business travel",
        category="GENERAL",
        user_role="EMPLOYEE",
        top_k=2
    )
    assert len(citations) >= 1
    assert citations[0].policy_name == "Test Expense Policy"
    assert "meals" in citations[0].content_snippet.lower()
