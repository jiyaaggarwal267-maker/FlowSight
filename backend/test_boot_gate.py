"""Boot-gate behaviour.

The seed runs in a background thread, so requests can arrive before the database
exists. Two properties matter and both regressed before:

* a slow boot must answer 503 with Retry-After, not hang until the edge proxy
  gives up, and
* it must be a real 503, not an opaque 500. The gate lives in a
  BaseHTTPMiddleware, which sits outside Starlette's ExceptionMiddleware, so
  raising HTTPException there escapes uncaught.
"""
from __future__ import annotations

import asyncio
import threading

import pytest
from starlette.testclient import TestClient

from app import main


@pytest.fixture
def gated_client(monkeypatch):
    """A client whose boot never completes, so the gate must respond."""
    monkeypatch.setattr(main, "_READY", threading.Event(), raising=False)
    monkeypatch.setattr(main, "_BOOT_ERROR", None, raising=False)
    monkeypatch.setattr(main, "BOOT_WAIT_TIMEOUT_S", 0.05, raising=False)
    with TestClient(main.app, raise_server_exceptions=False) as client:
        yield client


def test_slow_boot_returns_retryable_503_not_500(gated_client):
    res = gated_client.get("/api/overview")
    assert res.status_code == 503, f"expected 503, got {res.status_code}: {res.text}"
    assert res.headers.get("retry-after"), "client needs Retry-After to know when to retry"
    assert "seed" in res.json()["detail"].lower()


def test_health_is_never_gated(gated_client):
    """Uptime probes must answer immediately instead of queueing behind the seed."""
    res = gated_client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] in {"starting", "ok", "degraded"}


def test_static_shell_is_never_gated(gated_client):
    res = gated_client.get("/")
    assert res.status_code == 200, "the HTML shell must load while the database boots"


def test_successful_boot_passes_requests_through(monkeypatch):
    monkeypatch.setattr(main, "_READY", threading.Event(), raising=False)
    monkeypatch.setattr(main, "_BOOT_ERROR", None, raising=False)
    main._READY.set()
    with TestClient(main.app, raise_server_exceptions=False) as client:
        # The seeded dev database is present, so the route answers normally.
        assert client.get("/api/overview").status_code == 200


def test_boot_failure_returns_503(monkeypatch):
    monkeypatch.setattr(main, "_READY", threading.Event(), raising=False)
    monkeypatch.setattr(main, "_BOOT_ERROR", RuntimeError("seed exploded"), raising=False)
    main._READY.set()
    with TestClient(main.app, raise_server_exceptions=False) as client:
        res = client.get("/api/overview")
        assert res.status_code == 503
        assert res.headers.get("retry-after")


def test_boot_wait_is_bounded(monkeypatch):
    """The wait must be capped; an unbounded wait is what produced gateway errors."""
    monkeypatch.setattr(main, "BOOT_WAIT_TIMEOUT_S", 0.05, raising=False)
    main._READY = threading.Event()
    main._BOOT_ERROR = None

    async def run():
        res = await main._await_boot()
        return res

    res = asyncio.run(run())
    assert res is not None and res.status_code == 503
    main._READY.set()
