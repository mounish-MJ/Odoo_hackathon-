import uuid
import time
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request, Response
from app.core.logging import logger


class RequestTracingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        # Resolve or generate X-Request-ID
        request_id = request.headers.get("X-Request-ID")
        if not request_id:
            request_id = str(uuid.uuid4())
        
        request.state.request_id = request_id
        start_time = time.time()

        actor_id = request.headers.get("X-Actor-ID", "UNKNOWN")
        actor_type = request.headers.get("X-Actor-Type", "UNKNOWN")

        response = await call_next(request)

        process_time_ms = round((time.time() - start_time) * 1000, 2)

        # Log request summary safely without exposing secrets
        logger.info(
            f"[{request_id}] {request.method} {request.url.path} -> {response.status_code} ({process_time_ms}ms) | Actor: {actor_id} ({actor_type})"
        )

        # Response headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"

        return response
