from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.core.request_tracing import RequestTracingMiddleware
from app.core.rate_limit import RateLimitMiddleware
from app.core.exceptions import (
    HRCoreException,
    hr_core_exception_handler,
    http_exception_handler,
    validation_exception_handler,
    generic_exception_handler
)
from app.api.v1.router import api_router

# Setup application logging
setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME} in environment '{settings.ENVIRONMENT}'")
    yield
    logger.info(f"Shutting down {settings.APP_NAME}")


app = FastAPI(
    title=settings.APP_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Custom Middlewares
app.add_middleware(RequestTracingMiddleware)
app.add_middleware(RateLimitMiddleware)

# CORS Configuration
if settings.CORS_ORIGINS:
    origins = [str(origin) for origin in settings.CORS_ORIGINS]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Exception Handlers
app.add_exception_handler(HRCoreException, hr_core_exception_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# API Routers
app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(api_router)  # Root alias routes (e.g. /health)
