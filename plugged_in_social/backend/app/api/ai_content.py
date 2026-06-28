"""AI content generation + brand voice API."""
import logging
import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.internal.ai import _provider_status_summary
from app.auth.deps import get_current_user, get_db_with_rls_dep
from app.core.config import get_settings
from app.models import Organization
from app.models.social_media import AIContentRequest, BrandVoiceProfile
from app.schemas.common import PaginatedResponse
from app.schemas.social_media import (
    AIContentCreate,
    AIContentFeedback,
    AIContentResponse,
    BrandVoiceCreate,
    BrandVoiceResponse,
    BrandVoiceUpdate,
)
from app.services.queue_publisher import (
    QueueNotConfiguredError,
    QueuePublishError,
    publish_ai_content_generate,
)


# Anthropic model ids that are deprecated and retiring 2026-06-15. Rewrite
# transparently on retry so rows queued before migration 017 don't keep
# bouncing off the worker. Migration 017 already rewrites the literal
# default at startup; this map covers any other rows that explicitly
# selected one of these ids.
_DEPRECATED_MODEL_ALIASES = {
    "claude-sonnet-4-20250514": "claude-sonnet-4-6",
    "claude-opus-4-20250514": "claude-opus-4-7",
}

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["ai"])


class AIProviderChainStatus(BaseModel):
    models: list[str]
    providers: list[str]
    external_billing_dependent: bool


class AIProviderStatusResponse(BaseModel):
    queue_configured: bool
    default_model: str
    content_type_chains: dict[str, AIProviderChainStatus]
    warnings: list[str]


# ═══ BRAND VOICE PROFILES ═══════════════════════════════════

@router.get("/brand-voices", response_model=list[BrandVoiceResponse])
async def list_brand_voices(
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(BrandVoiceProfile).order_by(BrandVoiceProfile.is_default.desc(), BrandVoiceProfile.created_at.desc())
    )
    return [BrandVoiceResponse.model_validate(v) for v in result.scalars().all()]


@router.get("/brand-voices/{voice_id}", response_model=BrandVoiceResponse)
async def get_brand_voice(
    voice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(BrandVoiceProfile).where(BrandVoiceProfile.id == voice_id))
    voice = result.scalar_one_or_none()
    if not voice:
        raise HTTPException(status_code=404, detail="Brand voice not found")
    return BrandVoiceResponse.model_validate(voice)


@router.post("/brand-voices", response_model=BrandVoiceResponse, status_code=201)
async def create_brand_voice(
    body: BrandVoiceCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = uuid.UUID(current_user["org_id"])

    # Auto-compile system prompt from voice attributes
    system_prompt = _compile_system_prompt(
        body.tone_descriptors, body.vocabulary_preferences,
        body.example_pieces, body.guardrails, body.client_name,
    )

    voice = BrandVoiceProfile(
        org_id=org_id,
        name=body.name,
        client_name=body.client_name,
        lead_id=body.lead_id,
        tone_descriptors=body.tone_descriptors,
        vocabulary_preferences=body.vocabulary_preferences,
        example_pieces=body.example_pieces,
        guardrails=body.guardrails,
        system_prompt=system_prompt,
    )
    db.add(voice)
    await db.flush()
    await db.refresh(voice)
    return BrandVoiceResponse.model_validate(voice)


@router.patch("/brand-voices/{voice_id}", response_model=BrandVoiceResponse)
async def update_brand_voice(
    voice_id: uuid.UUID,
    body: BrandVoiceUpdate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(BrandVoiceProfile).where(BrandVoiceProfile.id == voice_id))
    voice = result.scalar_one_or_none()
    if not voice:
        raise HTTPException(status_code=404, detail="Brand voice not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(voice, field, value)

    # Recompile system prompt if voice attributes changed
    if any(f in body.model_dump(exclude_unset=True) for f in ["tone_descriptors", "vocabulary_preferences", "example_pieces", "guardrails"]):
        voice.system_prompt = _compile_system_prompt(
            voice.tone_descriptors, voice.vocabulary_preferences,
            voice.example_pieces, voice.guardrails, voice.client_name,
        )

    await db.flush()
    await db.refresh(voice)
    return BrandVoiceResponse.model_validate(voice)


@router.delete("/brand-voices/{voice_id}", status_code=204)
async def delete_brand_voice(
    voice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(BrandVoiceProfile).where(BrandVoiceProfile.id == voice_id))
    voice = result.scalar_one_or_none()
    if not voice:
        raise HTTPException(status_code=404, detail="Brand voice not found")
    await db.delete(voice)


# ═══ AI CONTENT GENERATION ═══════════════════════════════════


@router.get("/content/provider-status", response_model=AIProviderStatusResponse)
async def get_ai_provider_status(
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Return operator-facing AI routing status for the current org."""
    org_settings: dict | None = None
    org_id = uuid.UUID(current_user["org_id"])
    org = await db.get(Organization, org_id)
    if org is not None:
        org_settings = dict(org.settings or {})

    summary = _provider_status_summary(org_settings)
    settings = get_settings()
    warnings = list(summary["warnings"])
    if not settings.queue_producer_url:
        warnings.insert(
            0,
            "AI generation cannot leave the API until QUEUE_PRODUCER_URL "
            "points at the queue-producer Worker.",
        )

    return AIProviderStatusResponse(
        queue_configured=bool(settings.queue_producer_url),
        default_model=str(summary["default_model"]),
        content_type_chains=summary["content_type_chains"],
        warnings=warnings,
    )


@router.get("/content", response_model=PaginatedResponse)
async def list_content_requests(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    content_type: str | None = None,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    query = select(AIContentRequest)
    if status_filter:
        query = query.where(AIContentRequest.status == status_filter)
    if content_type:
        query = query.where(AIContentRequest.content_type == content_type)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(AIContentRequest.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    items = result.scalars().all()

    return PaginatedResponse(
        items=[AIContentResponse.model_validate(r) for r in items],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


@router.post("/content/generate", response_model=AIContentResponse, status_code=201)
async def generate_content(
    body: AIContentCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Generate content using Claude with optional brand voice."""
    org_id = uuid.UUID(current_user["org_id"])

    # Load brand voice if specified
    system_prompt = None
    if body.brand_voice_id:
        voice_result = await db.execute(
            select(BrandVoiceProfile).where(BrandVoiceProfile.id == body.brand_voice_id)
        )
        voice = voice_result.scalar_one_or_none()
        if voice:
            system_prompt = voice.system_prompt

    # Status starts as ``queued`` so the ai-content Worker's /begin
    # endpoint accepts it (the Worker flips it to ``generating`` itself
    # once it actually starts the Anthropic call).
    # ``"auto"`` (or empty) is the frontend's signal that the user wants
    # the backend to pick a model based on content_type + per-org config.
    # Storing an empty string forces ``/begin`` to fall through to
    # ``_resolved_model_chain``; storing the literal "auto" would cause
    # the Worker to try to route to a provider named "auto".
    explicit_model = (body.model or "").strip()
    if explicit_model.lower() == "auto":
        explicit_model = ""

    request = AIContentRequest(
        org_id=org_id,
        brand_voice_id=body.brand_voice_id,
        project_id=body.project_id,
        content_type=body.content_type,
        prompt=body.prompt,
        platform=body.platform,
        context=body.context,
        model=explicit_model,
        status="queued",
    )
    db.add(request)
    await db.flush()
    await db.refresh(request)

    # Dispatch to ai-content Cloudflare Worker via the queue producer.
    # If the producer URL isn't configured we surface a 503 and let the
    # ``get_db_with_rls_dep`` rollback discard the just-inserted row —
    # there's no recovery path for a generation that was never queued,
    # so a "failed" row is just clutter. The user fixes the env var and
    # clicks Generate again.
    #
    # We deliberately do NOT try to set ``status='failed'`` + flush
    # here: the dependency rolls back on any exception, so that update
    # would be discarded silently and we'd be back to a stuck "queued"
    # row — which is exactly what this fail-loud path is meant to
    # prevent.
    try:
        await publish_ai_content_generate(
            org_id=request.org_id,
            request_id=request.id,
        )
    except QueueNotConfiguredError as exc:
        logger.error("AI content publish failed (worker not configured): %s", exc)
        raise HTTPException(
            status_code=503,
            detail=(
                "AI content worker is not configured on this environment. "
                "Set QUEUE_PRODUCER_URL on the backend and deploy the "
                "ai-content Worker before retrying."
            ),
        ) from exc
    except QueuePublishError as exc:
        logger.error("AI content publish rejected by producer: %s", exc)
        raise HTTPException(
            status_code=502,
            detail=f"Queue producer rejected publish: {exc}",
        ) from exc

    return AIContentResponse.model_validate(request)


@router.post("/content/{request_id}/retry", response_model=AIContentResponse)
async def retry_content_request(
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Re-publish a stuck or failed AI content request.

    Useful for two scenarios:
    1. A row was queued before ``QUEUE_PRODUCER_URL`` was configured and
       sat untouched (the original publish silently no-op'd).
    2. The worker hit a transient Anthropic error and marked the row
       ``failed`` — re-queue without losing the original prompt.

    Resets the row back to ``queued`` and clears any error/usage fields
    so the worker treats it like a fresh request.
    """
    result = await db.execute(
        select(AIContentRequest).where(AIContentRequest.id == request_id)
    )
    request = result.scalar_one_or_none()
    if not request:
        raise HTTPException(status_code=404, detail="Content request not found")

    if request.status in ("generating", "completed"):
        raise HTTPException(
            status_code=409,
            detail=(
                f"Cannot retry a request in status '{request.status}'. "
                "Only queued/failed/pending requests can be retried."
            ),
        )

    # Reset row to ``queued`` BEFORE publishing so the Worker's /begin
    # endpoint accepts it. If the publish then fails, the
    # ``get_db_with_rls_dep`` rolls back this update and the row stays
    # in its previous state — the user can click Retry again after
    # fixing the queue config.
    request.status = "queued"
    request.error_message = None
    request.generated_content = None
    request.input_tokens = 0
    request.output_tokens = 0
    request.latency_ms = 0
    request.cost_cents = 0
    if request.model in _DEPRECATED_MODEL_ALIASES:
        request.model = _DEPRECATED_MODEL_ALIASES[request.model]
    await db.flush()

    try:
        await publish_ai_content_generate(
            org_id=request.org_id,
            request_id=request.id,
        )
    except QueueNotConfiguredError as exc:
        # Same reasoning as ``generate_content``: don't attempt to
        # write status='failed' here — the dependency rolls back, the
        # write is discarded silently. Letting the rollback take the
        # whole transaction means the row keeps its prior status,
        # which is the correct user-facing behaviour.
        raise HTTPException(
            status_code=503,
            detail=(
                "AI content worker is not configured on this environment."
            ),
        ) from exc
    except QueuePublishError as exc:
        logger.error("AI content retry publish rejected by producer: %s", exc)
        raise HTTPException(
            status_code=502,
            detail=f"Queue producer rejected publish: {exc}",
        ) from exc

    await db.refresh(request)
    return AIContentResponse.model_validate(request)


@router.delete("/content/{request_id}", status_code=204)
async def delete_content_request(
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Delete an AI content request. Org-scoped via RLS.

    Refuses deletes while the worker has the row checked out (status =
    ``generating``) so the worker's later ``/complete`` write can't race
    against a phantom row.
    """
    result = await db.execute(
        select(AIContentRequest).where(AIContentRequest.id == request_id)
    )
    request = result.scalar_one_or_none()
    if not request:
        raise HTTPException(status_code=404, detail="Content request not found")
    if request.status == "generating":
        raise HTTPException(
            status_code=409,
            detail=(
                "Cannot delete a request that is currently generating. "
                "Wait for it to complete or fail, then retry the delete."
            ),
        )
    await db.delete(request)


@router.post("/content/{request_id}/feedback", response_model=AIContentResponse)
async def submit_feedback(
    request_id: uuid.UUID,
    body: AIContentFeedback,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(AIContentRequest).where(AIContentRequest.id == request_id)
    )
    request = result.scalar_one_or_none()
    if not request:
        raise HTTPException(status_code=404, detail="Content request not found")

    request.rating = body.rating
    request.feedback_note = body.feedback_note
    await db.flush()
    await db.refresh(request)
    return AIContentResponse.model_validate(request)


# ═══ HELPERS ═════════════════════════════════════════════════

def _compile_system_prompt(
    tone_descriptors: list | None,
    vocabulary_preferences: dict | None,
    example_pieces: list | None,
    guardrails: list | None,
    client_name: str | None,
) -> str:
    """Compile brand voice attributes into a system prompt for Claude."""
    parts = ["You are a content writer for a social media agency."]

    if client_name:
        parts.append(f"You are writing for the client: {client_name}.")

    if tone_descriptors:
        parts.append(f"Your tone should be: {', '.join(tone_descriptors)}.")

    if vocabulary_preferences:
        use_words = vocabulary_preferences.get("use", [])
        avoid_words = vocabulary_preferences.get("avoid", [])
        if use_words:
            parts.append(f"Preferred vocabulary: {', '.join(use_words)}.")
        if avoid_words:
            parts.append(f"Avoid these words/phrases: {', '.join(avoid_words)}.")

    if example_pieces:
        parts.append("Here are examples of the desired writing style:")
        for i, piece in enumerate(example_pieces[:5], 1):
            parts.append(f"Example {i}: {piece}")

    if guardrails:
        parts.append("Important guidelines:")
        for g in guardrails:
            parts.append(f"- {g}")

    return "\n\n".join(parts)
