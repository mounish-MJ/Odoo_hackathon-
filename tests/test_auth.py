from datetime import datetime, timedelta, timezone
from app.models.user import User, UserRole
from app.models.employee import Employee, EmploymentStatus
from app.models.verification_token import VerificationToken, TokenType
from app.core.security import create_access_token, hash_password


def test_signup_success(client, db_session):
    # Create unlinked employee
    emp = Employee(
        employee_code="SIGNUP001",
        first_name="Test",
        last_name="Signup",
        email="signup.test@company.com",
        department="QA",
        designation="QA Engineer",
        date_of_joining=datetime.now(timezone.utc).date()
    )
    db_session.add(emp)
    db_session.commit()

    payload = {
        "employee_code": "SIGNUP001",
        "email": "signup.test@company.com",
        "password": "SecurePassword123!",
        "role": "EMPLOYEE"
    }
    response = client.post("/api/v1/auth/signup", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["user"]["email"] == "signup.test@company.com"
    assert data["user"]["is_verified"] is False
    assert data["verification_token_stub"] is not None

    # Verify database state
    user = db_session.query(User).filter_by(email="signup.test@company.com").first()
    assert user is not None
    assert user.employee_id == emp.id


def test_signup_duplicate_email(client, db_session):
    user = User(
        email="existing@company.com",
        password_hash=hash_password("Password123!"),
        role=UserRole.EMPLOYEE,
        is_verified=True
    )
    db_session.add(user)
    db_session.commit()

    payload = {
        "email": "existing@company.com",
        "password": "NewPassword123!",
        "role": "EMPLOYEE"
    }
    response = client.post("/api/v1/auth/signup", json=payload)
    assert response.status_code == 409
    data = response.json()
    assert data["error"]["code"] == "CONFLICT"


def test_email_verification_flow(client, db_session):
    user = User(
        email="verify.me@company.com",
        password_hash=hash_password("Password123!"),
        role=UserRole.EMPLOYEE,
        is_verified=False
    )
    db_session.add(user)
    db_session.flush()

    token_str = "valid_test_token_12345"
    vtoken = VerificationToken(
        user_id=user.id,
        token=token_str,
        token_type=TokenType.EMAIL_VERIFICATION,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=2),
        is_used=False
    )
    db_session.add(vtoken)
    db_session.commit()

    # Attempt verification
    response = client.post("/api/v1/auth/verify-email", json={"token": token_str})
    assert response.status_code == 200
    data = response.json()
    assert data["is_verified"] is True

    # Re-check database state
    db_session.refresh(user)
    assert user.is_verified is True

    # Re-using same token should fail
    response2 = client.post("/api/v1/auth/verify-email", json={"token": token_str})
    assert response2.status_code == 400
    assert response2.json()["error"]["code"] == "INVALID_VERIFICATION_TOKEN"


def test_login_success_and_unverified_rejection(client, db_session):
    # Unverified user
    unverified_pwd = hash_password("Password123!")
    user_unverified = User(
        email="unverified@company.com",
        password_hash=unverified_pwd,
        role=UserRole.EMPLOYEE,
        is_verified=False
    )
    # Verified user
    verified_pwd = hash_password("Password123!")
    user_verified = User(
        email="verified@company.com",
        password_hash=verified_pwd,
        role=UserRole.EMPLOYEE,
        is_verified=True
    )
    db_session.add_all([user_unverified, user_verified])
    db_session.commit()

    # 1. Unverified login attempt -> expect 401 UNVERIFIED_ACCOUNT
    resp_unverified = client.post("/api/v1/auth/login", json={"email": "unverified@company.com", "password": "Password123!"})
    assert resp_unverified.status_code == 401
    assert resp_unverified.json()["error"]["code"] == "UNVERIFIED_ACCOUNT"

    # 2. Verified login attempt -> expect 200 with JWT
    resp_verified = client.post("/api/v1/auth/login", json={"email": "verified@company.com", "password": "Password123!"})
    assert resp_verified.status_code == 200
    data = resp_verified.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "verified@company.com"


def test_login_invalid_credentials(client, db_session):
    user = User(
        email="user@company.com",
        password_hash=hash_password("Password123!"),
        role=UserRole.EMPLOYEE,
        is_verified=True
    )
    db_session.add(user)
    db_session.commit()

    # Nonexistent user
    resp1 = client.post("/api/v1/auth/login", json={"email": "nobody@company.com", "password": "Password123!"})
    assert resp1.status_code == 401
    assert resp1.json()["error"]["code"] == "INVALID_CREDENTIALS"

    # Wrong password
    resp2 = client.post("/api/v1/auth/login", json={"email": "user@company.com", "password": "WrongPassword!"})
    assert resp2.status_code == 401
    assert resp2.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_jwt_validation_and_me_endpoint(client, db_session):
    user = User(
        email="jwt.user@company.com",
        password_hash=hash_password("Password123!"),
        role=UserRole.EMPLOYEE,
        is_verified=True
    )
    db_session.add(user)
    db_session.commit()

    valid_token = create_access_token(subject=user.id, claims={"user_id": user.id, "role": "EMPLOYEE"})
    expired_token = create_access_token(subject=user.id, claims={"user_id": user.id, "role": "EMPLOYEE"}, expires_delta=timedelta(seconds=-10))

    # 1. Valid token request -> 200 OK
    headers = {"Authorization": f"Bearer {valid_token}"}
    resp1 = client.get("/api/v1/auth/me", headers=headers)
    assert resp1.status_code == 200
    assert resp1.json()["email"] == "jwt.user@company.com"

    # 2. Expired token request -> 401
    headers_expired = {"Authorization": f"Bearer {expired_token}"}
    resp2 = client.get("/api/v1/auth/me", headers=headers_expired)
    assert resp2.status_code == 401

    # 3. Missing header -> 401
    resp3 = client.get("/api/v1/auth/me")
    assert resp3.status_code == 401

    # 4. Malformed token header -> 401
    headers_malformed = {"Authorization": "Bearer malformed_junk_token"}
    resp4 = client.get("/api/v1/auth/me", headers=headers_malformed)
    assert resp4.status_code == 401
