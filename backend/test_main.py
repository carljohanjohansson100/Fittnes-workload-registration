from fastapi.testclient import TestClient

from backend import main

client = TestClient(main.app)
BODY = {"type": "löpning", "minutes": 30, "weight_kg": 80, "end_hr": 150}


def test_ok(monkeypatch):
    monkeypatch.setattr(main, "estimate", lambda r: {"kcal": 380, "met": 9.5, "rationale": "Löpning."})
    r = client.post("/api/calories", json=BODY)
    assert r.status_code == 200 and r.json()["kcal"] == 380


def test_implausible_rejected(monkeypatch):
    monkeypatch.setattr(main, "estimate", lambda r: {"kcal": 5000, "met": 9.5, "rationale": "x"})
    assert client.post("/api/calories", json=BODY).status_code == 502


def test_upstream_error(monkeypatch):
    def boom(r): raise RuntimeError("x")
    monkeypatch.setattr(main, "estimate", boom)
    assert client.post("/api/calories", json=BODY).status_code == 502


def test_validation():
    assert client.post("/api/calories", json={**BODY, "type": "yoga"}).status_code == 422
    assert client.post("/api/calories", json={**BODY, "weight_kg": 5}).status_code == 422


def test_token_required(monkeypatch):
    monkeypatch.setattr(main, "API_TOKEN", "hemlig")
    monkeypatch.setattr(main, "estimate", lambda r: {"kcal": 380, "met": 9.5, "rationale": "x"})
    assert client.post("/api/calories", json=BODY).status_code == 401
    assert client.post("/api/calories", json=BODY, headers={"X-API-Token": "fel"}).status_code == 401
    assert client.post("/api/calories", json=BODY, headers={"X-API-Token": "hemlig"}).status_code == 200
