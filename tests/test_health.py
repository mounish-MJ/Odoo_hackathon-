from unittest.mock import patch


def test_health_endpoint(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "app" in data
    assert "environment" in data


def test_root_health_alias(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


@patch("app.api.v1.endpoints.health.check_database_connection", return_value=True)
def test_database_health_endpoint_success(mock_check, client):
    response = client.get("/api/v1/health/db")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["database"] == "connected"


@patch("app.api.v1.endpoints.health.check_database_connection", return_value=False)
def test_database_health_endpoint_failure(mock_check, client):
    response = client.get("/api/v1/health/db")
    assert response.status_code == 503
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "DATABASE_UNAVAILABLE"


@patch("app.api.v1.endpoints.health.check_database_connection", return_value=True)
def test_readiness_endpoint_success(mock_check, client):
    response = client.get("/api/v1/readiness")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["database"] == "ready"


@patch("app.api.v1.endpoints.health.check_database_connection", return_value=False)
def test_readiness_endpoint_failure(mock_check, client):
    response = client.get("/api/v1/readiness")
    assert response.status_code == 503
    data = response.json()
    assert data["error"]["code"] == "DATABASE_UNAVAILABLE"
