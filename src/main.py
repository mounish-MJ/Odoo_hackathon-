import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.config import settings
from src.api.router_copilot import router as copilot_router
from src.api.router_policy import router as policy_router
from src.api.router_decision import router as decision_router
from src.api.router_anomaly import router as anomaly_router
from src.api.router_auth import router as auth_router
from src.api.router_hr import router as hr_router
from src.services.policy_rag import policy_rag_service
from src.schemas.rag import PolicyIngestRequest

# Setup Logging
logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
logger = logging.getLogger("dayflow.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for startup seed policy ingestion."""
    logger.info("Initializing DAYFLOW Member 2 AI Service & Member 3 Frontend...")
    
    # Ingest Seed Policies if present
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    seed_dir = os.path.join(base_dir, "seed_policies")
    
    if os.path.exists(seed_dir):
        for fname in os.listdir(seed_dir):
            if fname.endswith(".md"):
                fpath = os.path.join(seed_dir, fname)
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        content = f.read()
                    
                    cat = "LEAVE" if "leave" in fname.lower() else "ATTENDANCE"
                    policy_rag_service.ingest_policy(PolicyIngestRequest(
                        title=fname.replace("_", " ").replace(".md", ""),
                        category=cat,
                        content=content,
                        version="1.0"
                    ))
                    logger.info(f"Auto-ingested seed policy: {fname}")
                except Exception as e:
                    logger.warning(f"Could not ingest seed policy {fname}: {e}")
                    
    logger.info("DAYFLOW AI Service ready for requests.")
    yield
    logger.info("Shutting down DAYFLOW AI Service.")


app = FastAPI(
    title="DAYFLOW — Intelligent HR Operating System",
    description="Member 2 Microservice & Member 3 Web Frontend UI delivering Policy RAG, HR Copilot, Decision Engine, and HRMS Management.",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(auth_router)
app.include_router(hr_router)
app.include_router(copilot_router)
app.include_router(policy_router)
app.include_router(decision_router)
app.include_router(anomaly_router)


@app.get("/health", status_code=status.HTTP_200_OK, tags=["System"])
@app.get("/api/v1/health", status_code=status.HTTP_200_OK, tags=["System"])
def health_check():
    """Health check endpoint for platform orchestration and load balancers."""
    return {
        "status": "HEALTHY",
        "service": "dayflow-ai-engine",
        "member": "Member 2 — AI Intelligence & Decision Engineer",
        "environment": settings.ENVIRONMENT,
        "llm_model": settings.LLM_MODEL,
        "embedding_model": settings.EMBEDDING_MODEL
    }


# Mount Member 3 Web Frontend static assets and SPA root AFTER API routes
static_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")
