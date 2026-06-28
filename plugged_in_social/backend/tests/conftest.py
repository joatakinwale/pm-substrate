"""Pytest fixtures.

Targeted unit tests only — these exercise modules in isolation without a
real DB or Supabase context. Use ``pytest -q backend/tests`` from the
repo root to run.
"""
from __future__ import annotations

import os
import sys
import types
from pathlib import Path

# Make ``app`` importable when pytest is invoked from the repo root.
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Stub the bare minimum env so ``app.core.config.get_settings`` doesn't
# refuse to instantiate. Real values aren't needed — the tests don't hit
# the network.
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test"
)
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret")
os.environ.setdefault("WEBHOOK_SECRET", "test-webhook-secret")
os.environ.setdefault("SECRET_KEY", "test-key")


# Some test environments ship a broken ``cryptography`` Rust binding
# which panics during import — that's a system-level issue unrelated to
# Stevie code, but it crashes the whole pytest run when ``app.api``
# imports transitively pull in ``jose``. Pre-populate ``sys.modules``
# with stubs so the real (broken) ones are never loaded.
def _stub_jose() -> None:
    jose = types.ModuleType("jose")
    JWTError = type("JWTError", (Exception,), {})
    JWTClaimsError = type("JWTClaimsError", (Exception,), {})
    ExpiredSignatureError = type("ExpiredSignatureError", (Exception,), {})

    jwt_mod = types.SimpleNamespace(
        decode=lambda *a, **kw: {},
        encode=lambda *a, **kw: "",
        get_unverified_claims=lambda *a, **kw: {},
        get_unverified_header=lambda *a, **kw: {},
    )
    jose.JWTError = JWTError  # type: ignore[attr-defined]
    jose.jwt = jwt_mod  # type: ignore[attr-defined]
    sys.modules["jose"] = jose
    # The actual ``from jose import jwt`` import path goes through this.
    sys.modules["jose.jwt"] = jwt_mod  # type: ignore[assignment]

    exceptions = types.ModuleType("jose.exceptions")
    exceptions.JWTError = JWTError  # type: ignore[attr-defined]
    exceptions.JWTClaimsError = JWTClaimsError  # type: ignore[attr-defined]
    exceptions.ExpiredSignatureError = ExpiredSignatureError  # type: ignore[attr-defined]
    sys.modules["jose.exceptions"] = exceptions


_stub_jose()
