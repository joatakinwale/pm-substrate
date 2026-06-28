"""``AI_DEFAULT_MODEL`` env override + cost lookup behaviour."""
from __future__ import annotations

import pytest

from app.api.internal import ai as ai_internal
from app.core.config import get_settings


@pytest.fixture(autouse=True)
def _reset_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_default_model_falls_through_to_codepath_default(monkeypatch):
    """No env override → use the hardcoded default."""
    monkeypatch.delenv("AI_DEFAULT_MODEL", raising=False)
    get_settings.cache_clear()

    assert ai_internal._resolved_default_model() == "@cf/meta/llama-3.1-8b-instruct"


def test_default_model_respects_env_override(monkeypatch):
    """Operator can pin a different model without a code change."""
    monkeypatch.setenv("AI_DEFAULT_MODEL", "claude-sonnet-4-5")
    get_settings.cache_clear()

    assert ai_internal._resolved_default_model() == "claude-sonnet-4-5"


def test_default_model_supports_workers_ai_id(monkeypatch):
    """Operator can flip the whole instance to Workers AI by env."""
    monkeypatch.setenv("AI_DEFAULT_MODEL", "@cf/meta/llama-3.1-8b-instruct")
    get_settings.cache_clear()

    resolved = ai_internal._resolved_default_model()
    assert resolved == "@cf/meta/llama-3.1-8b-instruct"


def test_cost_for_known_anthropic_sonnet():
    """Pricing tier lookup for Anthropic Sonnet (verified 2026Q2)."""
    cents = ai_internal._cost_for_model(
        "claude-sonnet-4-5", input_tokens=1_000_000, output_tokens=1_000_000
    )
    # ($3 input + $15 output) * 100 cents
    assert cents == int((3.0 + 15.0) * 100)


def test_cost_for_anthropic_opus_uses_5_25_tier():
    """Regression: Opus 4.7 is $5/$25, not the legacy $15/$75 from Opus 4.1.

    Verified against Anthropic's published model table — the Opus pricing
    tier dropped starting with Opus 4.5. A tooling error here would
    over-charge customers by 3x.
    """
    cents = ai_internal._cost_for_model(
        "claude-opus-4-7", input_tokens=1_000_000, output_tokens=1_000_000
    )
    assert cents == int((5.0 + 25.0) * 100)


def test_cost_for_legacy_opus_4_1_keeps_old_tier():
    """The pre-4.5 Opus tier was $15/$75 — keep that for legacy IDs."""
    cents = ai_internal._cost_for_model(
        "claude-opus-4-1", input_tokens=1_000_000, output_tokens=1_000_000
    )
    assert cents == int((15.0 + 75.0) * 100)


def test_cost_for_dated_alias_resolves_same_as_short_alias():
    """Stuck rows hit the dated form (e.g. claude-haiku-4-5-20251001).
    Pricing must match the short alias so we don't drift."""
    short = ai_internal._cost_for_model(
        "claude-haiku-4-5", input_tokens=1_000_000, output_tokens=0
    )
    dated = ai_internal._cost_for_model(
        "claude-haiku-4-5-20251001", input_tokens=1_000_000, output_tokens=0
    )
    assert short == dated


def test_cost_for_known_openai_model():
    cents = ai_internal._cost_for_model(
        "gpt-4o-mini", input_tokens=1_000_000, output_tokens=1_000_000
    )
    # ($0.15 input + $0.60 output) * 100 cents
    assert cents == int((0.15 + 0.6) * 100)


def test_cost_for_known_workers_ai_model():
    cents = ai_internal._cost_for_model(
        "@cf/meta/llama-3.1-8b-instruct",
        input_tokens=1_000_000,
        output_tokens=1_000_000,
    )
    assert cents == int((0.07 + 0.07) * 100)


def test_cost_for_unknown_model_falls_back_to_sonnet():
    """Unknown model id shouldn't crash — use Sonnet pricing as upper-bound."""
    cents = ai_internal._cost_for_model(
        "future-model-xyz", input_tokens=1_000_000, output_tokens=1_000_000
    )
    # Same as Sonnet pricing.
    assert cents == int((3.0 + 15.0) * 100)


def test_cost_lookup_is_case_insensitive():
    cents_lower = ai_internal._cost_for_model(
        "gpt-4o-mini", input_tokens=1_000_000, output_tokens=0
    )
    cents_upper = ai_internal._cost_for_model(
        "GPT-4o-Mini", input_tokens=1_000_000, output_tokens=0
    )
    assert cents_lower == cents_upper
