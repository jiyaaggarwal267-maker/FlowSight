"""FLOWSIGHT backend application package (FastAPI + SQLAlchemy)."""

from __future__ import annotations

import sys
from pathlib import Path

# Step 1 modules (detection.py, generate_data.py) live in the backend root;
# make them importable even when uvicorn runs from another CWD.
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from . import database, engine, models, seed  # noqa: E402,F401

__all__ = ["database", "engine", "models", "seed"]