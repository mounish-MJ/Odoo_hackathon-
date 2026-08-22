from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from src.adapters.member1_adapter import member1_adapter

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    email: str
    password: str


class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    department: str = "Engineering"
    role: str = "EMPLOYEE"


# In-memory store for dynamically registered demo users when standalone
REGISTERED_USERS = {}


def resolve_user_info(email: str) -> dict:
    email_clean = email.strip().lower()
    
    if email_clean in REGISTERED_USERS:
        return REGISTERED_USERS[email_clean]
    elif "admin" in email_clean:
        return {
            "user_id": "usr_admin",
            "name": "Alice Admin",
            "role": "ADMIN",
            "department": "Executive",
            "email": email
        }
    elif "hr" in email_clean or "bob" in email_clean:
        return {
            "user_id": "usr_hr_bob",
            "name": "Bob Manager",
            "role": "HR",
            "department": "Human Resources",
            "email": email
        }
    elif "charlie" in email_clean:
        return {
            "user_id": "usr_charlie",
            "name": "Charlie Dev",
            "role": "EMPLOYEE",
            "department": "Engineering",
            "email": email
        }
    else:
        return {
            "user_id": "usr_88392",
            "name": "Sarah Jenkins",
            "role": "EMPLOYEE",
            "department": "Engineering",
            "email": email
        }


@router.post("/login", status_code=status.HTTP_200_OK)
def login(request: LoginRequest):
    """
    Member 2 Authentication Proxy Endpoint.
    Receives user credentials from Member 3 Frontend, delegates to Member 1 API,
    and returns JWT access token to frontend.
    """
    res = member1_adapter.login(email=request.email, password=request.password)
    user_info = resolve_user_info(request.email)
    
    if "access_token" in res:
        # Encode user_id in token prefix if mock
        token = res["access_token"]
        if token.startswith("mock_jwt"):
            token = f"mock_jwt_{user_info['user_id']}_{user_info['role']}"
            
        return {
            "status": "SUCCESS",
            "access_token": token,
            "token_type": res.get("token_type", "bearer"),
            "user": user_info
        }
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=res.get("message", "Invalid email or password.")
    )


@router.post("/signup", status_code=status.HTTP_201_CREATED)
@router.post("/register", status_code=status.HTTP_201_CREATED)
def signup(request: SignupRequest):
    """
    Registers a new employee user account into DAYFLOW system.
    """
    email_clean = request.email.strip().lower()
    user_info = {
        "user_id": f"usr_{email_clean.split('@')[0]}",
        "name": request.name,
        "role": request.role.upper(),
        "department": request.department,
        "email": request.email
    }
    REGISTERED_USERS[email_clean] = user_info
    
    return {
        "status": "SUCCESS",
        "message": f"Account successfully created for {request.name}. You may now sign in.",
        "user": user_info
    }

