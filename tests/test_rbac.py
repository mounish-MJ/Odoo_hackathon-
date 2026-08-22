import pytest
from jose import jwt
from app.core.config import settings
from app.models.user import User, UserRole
from app.core.security import hash_password, create_access_token
from app.api.deps import enforce_self_or_admin
from app.core.exceptions import HRCoreException


def create_test_user_and_token(
    db_session,
    email: str,
    role: UserRole,
    employee_id: str = None,
    is_verified: bool = True,
    is_active: bool = True
) -> tuple[User, str]:
    user = User(
        email=email,
        password_hash=hash_password("Password123!"),
        role=role,
        is_active=is_active,
        is_verified=is_verified,
        employee_id=employee_id
    )
    db_session.add(user)
    db_session.commit()
    token = create_access_token(
        subject=user.id,
        claims={"user_id": user.id, "employee_id": employee_id, "role": role.value}
    )
    return user, token


# --- 1. Unauthenticated Matrix Tests ---
def test_matrix_unauthenticated(client):
    """Unauthenticated access across all 5 dimensions returns 401."""
    assert client.get("/api/v1/auth/employee-only").status_code == 401
    assert client.get("/api/v1/auth/hr-only").status_code == 401
    assert client.get("/api/v1/auth/admin-only").status_code == 401
    assert client.get("/api/v1/auth/me").status_code == 401


# --- 2. Unverified User Matrix Tests ---
def test_matrix_unverified_user(client, db_session):
    """Unverified user access across all protected endpoints returns 401."""
    unverified_user, token = create_test_user_and_token(
        db_session, "unverified.matrix@company.com", UserRole.EMPLOYEE, is_verified=False
    )
    headers = {"Authorization": f"Bearer {token}"}

    assert client.get("/api/v1/auth/employee-only", headers=headers).status_code == 401
    assert client.get("/api/v1/auth/hr-only", headers=headers).status_code == 401
    assert client.get("/api/v1/auth/admin-only", headers=headers).status_code == 401
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401

    # Other employee data access check for unverified user
    with pytest.raises(HRCoreException) as exc_info:
        enforce_self_or_admin(current_user=unverified_user, target_employee_id="OTHER_123")
    assert exc_info.value.status_code == 403


# --- 3. EMPLOYEE Role Matrix Tests ---
def test_matrix_employee_role(client, db_session):
    """Verified EMPLOYEE role matrix verification."""
    emp_user, token = create_test_user_and_token(
        db_session, "employee.matrix@company.com", UserRole.EMPLOYEE, employee_id="EMP_SELF_100"
    )
    headers = {"Authorization": f"Bearer {token}"}

    # Employee Route -> 200
    assert client.get("/api/v1/auth/employee-only", headers=headers).status_code == 200
    # HR Route -> 403
    assert client.get("/api/v1/auth/hr-only", headers=headers).status_code == 403
    # Admin Route -> 403
    assert client.get("/api/v1/auth/admin-only", headers=headers).status_code == 403
    # Own Profile -> 200
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200

    # Own Data -> Allowed (no exception)
    enforce_self_or_admin(current_user=emp_user, target_employee_id="EMP_SELF_100")
    # Other Employee Data -> 403
    with pytest.raises(HRCoreException) as exc_info:
        enforce_self_or_admin(current_user=emp_user, target_employee_id="EMP_OTHER_200")
    assert exc_info.value.status_code == 403


# --- 4. HR Role Matrix Tests ---
def test_matrix_hr_role(client, db_session):
    """Verified HR role matrix verification."""
    hr_user, token = create_test_user_and_token(
        db_session, "hr.matrix@company.com", UserRole.HR, employee_id="HR_SELF_300"
    )
    headers = {"Authorization": f"Bearer {token}"}

    # Employee Route -> 200
    assert client.get("/api/v1/auth/employee-only", headers=headers).status_code == 200
    # HR Route -> 200
    assert client.get("/api/v1/auth/hr-only", headers=headers).status_code == 200
    # Admin Route -> 403
    assert client.get("/api/v1/auth/admin-only", headers=headers).status_code == 403
    # Own Profile -> 200
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200

    # Own Data -> Allowed
    enforce_self_or_admin(current_user=hr_user, target_employee_id="HR_SELF_300")
    # Other Employee Data -> Allowed (HR privilege)
    enforce_self_or_admin(current_user=hr_user, target_employee_id="EMP_OTHER_200")


# --- 5. ADMIN Role Matrix Tests ---
def test_matrix_admin_role(client, db_session):
    """Verified ADMIN role matrix verification."""
    admin_user, token = create_test_user_and_token(
        db_session, "admin.matrix@company.com", UserRole.ADMIN, employee_id="ADMIN_SELF_400"
    )
    headers = {"Authorization": f"Bearer {token}"}

    # Employee Route -> 200
    assert client.get("/api/v1/auth/employee-only", headers=headers).status_code == 200
    # HR Route -> 200
    assert client.get("/api/v1/auth/hr-only", headers=headers).status_code == 200
    # Admin Route -> 200
    assert client.get("/api/v1/auth/admin-only", headers=headers).status_code == 200
    # Own Profile -> 200
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200

    # Own Data -> Allowed
    enforce_self_or_admin(current_user=admin_user, target_employee_id="ADMIN_SELF_400")
    # Other Employee Data -> Allowed (Admin privilege)
    enforce_self_or_admin(current_user=admin_user, target_employee_id="EMP_OTHER_200")


# --- 6. Role Tampering & Token Forgery Verification ---
def test_role_tampering_forged_token_rejection(client, db_session):
    """Verifies that forged JWT tokens (modified signature or fake secret) are rejected with 401."""
    emp_user, _ = create_test_user_and_token(db_session, "tamper@company.com", UserRole.EMPLOYEE)

    # Forged token created with fake secret claiming ADMIN role
    forged_payload = {
        "sub": emp_user.id,
        "user_id": emp_user.id,
        "role": "ADMIN"
    }
    forged_token = jwt.encode(forged_payload, "fake_hacker_secret_key", algorithm="HS256")
    headers = {"Authorization": f"Bearer {forged_token}"}

    # Attempt access to admin endpoint with forged token -> 401
    response = client.get("/api/v1/auth/admin-only", headers=headers)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_TOKEN"


# --- 7. Inactive User Verification ---
def test_inactive_user_access_rejection(client, db_session):
    """Verifies that deactivated (is_active=False) users cannot access protected APIs."""
    inactive_user, token = create_test_user_and_token(
        db_session, "inactive.user@company.com", UserRole.EMPLOYEE, is_active=False
    )
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "USER_INACTIVE"


# --- 8. Wrong Auth Scheme Verification ---
def test_wrong_auth_scheme_rejection(client, db_session):
    """Verifies that non-Bearer auth schemes (e.g. Basic) return 401."""
    _, token = create_test_user_and_token(db_session, "scheme@company.com", UserRole.EMPLOYEE)
    headers = {"Authorization": f"Basic {token}"}

    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 401
