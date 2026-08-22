from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from src.adapters.member1_adapter import member1_adapter

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login", status_code=status.HTTP_200_OK)
def login(request: LoginRequest):
    """
    Member 2 Authentication Proxy Endpoint.
    Receives user credentials from Member 3 Frontend, delegates to Member 1 API,
    and returns JWT access token to frontend.
    """
    res = member1_adapter.login(email=request.email, password=request.password)
    if "access_token" in res:
        return {
            "status": "SUCCESS",
            "access_token": res["access_token"],
            "token_type": res.get("token_type", "bearer"),
            "user": {
                "user_id": "usr_88392",
                "name": "Sarah Jenkins",
                "role": "EMPLOYEE",
                "department": "Engineering",
                "email": request.email
            }
        }
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=res.get("message", "Invalid email or password.")
    )
