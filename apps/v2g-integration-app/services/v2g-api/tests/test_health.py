from fastapi.testclient import TestClient

from v2g.app import app


def test_healthz():
    assert TestClient(app).get("/healthz").json() == {"status": "ok"}
