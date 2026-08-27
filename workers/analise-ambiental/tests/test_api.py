from __future__ import annotations

import pytest

pytest.importorskip("fastapi")

from fastapi.testclient import TestClient

from main import app


def test_health():
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_process_requires_secret():
    response = TestClient(app).post("/jobs/job-1/process")
    assert response.status_code in {401, 503}
