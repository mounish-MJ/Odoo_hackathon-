# Phase 11 Observability & Request Tracing Specification

This document details the **observability, structured logging, and request correlation system** in the **Member 1 HR Core Platform**.

---

## 1. Request ID Correlation & Propagation

1. **Header Inspection**: `RequestTracingMiddleware` inspects incoming HTTP requests for `X-Request-ID`.
2. **UUID Auto-Generation**: If absent, a unique UUID (`uuid.uuid4()`) is generated.
3. **Request State Binding**: Accessible via `request.state.request_id` throughout the call stack.
4. **Response Header Injection**: Injected automatically into response headers:
   ```text
   X-Request-ID: e14c44e9-1234-4b45-8495-23423456789a
   ```

---

## 2. Structured JSON Logging Format

Log entries are output as structured logs formatted for production log aggregators (e.g. Datadog, CloudWatch, ELK):

```json
{
  "timestamp": "2026-08-22T14:20:27.192Z",
  "level": "INFO",
  "logger": "hr_core",
  "request_id": "15e6b85c-2103-4713-9e95-f34dc6bb5cab",
  "method": "POST",
  "path": "/api/v1/auth/login",
  "status_code": 200,
  "latency_ms": 6.0,
  "actor_id": "DAYFLOW_MEMBER_2",
  "actor_type": "AI"
}
```

---

## 3. Secret Masking & Sensitive Data Protection

The following sensitive data items are **STRICTLY EXCLUDED** from logs:
- User passwords
- JWT secret keys & token payloads
- Database connection strings & passwords
- API keys & LLM credentials
