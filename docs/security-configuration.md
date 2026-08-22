# Security & Configuration Specification — Member 1 HR Core Platform

This document specifies the security policies, configuration management rules, secret handling guidelines, and environment variable requirements for the **Member 1 HR Core Platform**.

---

## 1. Environment Variable Reference

All configuration settings are managed via environment variables and loaded into FastAPI using Pydantic `BaseSettings` (`app/core/config.py`).

| Variable | Type | Default Value | Description |
|---|---|---|---|
| `APP_NAME` | String | `HR Core Platform` | Application display name |
| `ENVIRONMENT` | String | `development` | Deployment environment (`development`, `staging`, `production`) |
| `DEBUG` | Boolean | `True` (dev) / `False` (prod) | FastAPI debug mode flag |
| `API_V1_STR` | String | `/api/v1` | API route prefix |
| `DATABASE_URL` | String | `sqlite:///./dev_hr_core.db` | Database connection string |
| `JWT_SECRET_KEY` | String | Min 32 bytes string | HS256 secret key for signing JWT tokens |
| `JWT_ALGORITHM` | String | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Integer | `60` | JWT token validity duration in minutes |
| `LLM_PROVIDER` | String | `mock` | LLM provider: `mock`, `openai`, `anthropic`, `groq`, `ollama` |
| `LLM_MODEL` | String | `mock-hr-agent` | LLM model identifier |
| `LLM_API_KEY` | String | `""` | Provider API key (secret) |
| `CORS_ORIGINS` | List[String] | `["http://localhost:3000", ...]` | Allowed CORS origin URLs |

---

## 2. Secret Protection Policies

1. **Zero Secret Commit**: Real API keys, database passwords, private keys, and JWT signing secrets must **NEVER** be committed to the Git repository.
2. **Local Development**: Copy `.env.example` to `.env` for local configuration. The `.env` file is excluded from Git tracking in `.gitignore`.
3. **Production Deployment**: Secrets must be injected via secure container environment variables or secrets management systems (e.g. Docker Secrets, AWS Secrets Manager, Kubernetes Secrets).
4. **Development Fixture Isolation**: Development credentials (e.g., test employee `charlie.dev@company.com` / `DevPassword123!`) are strictly development fixtures and must never be used in production environments.

---

## 3. Production Security Checklist

- Set `ENVIRONMENT=production` and `DEBUG=False`.
- Change `JWT_SECRET_KEY` to a strong, randomly generated 64-character secret.
- Update `DATABASE_URL` to point to a secured PostgreSQL instance with SSL enabled (`sslmode=require`).
- Restrict `CORS_ORIGINS` to specific trusted domain URLs.
