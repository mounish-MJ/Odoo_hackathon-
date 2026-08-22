import re
import uuid
import math
import logging
from typing import List, Dict, Any, Optional
from src.config import settings
from src.schemas.rag import PolicyIngestRequest, PolicyIngestResponse, Citation

logger = logging.getLogger("dayflow.policy_rag")

# In-memory storage for test/demo fallback
_in_memory_policies: Dict[str, Dict[str, Any]] = {}
_in_memory_chunks: List[Dict[str, Any]] = []


def chunk_markdown_text(text: str, max_chunk_size: int = 500, overlap: int = 100) -> List[Dict[str, str]]:
    """Chunks Markdown text recursively by section headers (#, ##, ###) and paragraph boundaries."""
    sections = re.split(r'(?=\n#{1,3}\s)', text)
    chunks = []
    
    current_section = "General Information"
    for sec in sections:
        sec = sec.strip()
        if not sec:
            continue
        
        lines = sec.split('\n')
        if lines[0].startswith('#'):
            current_section = lines[0].lstrip('#').strip()
        
        if len(sec) <= max_chunk_size:
            chunks.append({"section": current_section, "content": sec})
        else:
            paragraphs = sec.split('\n\n')
            buffer = ""
            for p in paragraphs:
                if len(buffer) + len(p) <= max_chunk_size:
                    buffer += "\n\n" + p if buffer else p
                else:
                    if buffer:
                        chunks.append({"section": current_section, "content": buffer.strip()})
                    buffer = p
            if buffer:
                chunks.append({"section": current_section, "content": buffer.strip()})
                
    return chunks if chunks else [{"section": "General", "content": text}]


def generate_embedding(text: str) -> List[float]:
    """Generates 1536-dimensional vector embedding using OpenAI API if available, else deterministic vector."""
    if settings.OPENAI_API_KEY and settings.OPENAI_API_KEY.startswith("sk-"):
        try:
            from openai import OpenAI
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            resp = client.embeddings.create(
                input=text,
                model=settings.EMBEDDING_MODEL
            )
            return resp.data[0].embedding
        except Exception as e:
            logger.warning(f"OpenAI embedding call failed ({e}). Falling back to deterministic vector.")

    vec = [0.0] * settings.EMBEDDING_DIMENSION
    words = re.findall(r'\w+', text.lower())
    for w in words:
        idx = abs(hash(w)) % settings.EMBEDDING_DIMENSION
        vec[idx] += 1.0
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Computes cosine similarity between two 1536-dimensional vectors."""
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1)) or 1.0
    norm2 = math.sqrt(sum(b * b for b in v2)) or 1.0
    return dot / (norm1 * norm2)


class PolicyRAGService:
    """
    Policy RAG Service delivering Vector Similarity Search with Metadata Filtering.
    Supports idempotent ingestion to prevent duplicate chunking on startup.
    """
    def __init__(self):
        pass

    def ingest_policy(self, request: PolicyIngestRequest) -> PolicyIngestResponse:
        # Idempotency Check: Prevent duplicate policy ingestion
        policy_key = f"{request.title.strip().lower()}_v{request.version}"
        
        for p_id, p_data in _in_memory_policies.items():
            existing_key = f"{p_data['title'].strip().lower()}_v{p_data['version']}"
            if existing_key == policy_key:
                logger.info(f"Policy '{request.title}' v{request.version} already ingested ({p_id}). Skipping re-ingestion.")
                existing_chunks = sum(1 for c in _in_memory_chunks if c["policy_id"] == p_id)
                return PolicyIngestResponse(
                    policy_id=p_id,
                    title=request.title,
                    category=request.category,
                    version=request.version,
                    chunks_created=existing_chunks,
                    status="SKIPPED_ALREADY_EXISTS"
                )

        policy_id = f"pol_{uuid.uuid4().hex[:8]}"
        _in_memory_policies[policy_id] = {
            "policy_id": policy_id,
            "title": request.title,
            "category": request.category,
            "content": request.content,
            "version": request.version,
            "effective_date": request.effective_date,
            "access_roles": request.access_roles
        }

        raw_chunks = chunk_markdown_text(request.content)
        created_count = 0
        for idx, chunk in enumerate(raw_chunks):
            embedding = generate_embedding(chunk["content"])
            _in_memory_chunks.append({
                "chunk_id": f"chk_{uuid.uuid4().hex[:8]}",
                "policy_id": policy_id,
                "policy_title": request.title,
                "category": request.category,
                "version": request.version,
                "effective_date": request.effective_date,
                "section": chunk["section"],
                "content": chunk["content"],
                "access_roles": request.access_roles,
                "embedding": embedding
            })
            created_count += 1

        logger.info(f"Ingested policy '{request.title}' v{request.version} ({policy_id}) with {created_count} chunks.")
        return PolicyIngestResponse(
            policy_id=policy_id,
            title=request.title,
            category=request.category,
            version=request.version,
            chunks_created=created_count,
            status="SUCCESS"
        )

    def retrieve_relevant_chunks(
        self, query: str, category: Optional[str] = None, user_role: str = "EMPLOYEE", top_k: int = 3
    ) -> List[Citation]:
        """
        Retrieves relevant policy chunks via Vector Similarity Search + Metadata Filtering.
        If highest similarity score is below threshold, returns empty list (No-evidence fallback).
        """
        query_vec = generate_embedding(query)
        scored_citations = []

        for chk in _in_memory_chunks:
            # Metadata Role Check
            if user_role not in chk["access_roles"] and "EMPLOYEE" not in chk["access_roles"]:
                continue
            
            # Metadata Category Check
            if category and chk["category"].upper() != category.upper():
                continue
            
            score = cosine_similarity(query_vec, chk["embedding"])
            
            # Keyword score boost
            query_words = set(re.findall(r'\w+', query.lower()))
            content_words = set(re.findall(r'\w+', chk["content"].lower()))
            common_count = len(query_words.intersection(content_words))
            boosted_score = min(1.0, score + (common_count * 0.10))

            # Apply similarity threshold filter
            if boosted_score >= settings.RAG_SIMILARITY_THRESHOLD:
                scored_citations.append((boosted_score, Citation(
                    policy_name=chk["policy_title"],
                    section=chk["section"],
                    content_snippet=chk["content"][:300] + ("..." if len(chk["content"]) > 300 else ""),
                    similarity_score=round(boosted_score, 3)
                )))

        scored_citations.sort(key=lambda x: x[0], reverse=True)
        return [c[1] for c in scored_citations[:top_k]]


policy_rag_service = PolicyRAGService()
