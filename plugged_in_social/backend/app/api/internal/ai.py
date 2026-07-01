"""Internal AI content endpoints — called by the stevie-ai-content Cloudflare Worker.

Worker flow:
  1. Worker pulls an AIContentMessage off the stevie-ai-content queue.
  2. Worker POSTs ``/internal/ai/{request_id}/begin`` with the org_id. We load
     the AIContentRequest + linked BrandVoiceProfile and return the pre-built
     prompt + model params. Prompt-build logic stays Python-side so the
     content_type / platform hint maps have one source of truth.
  3. Worker calls Anthropic via Cloudflare AI Gateway with the returned body.
  4. On success → POST ``/complete`` body {generated_content, model,
     input_tokens, output_tokens, latency_ms}. We compute cost_cents from the
     existing ``record_cost_sync`` helper and update the row under RLS.
  5. On permanent failure (auth/bad-prompt) → POST ``/fail`` with the error
     message. We flip status='failed' and store the truncated error.

Security: same shared-header pattern as ``app/api/internal/billing.py`` —
``X-Webhook-Secret`` must equal ``settings.webhook_secret``. Workers are
system actors, so they do not carry a JWT; we set RLS context manually from
the org_id in the body.

The prompt-build helpers below live inline so this endpoint is the
single source of truth for the content_type / platform hint maps.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, Path
from pydantic import BaseModel, Field

from app.api.internal.webhooks import verify_webhook_secret
from app.db.database import RequestContext, get_db_with_rls
from app.models import Organization
from app.models.social_media import AIContentRequest, BrandVoiceProfile

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal/ai", tags=["internal"])


# ── Prompt-build helpers ─────────────────────────────────────────
#
# The platform / content_type hint maps live here as the single source
# of truth — the Worker calls back into ``/begin`` to fetch the
# pre-built prompt.

_CONTENT_TYPE_HINTS: dict[str, str] = {
    "caption": "Generate a social media caption.",
    "blog_post": "Write a full blog post with introduction, body sections, and conclusion.",
    "email_copy": "Write email marketing copy with a compelling subject line and body.",
    "hashtags": "Generate a set of relevant hashtags (20-30) organized by reach tier.",
    "script": "Write a video script with hook, body, and call-to-action sections.",
}

_PLATFORM_HINTS: dict[str, str] = {
    "instagram": "Format for Instagram: short punchy caption, line breaks for readability, suggest hashtags at the end.",
    "tiktok": "Format for TikTok: casual tone, trending style, hook in first line, include relevant hashtags.",
    "linkedin": "Format for LinkedIn: professional tone, thought leadership angle, include a call-to-action.",
    "youtube": "Format for YouTube: attention-grabbing title ideas, description copy with timestamps placeholder, tags.",
    "facebook": "Format for Facebook: conversational tone, encourage engagement/comments, moderate length.",
    "x": "Format for X/Twitter: concise (under 280 chars), punchy, consider thread format for longer content.",
}

# Model + sampling defaults. If product wants different values per
# content_type or platform, route them through here — keeping the
# decision in one place instead of letting the Worker hard-code anything.
#
# ``_DEFAULT_MODEL`` is the codepath fallback when neither the row nor
# the ``AI_DEFAULT_MODEL`` env var supplies a string. Stored as a
# function so an env override at boot doesn't require restart-to-pick-up
# semantics — ``get_settings()`` is cached but re-readable in tests.
_HARDCODED_DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct"
_DEFAULT_MAX_TOKENS = 2048
_DEFAULT_TEMPERATURE = 0.7


def _resolved_default_model() -> str:
    from app.core.config import get_settings

    settings = get_settings()
    return getattr(settings, "ai_default_model", "") or _HARDCODED_DEFAULT_MODEL


# Kept for backwards-compat with imports that pinned this constant —
# always reflects the current resolved default.
_DEFAULT_MODEL = _HARDCODED_DEFAULT_MODEL


# ── Per-content-type model chains ────────────────────────────────
#
# Layer 1 (task-based defaults): pick a sensible model for each
# content_type rather than burning Sonnet tokens on a 5-hashtag
# request. Captions / hashtags route to a cheap on-platform model,
# long-form (blog_post, script, email_copy) defaults to a larger
# Workers AI model before falling through to Google/Anthropic. That
# keeps new generations useful while OpenAI/Anthropic billing is flaky.
#
# Layer 2 (quota-aware fallback): when the resolved chain has more
# than one entry, the Worker uses Cloudflare AI Gateway's Universal
# Endpoint and the gateway falls through on errors / rate limits.
#
# Resolution order (highest priority first):
#   1. Explicit model on the AIContentRequest row (user picked one).
#   2. Per-org override at ``Organization.settings.ai.models.<type>``.
#      Either a string ("claude-sonnet-4-6") or list of strings.
#   3. Env var ``AI_MODEL_<TYPE>`` — comma-separated list of model ids.
#   4. Built-in chain table below.
#   5. ``ai_default_model`` env / hardcoded fallback.
_DEFAULT_TASK_CHAINS: dict[str, list[str]] = {
    "caption": [
        "@cf/meta/llama-3.1-8b-instruct",
        "gemini-2.5-flash",
    ],
    "hashtags": [
        "@cf/meta/llama-3.1-8b-instruct",
        "gemini-2.5-flash",
    ],
    "blog_post": [
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        "gemini-2.5-flash",
        "claude-sonnet-4-6",
    ],
    "email_copy": [
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        "gemini-2.5-flash",
        "claude-haiku-4-5",
    ],
    "script": [
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        "gemini-2.5-flash",
        "claude-sonnet-4-6",
    ],
}

_EXTERNAL_BILLING_PROVIDERS = frozenset({"anthropic", "openai"})
_AI_STATUS_CONTENT_TYPES = tuple(_DEFAULT_TASK_CHAINS.keys())


def _provider_for_model(model: str) -> str:
    """Return the provider family implied by a model id."""
    model_id = (model or "").lower()
    if model_id.startswith("@cf/"):
        return "workers-ai"
    if model_id.startswith("claude-") or model_id.startswith("claude/"):
        return "anthropic"
    if model_id.startswith(("gpt-", "o1-", "o3-")):
        return "openai"
    if model_id.startswith("gemini-") or model_id.startswith("models/gemini-"):
        return "google-ai-studio"
    return "unknown"


def _provider_status_summary(org_settings: dict | None = None) -> dict[str, object]:
    """Summarize the backend's current auto-model decisions for operators."""
    chains: dict[str, dict[str, object]] = {}

    for content_type in _AI_STATUS_CONTENT_TYPES:
        models = _resolved_model_chain(content_type, org_settings, None)
        providers = [_provider_for_model(model) for model in models]
        chains[content_type] = {
            "models": models,
            "providers": providers,
            "external_billing_dependent": any(
                provider in _EXTERNAL_BILLING_PROVIDERS for provider in providers
            ),
        }

    warnings: list[str] = [
        (
            "Auto mode now prefers Cloudflare Workers AI, then Google AI Studio "
            "where configured. Explicit Claude/OpenAI selections still depend "
            "on those provider billing accounts."
        )
    ]
    if any(
        chain["external_billing_dependent"]
        for chain in chains.values()
    ):
        warnings.append(
            "Some fallback chains still keep Anthropic as a last resort for "
            "long-form quality. If Anthropic billing is paused, leave Auto "
            "selected or pin a Workers AI/Gemini model until billing recovers."
        )
    if any(len(chain["models"]) > 1 for chain in chains.values()):
        warnings.append(
            "Multi-model fallback uses Cloudflare AI Gateway's Universal "
            "Endpoint, which Cloudflare now marks deprecated but still "
            "available for existing integrations."
        )

    return {
        "default_model": _resolved_default_model(),
        "content_type_chains": chains,
        "warnings": warnings,
    }


def _split_chain(value: str) -> list[str]:
    """Parse comma-separated model ids, ignoring blanks."""
    return [p.strip() for p in value.split(",") if p.strip()]


def _resolved_model_chain(
    content_type: str,
    org_settings: dict | None = None,
    explicit_model: str | None = None,
) -> list[str]:
    """Resolve the model chain for a generation.

    Returns a non-empty list of model ids. The first is the primary
    request; entries 2+ are fallbacks fed to the AI Gateway Universal
    Endpoint. A length-1 chain causes the Worker to use the cheaper
    per-provider call path (no Universal Endpoint overhead).
    """
    if explicit_model and explicit_model.strip() and explicit_model.strip().lower() != "auto":
        return [explicit_model.strip()]

    # Per-org override — a string or list at settings.ai.models.<type>.
    if org_settings:
        ai_blob = org_settings.get("ai") if isinstance(org_settings, dict) else None
        models = (ai_blob or {}).get("models") if isinstance(ai_blob, dict) else None
        if isinstance(models, dict):
            raw = models.get(content_type)
            if isinstance(raw, list):
                cleaned = [m.strip() for m in raw if isinstance(m, str) and m.strip()]
                if cleaned:
                    return cleaned
            elif isinstance(raw, str) and raw.strip():
                return [raw.strip()]

    # Env var per content_type.
    from app.core.config import get_settings

    settings = get_settings()
    env_field = f"ai_model_{content_type}"
    env_value = getattr(settings, env_field, "") or ""
    chain = _split_chain(env_value)
    if chain:
        return chain

    # Built-in table.
    builtin = _DEFAULT_TASK_CHAINS.get(content_type)
    if builtin:
        return list(builtin)

    # Final fallback: the instance default.
    return [_resolved_default_model()]


def _build_user_prompt(req: AIContentRequest) -> str:
    """Wrap the user's prompt with content_type and platform hints."""
    parts: list[str] = []

    content_hint = _CONTENT_TYPE_HINTS.get(req.content_type)
    if content_hint:
        parts.append(content_hint)

    parts.append(req.prompt)

    if req.platform:
        platform_hint = _PLATFORM_HINTS.get(req.platform)
        if platform_hint:
            parts.append(platform_hint)

    return "\n\n".join(parts)


# ── Schemas ──────────────────────────────────────────────────────


class AIBeginBody(BaseModel):
    """Payload from the ai-content Worker for the begin call."""

    org_id: uuid.UUID = Field(
        description=(
            "Stevie organization UUID. Worker carries this from the original "
            "queue message; we use it to set RLS context and to scope the "
            "AIContentRequest lookup."
        )
    )


class AIBeginResponse(BaseModel):
    """Pre-built request params returned to the Worker.

    ``model`` is always the primary (first) entry of ``model_chain`` —
    older Worker builds that read ``model`` and ignore ``model_chain``
    keep working unchanged. Newer Worker builds prefer ``model_chain``
    so they can use the AI Gateway Universal Endpoint for fallbacks.
    """

    system_prompt: str | None = Field(
        description=(
            "Resolved BrandVoiceProfile.system_prompt, or None if no voice "
            "is linked. Worker passes this straight through without "
            "re-templating."
        )
    )
    user_prompt: str = Field(
        description=(
            "User message content with content_type / platform hints already "
            "wrapped — the Worker passes this through unchanged."
        )
    )
    model: str
    model_chain: list[str] = Field(
        default_factory=list,
        description=(
            "Resolved model chain. The first entry equals ``model`` for "
            "backwards-compat with older Workers. When length > 1, the "
            "Worker should use the AI Gateway Universal Endpoint with "
            "the chain as a fallback list."
        ),
    )
    max_tokens: int
    temperature: float


class AICompleteBody(BaseModel):
    """Payload from the ai-content Worker on successful generation."""

    org_id: uuid.UUID
    generated_content: str
    model: str
    input_tokens: int = Field(ge=0)
    output_tokens: int = Field(ge=0)
    latency_ms: int = Field(ge=0)


class AIFailBody(BaseModel):
    """Payload from the ai-content Worker on permanent failure."""

    org_id: uuid.UUID
    error_message: str = Field(
        description=(
            "Truncated provider error message. Stored on AIContentRequest "
            "as a status hint for the UI."
        )
    )


# ── Routes ───────────────────────────────────────────────────────


# Statuses the Worker is allowed to start from. Re-entry guard: once a
# row is completed/failed it must not be re-run, and an in-flight row
# (already being processed by another consumer) gets a 409 so CF Queues
# retries the message instead of double-charging Anthropic.
_STARTABLE_STATUSES: frozenset[str] = frozenset({"queued", "retrying"})


@router.post("/{request_id}/begin", response_model=AIBeginResponse)
async def begin_ai_request(
    request_id: Annotated[uuid.UUID, Path()],
    body: Annotated[AIBeginBody, Body()],
    _: None = Depends(verify_webhook_secret),
) -> AIBeginResponse:
    """Build the prompt + return Anthropic-ready params for the Worker.

    Returns 404 if the request/org pairing doesn't exist.
    Returns 409 if the request isn't in a startable status (already
    completed, already failed, or already in flight).
    """
    ctx = RequestContext(
        org_id=str(body.org_id),
        # System-actor user_id — same fixed UUID the billing endpoint uses.
        user_id="00000000-0000-0000-0000-00000000aaaa",
        role="system",
    )

    response: AIBeginResponse | None = None
    async for db in get_db_with_rls(ctx):
        req = await db.get(AIContentRequest, request_id)
        if req is None or req.org_id != body.org_id:
            raise HTTPException(
                status_code=404,
                detail=f"AIContentRequest {request_id} not found for org {body.org_id}",
            )

        if req.status not in _STARTABLE_STATUSES:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"AIContentRequest {request_id} is in status "
                    f"'{req.status}', not startable"
                ),
            )

        req.status = "generating"
        await db.flush()

        # Resolve the optional brand voice profile inline so the Worker
        # never sees the BrandVoiceProfile shape.
        system_prompt: str | None = None
        if req.brand_voice_id:
            voice = await db.get(BrandVoiceProfile, req.brand_voice_id)
            if voice is not None and voice.system_prompt:
                system_prompt = voice.system_prompt

        user_prompt = _build_user_prompt(req)

        # Look up the org's settings JSONB so per-org overrides
        # (settings.ai.models.<content_type>) win over env defaults.
        org_settings: dict | None = None
        org = await db.get(Organization, req.org_id)
        if org is not None:
            org_settings = dict(org.settings or {})

        # Resolve the chain. The first entry is what older Workers
        # consume via ``model``; newer Workers prefer ``model_chain``
        # and use the AI Gateway Universal Endpoint when length > 1.
        chain = _resolved_model_chain(
            content_type=req.content_type,
            org_settings=org_settings,
            explicit_model=req.model,
        )

        response = AIBeginResponse(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            model=chain[0],
            model_chain=chain,
            max_tokens=_DEFAULT_MAX_TOKENS,
            temperature=_DEFAULT_TEMPERATURE,
        )

    if response is not None:
        return response

    # Defensive — get_db_with_rls is an async-generator dependency so the
    # for-loop above always yields exactly once. This path is unreachable
    # in practice; satisfies the type checker.
    raise HTTPException(status_code=500, detail="db session not available")


@router.post("/{request_id}/complete", status_code=204)
async def complete_ai_request(
    request_id: Annotated[uuid.UUID, Path()],
    body: Annotated[AICompleteBody, Body()],
    _: None = Depends(verify_webhook_secret),
) -> None:
    """Persist the Worker's generation result + record cost.

    Returns 204 on success, 404 if the request/org pairing doesn't exist.
    The Worker treats 404 as permanent (DLQ), 5xx as retryable.
    """
    ctx = RequestContext(
        org_id=str(body.org_id),
        user_id="00000000-0000-0000-0000-00000000aaaa",
        role="system",
    )

    async for db in get_db_with_rls(ctx):
        req = await db.get(AIContentRequest, request_id)
        if req is None or req.org_id != body.org_id:
            raise HTTPException(
                status_code=404,
                detail=f"AIContentRequest {request_id} not found for org {body.org_id}",
            )

        # Compute cost_cents from the per-model pricing table. Sonnet
        # pricing is $3/M input, $15/M output; if product moves to a
        # different tier add a model→price lookup here, NOT in the Worker.
        cost_cents = _cost_for_model(
            body.model, body.input_tokens, body.output_tokens
        )

        req.generated_content = body.generated_content
        req.model = body.model
        req.input_tokens = body.input_tokens
        req.output_tokens = body.output_tokens
        req.latency_ms = body.latency_ms
        req.cost_cents = cost_cents
        req.status = "completed"
        req.error_message = None

        await db.flush()
        await db.commit()

        # Record cost separately. ``record_cost_sync`` is the canonical
        # cost-tracking helper and handles spending-limit enforcement +
        # alert emails. The async API endpoint deliberately calls the
        # sync version because it opens its own DB session — the entry
        # belongs to the Worker's logical request even though we wrote
        # the AIContentRequest under our own RLS context.
        try:
            from app.services.cost_tracker import record_cost_sync

            record_cost_sync(
                org_id=body.org_id,
                service="ai_generation",
                operation="content_generation",
                cost_cents=cost_cents,
                usage_data={
                    "input_tokens": body.input_tokens,
                    "output_tokens": body.output_tokens,
                    "model": body.model,
                    "latency_ms": body.latency_ms,
                },
                reference_type="ai_content_request",
                reference_id=request_id,
            )
        except Exception:
            # Never let a cost-recording failure block the completion ack.
            # The AIContentRequest is the source of truth for cost_cents;
            # the cost_entries table is a denormalised aggregation.
            logger.exception(
                "record_cost_sync failed for ai_content_request %s — "
                "AIContentRequest still marked completed",
                request_id,
            )

        logger.info(
            "AIContentRequest %s (org=%s) completed: tokens=%d/%d cost=%d¢ latency=%dms",
            request_id,
            body.org_id,
            body.input_tokens,
            body.output_tokens,
            cost_cents,
            body.latency_ms,
        )
        return None

    raise HTTPException(status_code=500, detail="db session not available")


@router.post("/{request_id}/fail", status_code=204)
async def fail_ai_request(
    request_id: Annotated[uuid.UUID, Path()],
    body: Annotated[AIFailBody, Body()],
    _: None = Depends(verify_webhook_secret),
) -> None:
    """Mark an AI content request as failed with the Worker's error message.

    Called on PermanentError paths — auth errors, bad prompts, safety
    refusals — so the user sees the failure in the UI instead of a row
    stuck in 'queued'.
    """
    ctx = RequestContext(
        org_id=str(body.org_id),
        user_id="00000000-0000-0000-0000-00000000aaaa",
        role="system",
    )

    async for db in get_db_with_rls(ctx):
        req = await db.get(AIContentRequest, request_id)
        if req is None or req.org_id != body.org_id:
            raise HTTPException(
                status_code=404,
                detail=f"AIContentRequest {request_id} not found for org {body.org_id}",
            )

        req.status = "failed"
        # 500 chars is enough for the UI tooltip and avoids storing
        # entire stack traces.
        req.error_message = body.error_message[:500]

        await db.flush()
        await db.commit()

        logger.warning(
            "AIContentRequest %s (org=%s) marked failed: %s",
            request_id,
            body.org_id,
            req.error_message,
        )
        return None

    raise HTTPException(status_code=500, detail="db session not available")


# ── Cost helper ──────────────────────────────────────────────────


# Per-model pricing in (USD per 1M input tokens, USD per 1M output tokens).
# Lookup is case-insensitive; unknown ids fall through to Sonnet pricing.
#
# Source-of-truth references (verify before billing decisions — provider
# pricing changes more often than this file):
#   Anthropic: https://platform.claude.com/docs/en/about-claude/models/overview
#              (verified 2026Q2 — Opus tier dropped from 4.1's $15/$75 to
#              $5/$25 starting with Opus 4.5)
#   OpenAI:    https://openai.com/api/pricing  — APPROXIMATE rates below;
#              update when the gateway returns 4xx pricing-mismatch.
#   Workers AI: https://developers.cloudflare.com/workers-ai/platform/pricing/
#              billed per "neuron" not per token — the $/Mtok numbers below
#              are conversion approximations for parity with the other
#              providers. Operators chasing a real budget should consult the
#              CF dashboard directly.
#   Gemini:    https://ai.google.dev/gemini-api/docs/pricing — rates differ
#              by context-window tier on 2.5 Pro; we use the standard tier.
_MODEL_PRICING_USD_PER_M: dict[str, tuple[float, float]] = {
    # Anthropic — current (verified against Anthropic's published model table)
    "claude-opus-4-7": (5.0, 25.0),
    "claude-sonnet-4-6": (3.0, 15.0),
    "claude-haiku-4-5": (1.0, 5.0),
    "claude-haiku-4-5-20251001": (1.0, 5.0),
    # Anthropic — legacy aliases & dated IDs still accepted by the API
    "claude-opus-4-6": (5.0, 25.0),
    "claude-sonnet-4-5": (3.0, 15.0),
    "claude-sonnet-4-5-20250929": (3.0, 15.0),
    "claude-opus-4-5": (5.0, 25.0),
    "claude-opus-4-5-20251101": (5.0, 25.0),
    "claude-opus-4-1": (15.0, 75.0),
    "claude-opus-4-1-20250805": (15.0, 75.0),
    # OpenAI — APPROXIMATE; correct one-line edit if the gateway disputes
    "gpt-4o": (2.5, 10.0),
    "gpt-4o-mini": (0.15, 0.6),
    "gpt-4.1": (2.0, 8.0),
    "gpt-4.1-mini": (0.4, 1.6),
    "o3-mini": (1.1, 4.4),
    # Google AI Studio (Gemini) — APPROXIMATE
    "gemini-3-pro-preview": (1.5, 12.0),
    "gemini-3-flash-preview": (0.1, 0.4),
    "gemini-2.5-pro": (1.25, 10.0),
    "gemini-2.5-flash": (0.075, 0.3),
    # Cloudflare Workers AI — converted from per-neuron billing,
    # APPROXIMATE
    "@cf/meta/llama-3.1-8b-instruct": (0.07, 0.07),
    "@cf/meta/llama-3.3-70b-instruct-fp8-fast": (0.3, 0.3),
    "@cf/meta/llama-4-scout-17b-16e-instruct": (0.5, 0.5),
    "@cf/openai/gpt-oss-120b": (1.0, 1.0),
    "@cf/openai/gpt-oss-20b": (0.2, 0.2),
}


def _cost_for_model(model: str, input_tokens: int, output_tokens: int) -> int:
    """Cost in cents for the given model + token counts.

    cost_cents = (in * in_price / 1M + out * out_price / 1M) * 100

    Centralising the rate here means a price change is a one-line edit,
    not a Worker redeploy. Lookup is case-insensitive — the Worker may
    return a slightly different casing of the same model id.
    Unknown models fall through to Sonnet pricing as a safe upper bound.
    """
    key = (model or "").lower()
    in_price, out_price = _MODEL_PRICING_USD_PER_M.get(
        key,
        _MODEL_PRICING_USD_PER_M.get("claude-sonnet-4-6", (3.0, 15.0)),
    )
    cost_dollars = (
        input_tokens * in_price / 1_000_000
        + output_tokens * out_price / 1_000_000
    )
    return int(cost_dollars * 100)
