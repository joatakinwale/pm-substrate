"""Internal social endpoints — called by the stevie-social-publisher and
stevie-social-cron Cloudflare Workers.

Worker flows:
  - social-publisher (queue consumer):
      1. Worker pulls a SocialPublishMessage off the stevie-social-publisher queue.
      2. Worker POSTs ``/internal/social/posts/{post_id}/publish`` body
         ``{org_id, expected_content_hash}``. We verify the hash captured
         at scheduling time, dispatch to the right platform publisher
         (Meta/LinkedIn/X/etc), refresh tokens if needed, persist the
         result on the SocialPost row, and log an Activity entry — all
         under RLS.
  - social-cron (scheduled handler, two cron triggers):
      1. Hourly (0 * * * *): Worker POSTs ``/internal/social/scheduled/sweep``
         body ``{}``. We scan every org for SocialPost rows whose
         ``scheduled_at`` is past, flip them to ``publishing``, and return
         the list of {post_id, org_id, expected_content_hash} entries the
         Worker will fan out to the social-publisher queue.
      2. Every 30 minutes (*/30 * * * *): Worker POSTs
         ``/internal/social/metrics/refresh`` body ``{}``. We refresh
         engagement metrics across all recently-published posts in-process
         (cross-org sweep — no fanout) and return a count summary.

Security: same shared-header pattern as ``app/api/internal/billing.py`` —
``X-Webhook-Secret`` must equal ``settings.webhook_secret``.

Why FastAPI does the actual work (rather than porting to TypeScript): the
platform-specific publishers (``app/services/social/``) are heavy Python
with platform SDKs, and ``token_refresh`` carries OAuth flow knowledge
per-platform. Porting both to TypeScript is a large rewrite for zero
behaviour change. The Worker stays a thin orchestrator over HTTP, same
split as ``automation-runner``.

Sync-vs-async note:
    The publisher and metrics code paths use sync SQLAlchemy
    (``Session(sync_engine)``) because the platform-publisher SDKs are
    sync and mutate ORM objects directly. This module is async (FastAPI)
    so we delegate the sync work to a worker thread via
    ``asyncio.to_thread(...)`` — the same pattern
    ``app/api/internal/automations.py`` uses.

    The per-post and metrics logic lives inline in this module — this
    endpoint is the source of truth for the social-publisher flow.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, HTTPException, Path
from pydantic import BaseModel, Field
from sqlalchemy import and_, or_, select, text
from sqlalchemy.orm import Session

from app.api.internal.webhooks import verify_webhook_secret
from app.db.database import get_db
from app.db.session import sync_engine
from app.models.social_media import SocialAccount, SocialPost
from app.models.virtual_agency import (
    VirtualAgencyEvent,
    VirtualAgencyTask,
    VirtualAgencyTaskStatus,
)
from app.services.social import (
    PublisherConfigError,
    PublisherError,
    UnknownPlatformError,
    get_publisher,
)
from app.services.social.token_refresh import RefreshError, refresh_if_needed
from app.services.virtual_agency import (
    AGENT_ANALYTICS,
    agent_task_handoff_idempotency_key,
    build_agent_task_dispatch,
)
from app.services.virtual_agency_orchestration import (
    DependencyNotSatisfiedError,
    ensure_dependencies_completed,
    post_has_metric_evidence,
    social_post_content_hash,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal/social", tags=["internal"])

_SHA256_PATTERN = r"^[0-9a-fA-F]{64}$"


# ── Schemas ──────────────────────────────────────────────────────


class SocialPublishBody(BaseModel):
    """Payload from the social-publisher Worker."""

    org_id: uuid.UUID = Field(
        description=(
            "Stevie organization UUID. Worker carries this from the original "
            "queue message; we use it to scope the lookup and to set RLS "
            "context on writes."
        )
    )
    expected_content_hash: str = Field(
        pattern=_SHA256_PATTERN,
        description=(
            "SHA-256 digest of the content-bearing SocialPost fields captured "
            "when the post was scheduled. The backend refuses to publish if "
            "the row has changed since that point."
        ),
    )


class SocialPublishResponse(BaseModel):
    """Terminal status the Worker keys its ack/retry decision on.

    The Worker treats 200 as ack, 4xx as PermanentError → ack (DLQ on
    next trip), 5xx as RetryableError. See the social-publisher README
    for the full retry taxonomy.
    """

    post_id: uuid.UUID
    status: str = Field(
        description="Terminal post status: 'published' or 'failed'."
    )
    platform_post_id: str | None = None


class ScheduledSweepBody(BaseModel):
    """Cron sweep parameters."""

    retry_stale_publishing_after_minutes: int = Field(
        default=30,
        ge=1,
        le=1440,
    )


class ScheduledPostItem(BaseModel):
    """One entry the Worker fans out to the social-publisher queue."""

    post_id: uuid.UUID
    org_id: uuid.UUID
    expected_content_hash: str = Field(pattern=_SHA256_PATTERN)


class ScheduledSweepResponse(BaseModel):
    posts: list[ScheduledPostItem] = Field(
        default_factory=list,
        description=(
            "One entry per post that just had its status flipped to "
            "'publishing'. The Worker enqueues each via the queue-producer "
            "Worker; ordering is not significant."
        ),
    )


class MetricsRefreshBody(BaseModel):
    """Empty body — the cron Worker carries no per-call parameters."""


class MetricsRefreshResponse(BaseModel):
    checked: int = Field(ge=0)
    updated: int = Field(ge=0)
    errored: int = Field(ge=0)
    virtual_agency_tasks: list[dict[str, Any]] = Field(default_factory=list)


# ── RLS helper ───────────────────────────────────────────────────


# Fixed system-actor user_id — same constant the billing / ai / video /
# automations internal endpoints use.
_SYSTEM_USER_ID = "00000000-0000-0000-0000-00000000aaaa"


def _set_rls_sync(db: Session, *, org_id: uuid.UUID) -> None:
    """Set Postgres session variables for RLS on a sync session.

    Mirrors ``app.db.database._set_rls_context`` but executes against a
    sync session — needed because the work below runs in a worker thread
    via ``asyncio.to_thread`` and re-uses the existing sync publishers.
    """
    db.execute(
        text("SELECT set_config('app.current_org_id', :org_id, true)"),
        {"org_id": str(org_id)},
    )
    db.execute(
        text("SELECT set_config('app.current_user_id', :user_id, true)"),
        {"user_id": _SYSTEM_USER_ID},
    )
    db.execute(
        text("SELECT set_config('app.current_user_role', :role, true)"),
        {"role": "system"},
    )


# ── Routes ───────────────────────────────────────────────────────


@router.post(
    "/posts/{post_id}/publish", response_model=SocialPublishResponse
)
async def publish_post_from_worker(
    post_id: Annotated[uuid.UUID, Path()],
    body: Annotated[SocialPublishBody, Body()],
    _: None = Depends(verify_webhook_secret),
) -> SocialPublishResponse:
    """Publish a social post via its target platform publisher.

    Returns 200 on terminal completion (success or failed — the Worker
    treats both as ack). 404 if the post/org pairing doesn't exist or the
    referenced SocialAccount is missing — those are PermanentErrors on the
    Worker side. 422 on unknown platform / publisher config errors (also
    permanent — these are config bugs, not transient blips). 5xx maps to
    RetryableError and CF Queues retries per ``max_retries=3``.

    We dispatch the sync execution helper via ``asyncio.to_thread`` to
    avoid blocking the event loop — the publisher SDKs (Meta/LinkedIn/X)
    are sync and can take several seconds per call.
    """
    result = await asyncio.to_thread(
        _publish_post_sync,
        post_id=post_id,
        org_id=body.org_id,
        expected_content_hash=body.expected_content_hash,
    )

    error = result.get("error")
    if error == "not_found":
        raise HTTPException(
            status_code=404,
            detail=f"SocialPost {post_id} not found for org {body.org_id}",
        )
    if error == "account_not_found":
        # 404 — the post exists but its SocialAccount is gone (DELETE'd
        # between enqueue and consume). We've already marked the post
        # failed in the DB; the Worker DLQs the message.
        raise HTTPException(
            status_code=404,
            detail=(
                f"SocialAccount for post {post_id} not found; post marked failed"
            ),
        )
    if error == "unknown_platform":
        # 422 — the platform string isn't registered. Permanent (config
        # bug). The post is already marked failed in the DB.
        raise HTTPException(
            status_code=422,
            detail=result.get("detail", "Unknown platform"),
        )
    if error == "config":
        # 422 — the publisher rejected this as un-retriable (e.g. missing
        # credentials). Permanent. The post is already marked failed.
        raise HTTPException(
            status_code=422,
            detail=result.get("detail", "Publisher configuration error"),
        )
    if error == "auth_refresh":
        # 422 — token refresh failed. Permanent for this post (the user
        # must re-auth); the post is already marked failed.
        raise HTTPException(
            status_code=422,
            detail=result.get("detail", "OAuth token refresh failed"),
        )
    if error == "content_hash_mismatch":
        # 409 — the queued publish request no longer matches the
        # scheduled/approved content identity. Permanent; the row has
        # already been marked failed for operator review.
        raise HTTPException(
            status_code=409,
            detail=result.get("detail", "Social post content hash mismatch"),
        )
    if error == "publish_failed":
        # 5xx — transient platform failure. The post error_message has
        # been persisted; the Worker retries.
        raise HTTPException(
            status_code=503,
            detail=result.get("detail", "Publisher transient failure"),
        )

    return SocialPublishResponse(
        post_id=post_id,
        status=result.get("status", "failed"),
        platform_post_id=result.get("platform_post_id"),
    )


@router.post(
    "/scheduled/sweep", response_model=ScheduledSweepResponse
)
async def sweep_scheduled_posts(
    body: Annotated[
        ScheduledSweepBody, Body()
    ] = ScheduledSweepBody(),
    _: None = Depends(verify_webhook_secret),
) -> ScheduledSweepResponse:
    """Find scheduled posts whose time has come, flip to 'publishing'.

    System-actor sweep — runs across ALL orgs in a single transaction. We
    use ``get_db`` (no RLS context) because the cron Worker is not acting
    on behalf of any one tenant; the alternative (a per-org loop) would
    be 100x the round-trips for the same result. RLS-bypass is safe here
    because:
      1. The endpoint is gated by ``verify_webhook_secret`` so only the
         Worker can call it.
      2. We only mutate ``SocialPost.status`` from 'scheduled' →
         'publishing' — no cross-tenant data leakage on read, and the
         only write surface is one column on rows whose status we just
         filtered on.

    Status flip and the returned payload list happen in the same
    transaction: if the commit fails, the Worker sees an error and the
    next cron tick retries those posts naturally. If the commit succeeds
    but the Worker crashes before enqueueing, stale 'publishing' rows are
    returned again after ``retry_stale_publishing_after_minutes``.
    """
    now = datetime.now(timezone.utc)
    stale_publishing_before = now - timedelta(
        minutes=body.retry_stale_publishing_after_minutes
    )
    posts: list[ScheduledPostItem] = []

    async for db in get_db():
        result = await db.execute(
            select(SocialPost).where(
                or_(
                    and_(
                        SocialPost.status == "scheduled",
                        SocialPost.scheduled_at <= now,
                    ),
                    and_(
                        SocialPost.status == "publishing",
                        SocialPost.updated_at <= stale_publishing_before,
                    ),
                )
            )
        )
        due = list(result.scalars().all())

        for post in due:
            if not _is_publish_sweep_candidate(
                post,
                now=now,
                stale_publishing_before=stale_publishing_before,
            ):
                continue
            expected_content_hash = post.scheduled_content_hash
            current_content_hash = social_post_content_hash(post)
            if (
                not expected_content_hash
                or current_content_hash != expected_content_hash
            ):
                post.status = "failed"
                post.error_message = "Social post content hash mismatch before publish sweep"
                logger.error(
                    "SocialPost %s content hash mismatch before publish sweep",
                    post.id,
                )
                continue
            post.status = "publishing"
            posts.append(
                ScheduledPostItem(
                    post_id=post.id,
                    org_id=post.org_id,
                    expected_content_hash=expected_content_hash,
                )
            )

        await db.flush()
        # ``get_db`` commits on successful exit, but we flush explicitly
        # so the status writes are visible before we return — a Worker
        # that immediately retries this endpoint must NOT see the same
        # posts a second time.

    logger.info(
        "Scheduled-post sweep: %d posts queued for publishing at %s",
        len(posts),
        now.isoformat(),
    )
    return ScheduledSweepResponse(posts=posts)


def _is_publish_sweep_candidate(
    post: SocialPost,
    *,
    now: datetime,
    stale_publishing_before: datetime,
) -> bool:
    if post.status == "scheduled":
        return post.scheduled_at is not None and post.scheduled_at <= now
    if post.status == "publishing":
        return post.updated_at <= stale_publishing_before
    return False


@router.post(
    "/metrics/refresh", response_model=MetricsRefreshResponse
)
async def refresh_engagement_metrics(
    body: Annotated[
        MetricsRefreshBody, Body()
    ] = MetricsRefreshBody(),
    _: None = Depends(verify_webhook_secret),
) -> MetricsRefreshResponse:
    """Refresh engagement metrics for recently-published posts.

    Cross-org sweep — runs in-process (no fanout) because metrics refresh
    is already an aggregate operation: we hit one platform API per post,
    and N concurrent Worker fetches against the same Meta/LinkedIn/X
    rate-limit bucket would just serialize behind the rate limiter
    anyway.

    We use ``asyncio.to_thread`` because the publisher SDK fetch_metrics
    calls are sync.
    """
    summary = await asyncio.to_thread(_refresh_metrics_sync)
    return MetricsRefreshResponse(**summary)


# ── Sync execution helpers ───────────────────────────────────────


def _publish_post_sync(
    *,
    post_id: uuid.UUID,
    org_id: uuid.UUID,
    expected_content_hash: str,
) -> dict[str, Any]:
    """Run a single-post publish under a sync DB session.

    Returns one of:
        {status: "published", platform_post_id: str | None}
        {status: "failed", platform_post_id: None}
        {error: "not_found" | "account_not_found" | "unknown_platform" |
                "config" | "auth_refresh" | "content_hash_mismatch" |
                "publish_failed", detail?: str}

    Errors are surfaced with descriptive ``detail`` strings; the FastAPI
    handler turns these into the right HTTP status code.
    """
    with Session(sync_engine) as db:
        # Apply RLS system-actor context — every read/write below goes
        # through RLS scoped to ``org_id``.
        _set_rls_sync(db, org_id=org_id)

        post = db.get(SocialPost, post_id)
        if not post:
            logger.error("SocialPost %s not found", post_id)
            return {"error": "not_found"}

        # Cross-org guard — defensive against a stale queue message
        # carrying a different org's id. The Worker validates this at
        # enqueue time but we can't trust the network.
        if post.org_id != org_id:
            logger.error(
                "SocialPost %s belongs to org %s, not %s — refusing",
                post_id, post.org_id, org_id,
            )
            return {"error": "not_found"}

        if (
            post.scheduled_content_hash != expected_content_hash
            or social_post_content_hash(post) != expected_content_hash
        ):
            logger.error(
                "SocialPost %s content hash mismatch — expected=%s scheduled=%s",
                post_id,
                expected_content_hash,
                post.scheduled_content_hash,
            )
            post.status = "failed"
            post.error_message = "Social post content hash mismatch before publish"
            db.commit()
            return {
                "error": "content_hash_mismatch",
                "detail": "Social post content hash mismatch before publish",
            }

        account = db.get(SocialAccount, str(post.social_account_id))
        if not account:
            logger.error("SocialAccount not found for post %s", post_id)
            post.status = "failed"
            post.error_message = "Social account not found"
            db.commit()
            return {"error": "account_not_found"}

        # Dispatch to platform publisher
        try:
            publisher = get_publisher(post.platform)
        except UnknownPlatformError as e:
            logger.error("%s", e)
            post.status = "failed"
            post.error_message = str(e)[:500]
            db.commit()
            return {"error": "unknown_platform", "detail": str(e)}

        # Refresh token if near expiry. Critical for Google (1h) and X (2h)
        # where a user's first publish of the day hits a dead token.
        try:
            did_refresh = refresh_if_needed(account, db)
            if did_refresh:
                logger.info(
                    "Refreshed %s token for account %s before publish",
                    post.platform, account.id,
                )
        except RefreshError as e:
            logger.error(
                "Token refresh failed for account %s: %s", account.id, e
            )
            post.status = "failed"
            post.error_message = f"auth: {e}"[:500]
            db.commit()
            return {"error": "auth_refresh", "detail": str(e)}

        logger.info(
            "Publishing to %s via account %s: '%s...'",
            post.platform,
            account.account_name,
            (post.caption or "")[:50],
        )

        try:
            result = publisher.publish(post, account)
        except PublisherConfigError as e:
            logger.error("Config error publishing post %s: %s", post_id, e)
            post.status = "failed"
            post.error_message = f"config: {e}"[:500]
            db.commit()
            return {"error": "config", "detail": str(e)}
        except PublisherError as e:
            # Transient — keep the post in 'publishing' state and bubble
            # up so the Worker retries. We persist the error_message so an
            # operator can see the latest failure even mid-retry.
            logger.warning(
                "Publisher error for post %s: %s — Worker will retry",
                post_id, e,
            )
            post.error_message = str(e)[:500]
            db.commit()
            return {"error": "publish_failed", "detail": str(e)}
        except Exception as e:
            # Defensive fallback — same shape as PublisherError so the
            # Worker treats it as retryable. The exception is logged with
            # a traceback for debugging.
            logger.exception("Unexpected failure publishing post %s", post_id)
            post.error_message = f"unexpected: {e}"[:500]
            db.commit()
            return {"error": "publish_failed", "detail": str(e)[:200]}

        # Persist result
        if result.success:
            post.status = "published"
            post.published_at = datetime.now(timezone.utc)
            post.platform_post_id = result.platform_post_id
            post.platform_url = result.platform_url
            post.published_content_hash = expected_content_hash
            post.error_message = None
            logger.info(
                "Published post %s to %s: platform_id=%s url=%s",
                post_id, post.platform,
                result.platform_post_id, result.platform_url,
            )
        else:
            post.status = "failed"
            post.error_message = (
                result.error or "unknown publish failure"
            )[:500]
            logger.error(
                "Publish returned success=False for post %s: %s",
                post_id, post.error_message,
            )

        db.commit()

        # Auto-log Activity record (best-effort — never fails the publish)
        if result.success:
            try:
                _log_publish_activity(db, post, account, result.platform_url)
            except Exception:
                logger.exception(
                    "Failed to log publish activity for post %s", post_id
                )

        return {
            "status": post.status,
            "platform_post_id": post.platform_post_id,
        }


def _log_publish_activity(
    db: Session,
    post: SocialPost,
    account: SocialAccount,
    platform_url: str | None,
) -> None:
    """Emit an Activity row so the dashboard/feed shows the publish event.

    We import Activity lazily because the Activity schema has churned in
    the past and we don't want an import failure to block publishes.
    """
    try:
        from app.models.activity import (
            Activity,
            ActivityCategory,
            ActivityType,
        )
    except Exception:
        logger.debug("Activity model not importable — skipping activity log")
        return

    summary_body = (post.caption or "").strip()[:120]
    activity = Activity(
        org_id=post.org_id,
        category=ActivityCategory.project.value,
        activity_type=ActivityType.content_published.value,
        subject_type="project" if post.project_id else "social_post",
        subject_id=post.project_id or post.id,
        related_type="social_post" if post.project_id else None,
        related_id=post.id if post.project_id else None,
        title=(
            f"Published to {post.platform.title()} — {account.account_name}"
        ),
        description=summary_body or None,
        is_system=True,
        is_client_visible=False,
        metadata_={
            "platform": post.platform,
            "platform_url": platform_url,
            "platform_post_id": post.platform_post_id,
            "account_name": account.account_name,
            "compound_phase": post.compound_phase,
        },
    )
    db.add(activity)
    db.commit()


def _refresh_metrics_sync() -> dict[str, Any]:
    """Refresh engagement metrics across all recently-published posts.

    Cross-org sweep — no per-org RLS context. Mutations are limited to
    the engagement columns (likes, comments, shares, impressions, reach,
    engagement_rate) of posts we just read.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)

    with Session(sync_engine) as db:
        recent = db.execute(
            select(SocialPost).where(
                and_(
                    SocialPost.status == "published",
                    SocialPost.platform_post_id.isnot(None),
                    SocialPost.published_at.isnot(None),
                    SocialPost.published_at >= cutoff,
                )
            ).limit(500)
        ).scalars().all()

        updated = 0
        errored = 0
        updated_project_ids: set[uuid.UUID] = set()
        for post in recent:
            account = db.get(SocialAccount, str(post.social_account_id))
            if not account:
                continue

            try:
                publisher = get_publisher(post.platform)
                metrics = publisher.fetch_metrics(post, account)
            except UnknownPlatformError:
                continue
            except (PublisherError, PublisherConfigError) as e:
                logger.warning(
                    "metrics fetch failed for post %s (%s): %s",
                    post.id, post.platform, e,
                )
                errored += 1
                continue
            except Exception:
                logger.exception(
                    "unexpected error refreshing metrics for post %s",
                    post.id,
                )
                errored += 1
                continue

            # Only write back if we got something non-zero — avoids
            # clobbering last-known-good data when the platform API
            # silently returns empty (e.g. insights not yet available).
            if any([
                metrics.likes, metrics.comments, metrics.shares,
                metrics.impressions, metrics.reach,
            ]):
                post.likes = metrics.likes
                post.comments = metrics.comments
                post.shares = metrics.shares
                post.impressions = metrics.impressions
                post.reach = metrics.reach
                rate = metrics.engagement_rate
                if rate is not None:
                    post.engagement_rate = rate
                updated += 1
                if post.project_id is not None:
                    updated_project_ids.add(post.project_id)

        virtual_agency_tasks = _dispatch_ready_analytics_tasks_sync(
            db,
            project_ids=updated_project_ids,
        )
        db.commit()

    return {
        "checked": len(recent),
        "updated": updated,
        "errored": errored,
        "virtual_agency_tasks": virtual_agency_tasks,
    }


def _dispatch_ready_analytics_tasks_sync(
    db: Session,
    *,
    project_ids: set[uuid.UUID],
) -> list[dict[str, Any]]:
    if not project_ids:
        return []
    result = db.execute(
        select(VirtualAgencyTask).where(
            VirtualAgencyTask.project_id.in_(project_ids),
            VirtualAgencyTask.agent_role == AGENT_ANALYTICS,
            VirtualAgencyTask.task_type == "analytics_reporting",
            VirtualAgencyTask.status == VirtualAgencyTaskStatus.todo.value,
            VirtualAgencyTask.approval_active.is_(True),
        )
    )
    messages: list[dict[str, Any]] = []
    for task in result.scalars().all():
        try:
            ensure_dependencies_completed(task.dependencies or [])
            if not _project_has_metric_evidence_sync(db, task.project_id):
                raise DependencyNotSatisfiedError(
                    "Analytics task requires published social metrics evidence"
                )
        except DependencyNotSatisfiedError:
            continue
        message_idempotency_key = agent_task_handoff_idempotency_key(task)
        existing_event = db.execute(
            select(VirtualAgencyEvent).where(
                VirtualAgencyEvent.idempotency_key
                == f"handoff:{message_idempotency_key}"
            )
        ).scalar_one_or_none()
        if existing_event is not None:
            continue
        dispatch = build_agent_task_dispatch(
            task=task,
            actor_id="system:metrics-refresh",
            idempotency_key=message_idempotency_key,
        )
        db.add(dispatch["event"])
        messages.append(dispatch["message"])
    return messages


def _project_has_metric_evidence_sync(db: Session, project_id: uuid.UUID) -> bool:
    result = db.execute(
        select(SocialPost).where(
            SocialPost.project_id == project_id,
            SocialPost.status == "published",
            SocialPost.published_at.isnot(None),
        )
    )
    return any(post_has_metric_evidence(post) for post in result.scalars().all())
