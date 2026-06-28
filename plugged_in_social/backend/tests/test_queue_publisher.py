"""Queue publisher fail-loud + escape-hatch behaviour."""
from __future__ import annotations

import os

import pytest

from app.core.config import get_settings
from app.services import queue_publisher


@pytest.fixture(autouse=True)
def _reset_settings_cache():
    """Clear the lru_cache so per-test env mutations stick."""
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_publish_raises_when_url_missing(monkeypatch):
    """Default behaviour: missing URL must surface as a typed error so
    the API layer can return 503 instead of leaving a queued row stuck."""
    monkeypatch.delenv("QUEUE_PRODUCER_URL", raising=False)
    monkeypatch.delenv("ALLOW_QUEUE_DROP", raising=False)
    get_settings.cache_clear()

    with pytest.raises(queue_publisher.QueueNotConfiguredError):
        await queue_publisher._publish("stevie-ai-content", {"foo": "bar"})


@pytest.mark.asyncio
async def test_publish_no_ops_with_allow_queue_drop(monkeypatch, caplog):
    """Local-dev escape hatch: when ALLOW_QUEUE_DROP=1, publish is a
    warning-logged no-op so a developer with no Worker stack can still
    iterate on API code without 503s on every save."""
    monkeypatch.delenv("QUEUE_PRODUCER_URL", raising=False)
    monkeypatch.setenv("ALLOW_QUEUE_DROP", "1")
    get_settings.cache_clear()

    with caplog.at_level("WARNING"):
        # Should NOT raise.
        await queue_publisher._publish("stevie-ai-content", {"foo": "bar"})

    assert any("dropping message" in rec.getMessage() for rec in caplog.records)
