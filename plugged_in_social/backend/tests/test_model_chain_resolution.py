"""Layer 1 — task-based model chain resolution.

Resolution priority (verified by these tests):
1. Explicit model on the row.
2. Per-org override at ``Organization.settings.ai.models.<type>``.
3. Env var ``AI_MODEL_<TYPE>`` (comma-separated).
4. Built-in chain table.
5. ``ai_default_model`` env / hardcoded fallback.
"""
from __future__ import annotations

import pytest

from app.api.internal import ai as ai_internal
from app.core.config import get_settings


@pytest.fixture(autouse=True)
def _reset_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_explicit_model_wins(monkeypatch):
    """When the row has an explicit model, ignore everything else."""
    monkeypatch.setenv("AI_MODEL_CAPTION", "@cf/meta/llama-3.1-8b-instruct")
    get_settings.cache_clear()

    chain = ai_internal._resolved_model_chain(
        content_type="caption",
        org_settings={"ai": {"models": {"caption": "claude-haiku-4-5"}}},
        explicit_model="claude-sonnet-4-6",
    )
    assert chain == ["claude-sonnet-4-6"]


def test_explicit_auto_falls_through(monkeypatch):
    """``"auto"`` is the frontend's "let backend pick" sentinel and
    should NOT be treated as an explicit model id."""
    monkeypatch.delenv("AI_MODEL_CAPTION", raising=False)
    get_settings.cache_clear()

    chain = ai_internal._resolved_model_chain(
        content_type="caption",
        org_settings=None,
        explicit_model="auto",
    )
    # Falls through to built-in caption chain.
    assert chain[0] == "@cf/meta/llama-3.1-8b-instruct"


def test_per_org_string_override_wins_over_env(monkeypatch):
    """A per-org single-model string overrides the env chain."""
    monkeypatch.setenv("AI_MODEL_BLOG_POST", "claude-sonnet-4-6,gpt-4o")
    get_settings.cache_clear()

    chain = ai_internal._resolved_model_chain(
        content_type="blog_post",
        org_settings={"ai": {"models": {"blog_post": "claude-opus-4-7"}}},
        explicit_model=None,
    )
    assert chain == ["claude-opus-4-7"]


def test_per_org_list_override_wins_over_env(monkeypatch):
    """A per-org list of models becomes the chain (first = primary)."""
    monkeypatch.setenv("AI_MODEL_BLOG_POST", "claude-sonnet-4-6")
    get_settings.cache_clear()

    chain = ai_internal._resolved_model_chain(
        content_type="blog_post",
        org_settings={
            "ai": {
                "models": {
                    "blog_post": ["claude-opus-4-7", "claude-sonnet-4-6"]
                }
            }
        },
        explicit_model=None,
    )
    assert chain == ["claude-opus-4-7", "claude-sonnet-4-6"]


def test_env_chain_overrides_builtin(monkeypatch):
    """``AI_MODEL_CAPTION=...`` replaces the built-in caption chain."""
    monkeypatch.setenv(
        "AI_MODEL_CAPTION", "gpt-4o-mini, @cf/meta/llama-3.1-8b-instruct"
    )
    get_settings.cache_clear()

    chain = ai_internal._resolved_model_chain(
        content_type="caption",
        org_settings=None,
        explicit_model=None,
    )
    assert chain == ["gpt-4o-mini", "@cf/meta/llama-3.1-8b-instruct"]


def test_builtin_chains_pick_cheap_for_short_tasks(monkeypatch):
    """Captions and hashtags should default to the cheap on-platform model."""
    monkeypatch.delenv("AI_MODEL_CAPTION", raising=False)
    monkeypatch.delenv("AI_MODEL_HASHTAGS", raising=False)
    get_settings.cache_clear()

    caption = ai_internal._resolved_model_chain("caption", None, None)
    hashtags = ai_internal._resolved_model_chain("hashtags", None, None)

    assert caption[0] == "@cf/meta/llama-3.1-8b-instruct"
    assert hashtags[0] == "@cf/meta/llama-3.1-8b-instruct"
    # Both have a fallback so quota exhaustion doesn't break the user.
    assert len(caption) >= 2
    assert len(hashtags) >= 2


def test_builtin_chains_pick_quality_for_long_tasks(monkeypatch):
    """Blog posts, email copy, and scripts default away from Anthropic/OpenAI."""
    for v in ("AI_MODEL_BLOG_POST", "AI_MODEL_EMAIL_COPY", "AI_MODEL_SCRIPT"):
        monkeypatch.delenv(v, raising=False)
    get_settings.cache_clear()

    for ct in ("blog_post", "email_copy", "script"):
        chain = ai_internal._resolved_model_chain(ct, None, None)
        assert chain[0] == "@cf/meta/llama-3.3-70b-instruct-fp8-fast", (
            f"Expected Workers AI for {ct}, got {chain[0]}"
        )
        assert "gpt-4o" not in chain
        assert "gpt-4o-mini" not in chain


def test_unknown_content_type_falls_through_to_default(monkeypatch):
    """Unknown content_type — no built-in, no env — uses ai_default_model."""
    monkeypatch.delenv("AI_MODEL_CUSTOM_FOO", raising=False)
    monkeypatch.setenv("AI_DEFAULT_MODEL", "claude-haiku-4-5")
    get_settings.cache_clear()

    chain = ai_internal._resolved_model_chain("custom_foo", None, None)
    assert chain == ["claude-haiku-4-5"]


def test_provider_status_warns_about_billing_dependent_fallbacks(monkeypatch):
    """The admin surface should show exactly where external billing remains."""
    for v in (
        "AI_MODEL_CAPTION",
        "AI_MODEL_HASHTAGS",
        "AI_MODEL_BLOG_POST",
        "AI_MODEL_EMAIL_COPY",
        "AI_MODEL_SCRIPT",
    ):
        monkeypatch.delenv(v, raising=False)
    get_settings.cache_clear()

    status = ai_internal._provider_status_summary()
    assert status["default_model"] == "@cf/meta/llama-3.1-8b-instruct"
    chains = status["content_type_chains"]
    assert chains["caption"]["providers"][:2] == ["workers-ai", "google-ai-studio"]
    assert chains["blog_post"]["providers"][:2] == ["workers-ai", "google-ai-studio"]
    assert chains["blog_post"]["external_billing_dependent"] is True
    assert any("billing" in warning.lower() for warning in status["warnings"])


def test_blank_org_settings_does_not_crash():
    """Org with no settings at all — every step gracefully falls through."""
    chain = ai_internal._resolved_model_chain("caption", None, None)
    assert chain[0] == "@cf/meta/llama-3.1-8b-instruct"

    chain = ai_internal._resolved_model_chain("caption", {}, None)
    assert chain[0] == "@cf/meta/llama-3.1-8b-instruct"

    chain = ai_internal._resolved_model_chain(
        "caption", {"ai": {}}, None
    )
    assert chain[0] == "@cf/meta/llama-3.1-8b-instruct"
