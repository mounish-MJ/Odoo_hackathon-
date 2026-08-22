import time
from typing import Dict, List
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request, Response
from fastapi.responses import JSONResponse

# Max requests per window for rate-limited endpoints
RATE_LIMIT_MAX_REQUESTS = 60
RATE_LIMIT_WINDOW_SECONDS = 60
PROTECTED_PATHS = ["/api/v1/auth/login", "/api/v1/ai/chat"]


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self._ip_history: Dict[str, List[float]] = {}

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        if any(path.startswith(p) for p in PROTECTED_PATHS) and request.method == "POST":
            client_ip = request.client.host if request.client else "127.0.0.1"
            now = time.time()

            # Clean old entries
            timestamps = self._ip_history.get(client_ip, [])
            valid_timestamps = [ts for ts in timestamps if now - ts < RATE_LIMIT_WINDOW_SECONDS]

            if len(valid_timestamps) >= RATE_LIMIT_MAX_REQUESTS:
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": {
                            "code": "RATE_LIMIT_EXCEEDED",
                            "message": "Too many requests. Rate limit exceeded (60 req/min)."
                        }
                    }
                )

            valid_timestamps.append(now)
            self._ip_history[client_ip] = valid_timestamps

        return await call_next(request)
