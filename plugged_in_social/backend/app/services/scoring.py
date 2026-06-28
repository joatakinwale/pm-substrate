"""Engagement & lead scoring.

Two scorers live here:

1. ``recompute_contact_engagement`` — walks every Contact in the org and
   recomputes ``Contact.engagement_score`` from EmailSend events in the
   last 60 days. Also sets ``Contact.last_engaged_at`` to the most recent
   open/click so the UI can show "last heard from X days ago."

2. ``recompute_lead_scores`` — walks every Lead in the org and assigns a
   qualification score (0-100) based on revenue range, form completeness,
   and pipeline stage. Cheap heuristic — not ML — but good enough to
   sort the intake queue for the agency.

Both functions are idempotent and safe to re-run on a schedule. The
cron endpoint calls them per-org; per-org keeps the transaction footprint
small and lets us resume if one org blows up.

Scoring weights are module-level constants so they're easy to tune.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Contact, Lead, Proposal
from app.models.email_campaign import EmailSend
from app.models.lead import QualificationStatus, RevenueRange

logger = logging.getLogger(__name__)


# ─── Engagement scoring config ──────────────────────────────
# Points per event, decayed by recency band. Chosen so a typical
# newsletter reader (1 open/week, 1 click/month) scores around 30-40;
# a hot prospect (opens every send + frequent clicks) tops 80-90.

_RECENT_WINDOW_DAYS = 30
_WARM_WINDOW_DAYS = 60

_OPEN_RECENT = 1.5
_OPEN_WARM = 0.75
_CLICK_RECENT = 4.0
_CLICK_WARM = 2.0
_BOUNCE_PENALTY = -8
_UNSUB_PENALTY = -30

ENGAGEMENT_MAX = 100
ENGAGEMENT_MIN = 0


async def recompute_contact_engagement(
    db: AsyncSession,
    *,
    org_id: uuid.UUID | None = None,
    now: datetime | None = None,
) -> int:
    """Recompute engagement scores for every Contact (optionally scoped
    to one org). Returns number of contacts updated.

    Runs as a single aggregation query per-band + a bulk update per
    contact — for an agency with a few thousand contacts this is a
    sub-second operation. We avoid loading all EmailSend rows into
    memory.
    """
    now = now or datetime.now(timezone.utc)
    recent_cutoff = now - timedelta(days=_RECENT_WINDOW_DAYS)
    warm_cutoff = now - timedelta(days=_WARM_WINDOW_DAYS)

    # Per-contact event counts, bucketed by recency and type.
    # We use filtered COUNTs on EmailSend timestamp columns — simple and
    # fast with the existing (campaign_id, contact_id) index.
    q = (
        select(
            EmailSend.contact_id.label("contact_id"),
            func.count(case(
                (EmailSend.opened_at >= recent_cutoff, 1),
                else_=None,
            )).label("opens_recent"),
            func.count(case(
                ((EmailSend.opened_at >= warm_cutoff)
                 & (EmailSend.opened_at < recent_cutoff), 1),
                else_=None,
            )).label("opens_warm"),
            func.count(case(
                (EmailSend.clicked_at >= recent_cutoff, 1),
                else_=None,
            )).label("clicks_recent"),
            func.count(case(
                ((EmailSend.clicked_at >= warm_cutoff)
                 & (EmailSend.clicked_at < recent_cutoff), 1),
                else_=None,
            )).label("clicks_warm"),
            func.count(case(
                (EmailSend.bounced_at.isnot(None), 1), else_=None,
            )).label("bounces"),
            func.count(case(
                (EmailSend.unsubscribed_at.isnot(None), 1), else_=None,
            )).label("unsubs"),
            func.max(func.greatest(
                func.coalesce(EmailSend.clicked_at, EmailSend.opened_at),
                func.coalesce(EmailSend.opened_at, EmailSend.clicked_at),
            )).label("last_engaged_at"),
        )
        .group_by(EmailSend.contact_id)
    )
    if org_id:
        q = q.where(EmailSend.org_id == org_id)

    event_rows = (await db.execute(q)).all()
    events_by_contact = {row.contact_id: row for row in event_rows}

    # Load only the contacts that have events OR currently have a non-zero
    # score (so decayed-to-zero contacts get reset correctly).
    contact_q = select(Contact)
    if org_id:
        contact_q = contact_q.where(Contact.org_id == org_id)

    result = await db.execute(contact_q)
    contacts = result.scalars().all()

    updated = 0
    for contact in contacts:
        row = events_by_contact.get(contact.id)
        if row is None:
            # No email events at all — leave at 0 (no decay below zero).
            if contact.engagement_score != 0 or contact.last_engaged_at is not None:
                contact.engagement_score = 0
                contact.last_engaged_at = None
                updated += 1
            continue

        score = (
            row.opens_recent * _OPEN_RECENT
            + row.opens_warm * _OPEN_WARM
            + row.clicks_recent * _CLICK_RECENT
            + row.clicks_warm * _CLICK_WARM
            + row.bounces * _BOUNCE_PENALTY
            + row.unsubs * _UNSUB_PENALTY
        )
        score_int = max(ENGAGEMENT_MIN, min(ENGAGEMENT_MAX, int(round(score))))

        if (
            contact.engagement_score != score_int
            or contact.last_engaged_at != row.last_engaged_at
        ):
            contact.engagement_score = score_int
            contact.last_engaged_at = row.last_engaged_at
            updated += 1

    logger.info(
        "recompute_contact_engagement: scored %d contacts (updated %d) for org=%s",
        len(contacts), updated, org_id,
    )
    return updated


# ─── Lead scoring config ────────────────────────────────────

_REVENUE_POINTS = {
    RevenueRange.R5M_PLUS.value: 30,
    RevenueRange.R1M_5M.value: 22,
    RevenueRange.R500K_1M.value: 15,
    RevenueRange.R100K_500K.value: 10,
    RevenueRange.UNDER_100K.value: 4,
}
_STAGE_POINTS = {
    QualificationStatus.NEW.value: 0,
    QualificationStatus.REVIEWING.value: 5,
    QualificationStatus.QUALIFIED.value: 15,
    QualificationStatus.CONVERTED.value: 30,
    QualificationStatus.DISQUALIFIED.value: -40,
}

LEAD_SCORE_MAX = 100
LEAD_SCORE_MIN = 0


def _score_lead(
    lead: Lead,
    *,
    now: datetime,
    proposal_count: int,
) -> int:
    """Pure scoring function — easy to unit test without a DB."""
    score = 0

    # Revenue
    score += _REVENUE_POINTS.get(lead.revenue_range or "", 0)

    # Pipeline stage
    score += _STAGE_POINTS.get(lead.qualification_status or "", 0)

    # Form completeness signals — leads who bothered to fill in phone +
    # website + company are meaningfully more qualified than bare signups.
    if lead.phone:
        score += 5
    if lead.website:
        score += 5
    if lead.company:
        score += 5
    form_answers = lead.form_responses or {}
    if isinstance(form_answers, dict) and len(form_answers) >= 5:
        score += 5

    # Recency — fresh leads (< 7 days) get a boost; stale (> 90 days) get
    # a penalty so the pipeline doesn't pile up on forgotten rows.
    if lead.created_at:
        age_days = (now - lead.created_at).days
        if age_days <= 7:
            score += 8
        elif age_days <= 30:
            score += 3
        elif age_days > 90:
            score -= 5

    # Proposals — every proposal sent is a signal they're active.
    score += min(proposal_count * 5, 15)

    # UTM / source signals — referrals outperform cold
    if lead.source == "referral":
        score += 10
    elif lead.source in {"instagram", "linkedin"}:
        score += 3

    return max(LEAD_SCORE_MIN, min(LEAD_SCORE_MAX, score))


async def recompute_lead_scores(
    db: AsyncSession,
    *,
    org_id: uuid.UUID | None = None,
    now: datetime | None = None,
) -> int:
    """Recompute ``Lead.score`` for every lead (optionally scoped to org).

    Uses a single JOIN query to count proposals per lead so we don't
    N+1 on large pipelines.
    """
    now = now or datetime.now(timezone.utc)

    # Count proposals per lead in one pass
    prop_q = select(
        Proposal.lead_id,
        func.count(Proposal.id).label("proposal_count"),
    ).where(Proposal.lead_id.isnot(None)).group_by(Proposal.lead_id)
    if org_id:
        prop_q = prop_q.where(Proposal.org_id == org_id)
    proposal_counts = {
        row.lead_id: row.proposal_count
        for row in (await db.execute(prop_q)).all()
    }

    lead_q = select(Lead)
    if org_id:
        lead_q = lead_q.where(Lead.org_id == org_id)
    leads = (await db.execute(lead_q)).scalars().all()

    updated = 0
    for lead in leads:
        new_score = _score_lead(
            lead,
            now=now,
            proposal_count=proposal_counts.get(lead.id, 0),
        )
        if lead.score != new_score:
            lead.score = new_score
            updated += 1

    logger.info(
        "recompute_lead_scores: scored %d leads (updated %d) for org=%s",
        len(leads), updated, org_id,
    )
    return updated
