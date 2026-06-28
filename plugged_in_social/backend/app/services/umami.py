"""Umami Analytics sync — pull daily web metrics into ``analytics_daily``.

Why Umami: the agency owns the data, self-host-able, GDPR-friendly, and
the org owners like having the numbers in the dashboard without bouncing
out to GA4.

Per-org configuration lives on ``Organization.settings.umami``::

    {
        "umami": {
            "website_id": "xxxx-xxxx-xxxx",     # required
            "api_url":    "https://…",          # optional — override instance default
            "api_key":    "abcd…"               # optional — override instance default
        }
    }

If the org never set this up, the sync skips them cleanly — no error, no
empty rows. Instance defaults come from ``settings.umami_api_url`` /
``settings.umami_api_key`` so agencies that run one Umami instance for
every client don't have to paste the same key into every org.

The sync pulls **yesterday** (UTC) in a single window and upserts these
metrics per org:

    page_views          (scalar, dims={})
    unique_visitors     (scalar, dims={})
    bounce_rate         (percent 0-100, dims={})
    avg_session_duration (seconds, dims={})
    top_pages           (one row per URL, dims={"page": "/path"})
    referrer_breakdown  (one row per source, dims={"source": "host"})

Idempotent via ``INSERT ... ON CONFLICT DO UPDATE`` on the natural unique
key ``(org_id, date, metric_type, dimensions)``. A manual re-run
overwrites rather than duplicates.

Designed to be wrapped in a per-org savepoint by the cron driver: one
bad website ID (Umami returns 404) must not kill the whole sync cohort.
"""
from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import AnalyticsDaily, Organization

logger = logging.getLogger(__name__)


# ── Constants ─────────────────────────────────────────────

# How many top-N rows we keep per breakdown metric. Umami can return
# thousands of URLs on a busy site — the dashboard only renders 10-20 so
# storing more than this is dead weight.
_TOP_N_DEFAULT = 25

# Per-request timeout — Umami is typically fast, but a self-hosted
# instance under pressure can hang. The cron driver budget is tight.
_HTTP_TIMEOUT = httpx.Timeout(15.0)


class UmamiConfig:
    """Resolved Umami config for a single org.

    Merges instance-level defaults with per-org overrides from
    ``Organization.settings.umami``. ``website_id`` has no default — if
    the org hasn't set one, ``is_configured`` is ``False`` and the sync
    skips cleanly.
    """

    def __init__(
        self,
        *,
        api_url: str | None,
        api_key: str | None,
        website_id: str | None,
        username: str | None = None,
        password: str | None = None,
    ):
        self.api_url = (api_url or "").rstrip("/")
        self.api_key = api_key or ""
        self.website_id = website_id or ""
        # Username/password fallback for self-hosted Umami v3 which
        # doesn't expose the API Keys UI in the open-source build.
        self.username = username or ""
        self.password = password or ""

    @classmethod
    def for_org(cls, org: Organization) -> "UmamiConfig":
        inst = get_settings()
        org_umami: dict[str, Any] = (org.settings or {}).get("umami") or {}
        return cls(
            api_url=org_umami.get("api_url") or inst.umami_api_url,
            api_key=org_umami.get("api_key") or inst.umami_api_key,
            website_id=org_umami.get("website_id"),
            # Username/password is a per-instance fallback only — we
            # don't put admin creds in per-org overrides.
            username=inst.umami_username,
            password=inst.umami_password,
        )

    @property
    def is_configured(self) -> bool:
        # Either the API key path (Cloud / paid self-host) OR the
        # username+password path (open-source self-host) is enough.
        if not (self.api_url and self.website_id):
            return False
        return bool(self.api_key) or bool(self.username and self.password)


# ── HTTP client ───────────────────────────────────────────

class UmamiClient:
    """Thin async wrapper around the Umami v1 API.

    Only the endpoints we actually need for the daily sync — extend when
    a new metric comes up rather than pre-wiring the whole surface area.
    """

    def __init__(self, config: UmamiConfig):
        self.config = config
        # Cached JWT from the username/password login flow. Re-fetched
        # lazily on first call and on 401. Umami JWTs expire after 24h
        # by default; a 401 on a long-running process is the normal
        # signal to re-auth.
        self._jwt: str | None = None
        self._jwt_fetched_at: datetime | None = None

    async def _login(self, client: httpx.AsyncClient) -> str:
        """Exchange username/password for a JWT.

        Self-hosted Umami v3 hides the API Keys UI behind a paid feature
        flag, so the open-source instance only supports session login.
        We POST to ``/api/auth/login`` and cache the returned token.
        Raises if the credentials are missing or rejected.
        """
        if not (self.config.username and self.config.password):
            raise RuntimeError(
                "Umami client has no API key AND no username/password "
                "fallback — set UMAMI_API_KEY OR UMAMI_USERNAME + "
                "UMAMI_PASSWORD on the backend."
            )
        resp = await client.post(
            f"{self.config.api_url}/api/auth/login",
            json={
                "username": self.config.username,
                "password": self.config.password,
            },
        )
        resp.raise_for_status()
        token = resp.json().get("token")
        if not token:
            raise RuntimeError("Umami login returned no token")
        self._jwt = token
        self._jwt_fetched_at = datetime.now(timezone.utc)
        return token

    async def _bearer_token(self, client: httpx.AsyncClient) -> str:
        """Return whichever bearer credential we have.

        Prefers the static API key (Cloud / paid self-host). Falls
        back to JWT login (open-source self-host).
        """
        if self.config.api_key:
            return self.config.api_key
        if self._jwt:
            # Refresh proactively if older than 23h to avoid the next
            # call hitting a 401. Cheap to re-login.
            age = datetime.now(timezone.utc) - (
                self._jwt_fetched_at or datetime.now(timezone.utc)
            )
            if age.total_seconds() < 23 * 3600:
                return self._jwt
        return await self._login(client)

    async def _headers(self, client: httpx.AsyncClient) -> dict[str, str]:
        # Umami Cloud uses ``x-umami-api-key``. Self-hosted bearer
        # auth (whether static key or login JWT) goes in the
        # ``Authorization`` header. We send the API key in both
        # headers when we have one — Umami ignores the irrelevant
        # one — so operators don't have to know which build they're on.
        token = await self._bearer_token(client)
        headers: dict[str, str] = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        }
        if self.config.api_key:
            headers["x-umami-api-key"] = self.config.api_key
        return headers

    def _url(self, path: str) -> str:
        return f"{self.config.api_url}/api/websites/{self.config.website_id}{path}"

    async def get_stats(
        self,
        *,
        start_ms: int,
        end_ms: int,
        client: httpx.AsyncClient,
    ) -> dict[str, Any]:
        """``/stats`` returns aggregate counters for the window.

        Shape::

            {
              "pageviews": {"value": 123, "change": 5},
              "visitors":  {"value":  42, "change": 2},
              "visits":    {"value":  55, "change": 3},
              "bounces":   {"value":  20, "change": 1},
              "totaltime": {"value": 9876, "change": 12}   # seconds
            }
        """
        resp = await client.get(
            self._url("/stats"),
            params={"startAt": start_ms, "endAt": end_ms},
            headers=await self._headers(client),
        )
        resp.raise_for_status()
        return resp.json() or {}

    async def get_metrics(
        self,
        *,
        metric_type: str,
        start_ms: int,
        end_ms: int,
        limit: int,
        client: httpx.AsyncClient,
    ) -> list[dict[str, Any]]:
        """``/metrics?type=url|referrer|browser|...`` returns a top-N.

        Shape::

            [{"x": "/", "y": 120}, {"x": "/pricing", "y": 44}, ...]
        """
        resp = await client.get(
            self._url("/metrics"),
            params={
                "startAt": start_ms,
                "endAt": end_ms,
                "type": metric_type,
                "limit": limit,
            },
            headers=await self._headers(client),
        )
        resp.raise_for_status()
        data = resp.json()
        return data if isinstance(data, list) else []


# ── Upsert helpers ────────────────────────────────────────

async def _upsert_metric(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    snapshot_date: date,
    metric_type: str,
    value: float,
    dimensions: dict[str, Any] | None = None,
) -> None:
    """Insert or update one AnalyticsDaily row keyed on the natural UQ."""
    dims = dimensions or {}
    stmt = pg_insert(AnalyticsDaily).values(
        org_id=org_id,
        date=snapshot_date,
        metric_type=metric_type,
        value=float(value),
        dimensions=dims,
    ).on_conflict_do_update(
        constraint="uq_analytics_daily_org_date_metric_dims",
        set_={
            "value": float(value),
            "updated_at": datetime.now(timezone.utc),
        },
    )
    await db.execute(stmt)


# ── Per-org sync ──────────────────────────────────────────

async def sync_org_analytics(
    db: AsyncSession,
    org: Organization,
    *,
    snapshot_date: date | None = None,
    top_n: int = _TOP_N_DEFAULT,
) -> dict[str, Any]:
    """Pull one UTC day of Umami metrics for ``org`` and upsert to DB.

    ``snapshot_date`` defaults to yesterday (UTC) so a cron run at
    00:30 UTC captures a complete prior-day window. Pass an explicit
    date to backfill.

    Returns a dict describing what happened — useful for the cron
    response surface and for test assertions.
    """
    config = UmamiConfig.for_org(org)
    if not config.is_configured:
        return {
            "ok": True,
            "org_id": str(org.id),
            "org_name": org.name,
            "skipped": True,
            "reason": "umami_not_configured",
        }

    if snapshot_date is None:
        snapshot_date = (datetime.now(timezone.utc) - timedelta(days=1)).date()

    # Build [start, end] in UTC millis — the full day window.
    day_start = datetime.combine(snapshot_date, time.min, tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1) - timedelta(milliseconds=1)
    start_ms = int(day_start.timestamp() * 1000)
    end_ms = int(day_end.timestamp() * 1000)

    client = UmamiClient(config)

    metrics_written = 0
    result: dict[str, Any] = {
        "ok": True,
        "org_id": str(org.id),
        "org_name": org.name,
        "date": snapshot_date.isoformat(),
    }

    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as http:
            # 1) Aggregate counters
            stats = await client.get_stats(
                start_ms=start_ms, end_ms=end_ms, client=http,
            )

            pageviews = int((stats.get("pageviews") or {}).get("value") or 0)
            visitors = int((stats.get("visitors") or {}).get("value") or 0)
            visits = int((stats.get("visits") or {}).get("value") or 0)
            bounces = int((stats.get("bounces") or {}).get("value") or 0)
            totaltime = int((stats.get("totaltime") or {}).get("value") or 0)

            # Bounce rate: bounces / visits * 100, 0 when no sessions.
            bounce_rate = (bounces / visits * 100.0) if visits else 0.0
            # Avg session duration: totaltime / visits, in seconds.
            avg_session = (totaltime / visits) if visits else 0.0

            await _upsert_metric(
                db, org_id=org.id, snapshot_date=snapshot_date,
                metric_type="page_views", value=pageviews,
            )
            await _upsert_metric(
                db, org_id=org.id, snapshot_date=snapshot_date,
                metric_type="unique_visitors", value=visitors,
            )
            await _upsert_metric(
                db, org_id=org.id, snapshot_date=snapshot_date,
                metric_type="bounce_rate", value=round(bounce_rate, 2),
            )
            await _upsert_metric(
                db, org_id=org.id, snapshot_date=snapshot_date,
                metric_type="avg_session_duration", value=round(avg_session, 2),
            )
            metrics_written += 4

            # 2) Top pages — one AnalyticsDaily row per URL.
            top_pages = await client.get_metrics(
                metric_type="url",
                start_ms=start_ms, end_ms=end_ms,
                limit=top_n, client=http,
            )
            for entry in top_pages:
                page = str(entry.get("x") or "").strip()
                views = entry.get("y") or 0
                if not page:
                    continue
                await _upsert_metric(
                    db, org_id=org.id, snapshot_date=snapshot_date,
                    metric_type="top_pages", value=float(views),
                    dimensions={"page": page},
                )
                metrics_written += 1

            # 3) Referrer breakdown — one row per source.
            top_referrers = await client.get_metrics(
                metric_type="referrer",
                start_ms=start_ms, end_ms=end_ms,
                limit=top_n, client=http,
            )
            for entry in top_referrers:
                source = str(entry.get("x") or "").strip() or "(direct)"
                hits = entry.get("y") or 0
                await _upsert_metric(
                    db, org_id=org.id, snapshot_date=snapshot_date,
                    metric_type="referrer_breakdown", value=float(hits),
                    dimensions={"source": source},
                )
                metrics_written += 1

            result.update({
                "page_views": pageviews,
                "unique_visitors": visitors,
                "bounce_rate": round(bounce_rate, 2),
                "avg_session_duration": round(avg_session, 2),
                "top_pages_count": len(top_pages),
                "referrers_count": len(top_referrers),
                "metrics_written": metrics_written,
            })

    except httpx.HTTPStatusError as e:
        # 401/403 = bad key, 404 = wrong website_id. Surface cleanly so
        # the cron response tells the operator which org is misconfigured.
        logger.warning(
            "Umami sync HTTP %s for org %s: %s",
            e.response.status_code, org.id, e.response.text[:200],
        )
        result.update({
            "ok": False,
            "error": f"umami_http_{e.response.status_code}",
            "detail": e.response.text[:300],
        })
    except httpx.RequestError as e:
        logger.warning("Umami sync network error for org %s: %s", org.id, e)
        result.update({
            "ok": False,
            "error": "umami_network_error",
            "detail": str(e)[:300],
        })
    except Exception as e:
        logger.exception("Umami sync unexpected error for org %s", org.id)
        result.update({
            "ok": False,
            "error": "umami_unexpected_error",
            "detail": str(e)[:300],
        })

    return result


# ── Cohort sync (called from cron) ─────────────────────────

async def sync_all_orgs(
    db: AsyncSession,
    *,
    snapshot_date: date | None = None,
) -> dict[str, Any]:
    """Run ``sync_org_analytics`` for every active org with Umami wired up.

    Orgs without Umami config are skipped (not errors). Per-org failures
    are captured into ``results`` without blowing up the cohort — the
    cron endpoint wraps each org in a savepoint for the same reason.

    Returns an aggregate summary suitable for the cron response body.
    """
    org_rows = await db.execute(
        select(Organization).where(Organization.is_active == True)  # noqa: E712
    )
    orgs = org_rows.scalars().all()

    results: list[dict[str, Any]] = []
    synced = 0
    skipped = 0
    failed = 0

    for org in orgs:
        try:
            async with db.begin_nested():
                res = await sync_org_analytics(
                    db, org, snapshot_date=snapshot_date,
                )
        except Exception as e:
            logger.exception("Umami sync savepoint failed for org %s", org.id)
            res = {
                "ok": False,
                "org_id": str(org.id),
                "org_name": org.name,
                "error": "savepoint_rolled_back",
                "detail": str(e)[:300],
            }

        results.append(res)
        if res.get("skipped"):
            skipped += 1
        elif res.get("ok"):
            synced += 1
        else:
            failed += 1

    return {
        "ok": True,
        "orgs_total": len(orgs),
        "orgs_synced": synced,
        "orgs_skipped": skipped,
        "orgs_failed": failed,
        "results": results,
    }
