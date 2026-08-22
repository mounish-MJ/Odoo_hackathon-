from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, status, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import hash_password, verify_password, create_access_token, generate_random_token
from app.core.exceptions import HRCoreException, ConflictError, EntityNotFoundError
from app.models.user import User, UserRole
from app.models.employee import Employee
from app.models.verification_token import VerificationToken, TokenType
from app.schemas.auth import SignupRequest, SignupResponse, LoginRequest, TokenResponse, VerifyEmailRequest, VerifyEmailResponse
from app.schemas.user import UserRead
from app.api.deps import get_current_user, get_current_active_verified_user, require_roles


def utc_now():
    return datetime.now(timezone.utc)


router = APIRouter()


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    """Registers a new user account and generates a development email verification token stub."""
    # 1. Check duplicate email
    existing_user = db.query(User).filter(User.email == req.email).first()
    if existing_user:
        raise ConflictError(message="A user account with this email address already exists.")

    # 2. Check employee profile linkage if employee_code provided
    employee: Optional[Employee] = None
    if req.employee_code:
        employee = db.query(Employee).filter(
            (Employee.employee_code == req.employee_code) | (Employee.id == req.employee_code)
        ).first()
        if not employee:
            raise EntityNotFoundError(entity_name="Employee", identifier=req.employee_code)
        
        if employee.user_id or db.query(User).filter(User.employee_id == employee.id).first():
            raise ConflictError(message=f"Employee profile '{req.employee_code}' is already registered to a user account.")

    # 3. Hash password & create user
    hashed_pwd = hash_password(req.password)
    user = User(
        email=req.email,
        password_hash=hashed_pwd,
        role=req.role,
        is_active=True,
        is_verified=False,
        employee_id=employee.id if employee else None
    )
    db.add(user)
    db.flush()

    if employee:
        employee.user_id = user.id

    # 4. Generate email verification token stub
    token_str = generate_random_token()
    verification_token = VerificationToken(
        user_id=user.id,
        token=token_str,
        token_type=TokenType.EMAIL_VERIFICATION,
        expires_at=utc_now() + timedelta(hours=24),
        is_used=False
    )
    db.add(verification_token)

    db.commit()
    db.refresh(user)

    return SignupResponse(
        user=user,
        message="Registration successful. Please verify your email using the provided verification token.",
        verification_token_stub=token_str
    )


@router.post("/verify-email", response_model=VerifyEmailResponse, status_code=status.HTTP_200_OK)
def verify_email(req: VerifyEmailRequest, db: Session = Depends(get_db)):
    """Verifies a user account using a verification token stub."""
    vtoken = db.query(VerificationToken).filter(VerificationToken.token == req.token).first()
    if not vtoken or vtoken.is_used:
        raise HRCoreException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="INVALID_VERIFICATION_TOKEN",
            message="Invalid or previously used verification token."
        )

    expires_at = vtoken.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < utc_now():
        raise HRCoreException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="EXPIRED_VERIFICATION_TOKEN",
            message="Verification token has expired. Please request a new verification token."
        )

    # Mark token used & verify user account
    vtoken.is_used = True
    user = db.query(User).filter(User.id == vtoken.user_id).first()
    if not user:
        raise EntityNotFoundError(entity_name="User", identifier=vtoken.user_id)

    user.is_verified = True
    db.commit()

    return VerifyEmailResponse(
        message="Email address successfully verified.",
        is_verified=True
    )


@router.post("/login", response_model=TokenResponse, status_code=status.HTTP_200_OK)
async def login(
    request: Request,
    db: Session = Depends(get_db)
):
    """Authenticates user credentials and issues a JWT access token."""
    email: Optional[str] = None
    password: Optional[str] = None

    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            body = await request.json()
            email = body.get("email") or body.get("username")
            password = body.get("password")
        except Exception:
            pass
    elif "application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type:
        try:
            form = await request.form()
            email = form.get("username") or form.get("email")
            password = form.get("password")
        except Exception:
            pass

    if not email or not password:
        raise HRCoreException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="BAD_REQUEST",
            message="Email and password credentials are required."
        )

    # 1. Locate user
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.password_hash):
        raise HRCoreException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="INVALID_CREDENTIALS",
            message="Invalid email address or password."
        )

    # 2. Check active & verification status
    if not user.is_active:
        raise HRCoreException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="USER_INACTIVE",
            message="User account has been deactivated."
        )

    if not user.is_verified:
        raise HRCoreException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="UNVERIFIED_ACCOUNT",
            message="Email address has not been verified. Please verify your email before logging in."
        )

    # 3. Generate JWT Access Token
    claims = {
        "user_id": user.id,
        "employee_id": user.employee_id,
        "role": user.role.value
    }
    access_token = create_access_token(subject=user.id, claims=claims)

    # 4. Update last login timestamp
    user.last_login_at = utc_now()
    db.commit()

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user
    )


@router.get("/me", response_model=UserRead, status_code=status.HTTP_200_OK)
def get_current_user_profile(current_user: User = Depends(get_current_active_verified_user)):
    """Returns profile information for the authenticated user."""
    return current_user


# --- Protected RBAC Testing Endpoints ---

@router.get("/employee-only", status_code=status.HTTP_200_OK)
def employee_only_route(current_user: User = Depends(require_roles(UserRole.EMPLOYEE, UserRole.HR, UserRole.ADMIN))):
    """Endpoint accessible by all verified roles."""
    return {"message": "Access granted to employee route", "user_id": current_user.id, "role": current_user.role}


@router.get("/hr-only", status_code=status.HTTP_200_OK)
def hr_only_route(current_user: User = Depends(require_roles(UserRole.HR, UserRole.ADMIN))):
    """Endpoint accessible only by HR and Admin roles."""
    return {"message": "Access granted to HR route", "user_id": current_user.id, "role": current_user.role}


@router.get("/admin-only", status_code=status.HTTP_200_OK)
def admin_only_route(current_user: User = Depends(require_roles(UserRole.ADMIN))):
    """Endpoint accessible exclusively by Admin role."""
    return {"message": "Access granted to Admin route", "user_id": current_user.id, "role": current_user.role}
