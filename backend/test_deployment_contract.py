"""Deployment-contract regression tests.

These guard the two failures that made the deployed site look broken:

1. A `localhost` API address baked into the built bundle. Vite inlines
   `VITE_*` at build time, so a stray `frontend/.env` made every visitor's
   browser call its own machine and the site served no data at all.
2. The built bundle not being mirrored into `backend/frontend/dist`, which is
   the only frontend FastAPI Cloud actually serves.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent.parent
FRONTEND = REPO / "frontend"
DIST = FRONTEND / "dist"
DEPLOY_DIST = REPO / "backend" / "frontend" / "dist"

# A port is required so libraries that legitimately ship a bare
# "http://localhost" as a relative-URL base are not flagged.
LOCAL_API_URL = re.compile(r"(?:https?:)?//(?:localhost|127\.0\.0\.1|\[::1\]):\d+", re.I)
SOURCE_SUFFIXES = {".js", ".css", ".html"}


def _built_assets(root: Path) -> list[Path]:
    if not root.is_dir():
        return []
    return [p for p in root.rglob("*") if p.suffix in SOURCE_SUFFIXES]


@pytest.mark.skipif(not DIST.is_dir(), reason="run `npm run build` in frontend/ first")
def test_built_bundle_has_no_localhost_api_url() -> None:
    offenders = [str(p.relative_to(REPO)) for p in _built_assets(DIST) if LOCAL_API_URL.search(p.read_text("utf-8", "ignore"))]
    assert not offenders, (
        "A localhost API address is baked into the production bundle, so the "
        f"deployed site will request the visitor's own machine: {offenders}. "
        "Check for a VITE_API_URL pointing at localhost in a .env loaded during `vite build`."
    )


@pytest.mark.skipif(not DIST.is_dir(), reason="run `npm run build` in frontend/ first")
def test_no_env_file_can_override_the_api_url_at_build_time() -> None:
    # `.env` is loaded by both `vite dev` and `vite build`; `.env.development`
    # is dev-only. A committed `.env` is therefore a live regression risk.
    assert not (FRONTEND / ".env").exists(), (
        "frontend/.env is loaded by `vite build`. Delete it and use "
        "frontend/.env.development, which only `vite dev` reads."
    )


def test_dev_env_file_defines_no_active_api_url() -> None:
    dev_env = FRONTEND / ".env.development"
    if not dev_env.is_file():
        pytest.skip("no .env.development file")
    active = [
        line
        for line in dev_env.read_text("utf-8").splitlines()
        if line.strip() and not line.strip().startswith("#") and "VITE_API_URL" in line
    ]
    assert not active, (
        "frontend/.env.development must not set an active VITE_API_URL; the "
        "/api proxy in vite.config.js covers local development. Comment it out."
    )


def test_api_client_uses_same_origin_paths() -> None:
    src = (FRONTEND / "src" / "lib" / "api.js").read_text("utf-8")
    assert '"/api/' in src, "api.js should build same-origin /api paths"
    # The production base must not be able to pick up an env-provided origin.
    assert "import.meta.env.DEV" in src, (
        "api.js must gate any configured API base behind import.meta.env.DEV so "
        "production builds always call their own origin"
    )


@pytest.mark.skipif(not DEPLOY_DIST.is_dir(), reason="run `npm run build` in frontend/ first")
def test_deploy_dist_mirrors_frontend_dist() -> None:
    """FastAPI Cloud serves backend/, so the build must be mirrored there."""
    src_names = {p.name for p in _built_assets(DIST / "assets")}
    out_names = {p.name for p in _built_assets(DEPLOY_DIST / "assets")}
    missing = src_names - out_names
    assert not missing, (
        f"backend/frontend/dist is stale, missing {sorted(missing)}. "
        "`npm run build` in frontend/ syncs it via the postbuild script."
    )
