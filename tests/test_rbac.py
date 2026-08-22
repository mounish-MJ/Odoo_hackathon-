import pytest
from app.models.user import User, UserRole
from app.core.security import hash_password, create_access_token
from app.api.deps import enforce_self_or_admin
from app.core.exceptions import HRCoreException


def create_test_user_and_token(db_session, email: str, role: UserRole, employee_id: str = None) -> tuple[User, str]:
    user = User(
        email=email,
        password_hash=hash_password("Password123!"),
        role=role,
        is_active=True,
        is_verified=True,
        employee_id=employee_id
    )
    db_session.add(user)
    db_session.commit()
    token = create_access_token(subject=user.id, claims={"user_id": user.id, "employee_id": employee_id, "role": role.value})
    return user, token


def test_rbac_matrix_unauthenticated(client):
    """Unauthenticated requests to protected endpoints must return 401."""
    assert client.get("/api/v1/auth/employee-only").status_code == 401
    assert client.get("/api/v1/auth/hr-only").status_code == 401
    assert client.get("/api/v1/auth/admin-only").status_code == 401


def test_rbac_matrix_employee_role(client, db_session):
    """Employee role permissions: allowed on employee route, denied (403) on HR/Admin routes."""
    _, token = create_test_user_and_token(db_session, "emp.rbac@company.com", UserRole.EMPLOYEE)
    headers = {"Authorization": f"Bearer {token}"}

    assert client.get("/api/v1/auth/employee-only", headers=headers).status_code == 200
    
    resp_hr = client.get("/api/v1/auth/hr-only", headers=headers)
    assert resp_hr.status_code == 403
    assert resp_hr.json()["error"]["code"] == "FORBIDDEN"

    resp_admin = client.get("/api/v1/auth/admin-only", headers=headers)
    assert resp_admin.status_code == 403
    assert resp_admin.json()["error"]["code"] == "FORBIDDEN"


def test_rbac_matrix_hr_role(client, db_session):
    """HR role permissions: allowed on Employee & HR routes, denied (403) on Admin route."""
    _, token = create_test_user_and_token(db_session, "hr.rbac@company.com", UserRole.HR)
    headers = {"Authorization": f"Bearer {token}"}

    assert client.get("/api/v1/auth/employee-only", headers=headers).status_code == 200
    assert client.get("/api/v1/auth/hr-only", headers=headers).status_code == 200

    resp_admin = client.get("/api/v1/auth/admin-only", headers=headers)
    assert resp_admin.status_code == 403
    assert resp_admin.json()["error"]["code"] == "FORBIDDEN"


def test_rbac_matrix_admin_role(client, db_session):
    """Admin role permissions: allowed on all routes."""
    _, token = create_test_user_and_token(db_session, "admin.rbac@company.com", UserRole.ADMIN)
    headers = {"Authorization": f"Bearer {token}"}

    assert client.get("/api/v1/auth/employee-only", headers=headers).status_code == 200
    assert client.get("/api/v1/auth/hr-only", headers=headers).status_code == 200
    assert client.get("/api/v1/auth/admin-only", headers=headers).status_code == 200


def test_self_vs_admin_authorization_enforcement(db_session):
    """Verifies that employees can access own resource, but denied from other employee resources."""
    emp_user, _ = create_test_user_and_token(db_session, "emp.self@company.com", UserRole.EMPLOYEE, employee_id="EMP_OWN_123")
    admin_user, _ = create_test_user_and_token(db_session, "admin.self@company.com", UserRole.ADMIN, employee_id="EMP_ADMIN_999")

    # 1. Employee accessing own profile -> allowed (no exception)
    enforce_self_or_admin(current_user=emp_user, target_employee_id="EMP_OWN_123")

    # 2. Employee accessing another employee's profile -> raises 403
    with pytest.raises(HRCoreException) as exc_info:
        enforce_self_or_admin(current_user=emp_user, target_employee_id="OTHER_EMP_456")
    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "FORBIDDEN"

    # 3. Admin accessing another employee's profile -> allowed
    enforce_self_or_admin(current_user=admin_user, target_employee_id="OTHER_EMP_456")
