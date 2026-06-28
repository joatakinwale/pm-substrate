"""Lead scoring API — 4-component weighted scoring engine.

Ported from coldCallAutomated's EnhancedLeadScoringService.
Provides per-lead score calculation, history, and per-org config.
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user, get_db_with_rls_dep
from app.models.lead import Lead
from app.models.lead_score import DEFAULT_WEIGHTS, LeadScore, ScoringConfig
from app.schemas.lead_scores import (
    LeadScoreResponse,
    ScoreRecalcRequest,
    ScoringConfigCreate,
    ScoringConfigResponse,
    ScoringConfigUpdate,
)

router = APIRouter(prefix="/scoring", tags=["scoring"])


# ═══ Lead Scores ════════════════════════════════════════════

@router.get("/leads/{lead_id}", response_model=LeadScoreResponse)
async def get_lead_score(
    lead_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Get the latest score for a lead."""
    result = await db.execute(
        select(LeadScore)
        .where(LeadScore.lead_id == lead_id)
        .order_by(LeadScore.scored_at.desc())
        .limit(1)
    )
    score = result.scalar_one_or_none()
    if not score:
        raise HTTPException(status_code=404, detail="No score found for this lead")
    return LeadScoreResponse.model_validate(score)


@router.get("/leads/{lead_id}/history", response_model=list[LeadScoreResponse])
async def get_lead_score_history(
    lead_id: uuid.UUID,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Get score history for a lead (newest first)."""
    result = await db.execute(
        select(LeadScore)
        .where(LeadScore.lead_id == lead_id)
        .order_by(LeadScore.scored_at.desc())
        .limit(limit)
    )
    scores = result.scalars().all()
    return [LeadScoreResponse.model_validate(s) for s in scores]


@router.post("/leads/{lead_id}/recalculate", response_model=LeadScoreResponse)
async def recalculate_lead_score(
    lead_id: uuid.UUID,
    body: ScoreRecalcRequest = ScoreRecalcRequest(),
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Recalculate a lead's score using the active scoring config.

    This creates a new LeadScore snapshot. The algorithm:
    1. Load the active ScoringConfig for this org (or use defaults)
    2. Gather signals: lead demographics, engagement events, behavioral data
    3. Score each component (0-100)
    4. Apply weights to get composite score
    5. Determine confidence level based on data completeness
    6. Generate recommended actions
    """
    org_id = uuid.UUID(current_user["org_id"])

    # Verify lead exists
    lead_result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = lead_result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    # Load active scoring config
    config_result = await db.execute(
        select(ScoringConfig).where(
            ScoringConfig.is_active == True
        ).limit(1)
    )
    config = config_result.scalar_one_or_none()
    weights = config.weights if config else DEFAULT_WEIGHTS

    # ── Demographic scoring ──────────────────────────────────
    demo_score = 0.0
    demo_breakdown = {}
    data_points = 0
    total_points = 5  # company, revenue, email, phone, website

    if lead.company:
        demo_score += 20
        data_points += 1
        demo_breakdown["company"] = {"value": lead.company, "score": 20}

    if lead.revenue_range:
        revenue_scores = {
            "under_100k": 20, "100k_500k": 40, "500k_1m": 60,
            "1m_5m": 80, "5m_10m": 90, "over_10m": 100,
        }
        rev_score = revenue_scores.get(lead.revenue_range, 30)
        demo_score += rev_score * 0.4
        data_points += 1
        demo_breakdown["revenue_range"] = {"value": lead.revenue_range, "score": rev_score}

    if lead.email:
        demo_score += 15
        data_points += 1
    if lead.phone:
        demo_score += 10
        data_points += 1
    if lead.website:
        demo_score += 10
        data_points += 1

    demo_score = min(demo_score, 100)

    # ── Engagement scoring ───────────────────────────────────
    # Count activities for this lead in the last 30 days
    from app.models.activity import Activity
    from datetime import timedelta

    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    activity_count = (await db.execute(
        select(func.count()).select_from(Activity).where(
            Activity.subject_type == "lead",
            Activity.subject_id == lead_id,
            Activity.occurred_at >= cutoff,
        )
    )).scalar() or 0

    engagement_score = min(activity_count * 15, 100)  # 15 pts per activity, cap at 100
    engagement_breakdown = {"activities_30d": {"value": activity_count, "score": engagement_score}}

    # ── Behavioral scoring ───────────────────────────────────
    behavioral_score = 0.0
    behavioral_breakdown = {}

    # Check for proposal views
    if lead.qualification_status == "qualified":
        behavioral_score += 40
        behavioral_breakdown["qualified"] = {"value": True, "score": 40}
    elif lead.qualification_status == "reviewing":
        behavioral_score += 20
        behavioral_breakdown["reviewing"] = {"value": True, "score": 20}

    # Form responses richness
    if lead.form_responses:
        response_count = len(lead.form_responses) if isinstance(lead.form_responses, dict) else 0
        form_score = min(response_count * 10, 40)
        behavioral_score += form_score
        behavioral_breakdown["form_responses"] = {"value": response_count, "score": form_score}

    behavioral_score = min(behavioral_score, 100)

    # ── Historical scoring ───────────────────────────────────
    # Based on source quality and conversion patterns
    historical_score = 50.0  # Base score
    historical_breakdown = {}

    source_scores = {
        "referral": 90, "organic": 70, "website": 60,
        "social_media": 50, "paid_ad": 40, "cold_outreach": 30,
    }
    if lead.source:
        src_score = source_scores.get(lead.source, 50)
        historical_score = src_score
        historical_breakdown["source"] = {"value": lead.source, "score": src_score}

    # ── Composite score ──────────────────────────────────────
    total_score = (
        demo_score * weights.get("demographic", 0.25)
        + engagement_score * weights.get("engagement", 0.35)
        + behavioral_score * weights.get("behavioral", 0.25)
        + historical_score * weights.get("historical", 0.15)
    )

    # Confidence based on data completeness
    completeness = data_points / total_points
    if completeness >= 0.7:
        confidence = "high"
    elif completeness >= 0.3:
        confidence = "medium"
    else:
        confidence = "low"

    # Recommended actions
    actions = []
    if engagement_score < 30:
        actions.append("Schedule follow-up call or email")
    if demo_score < 50:
        actions.append("Gather more company information")
    if behavioral_score < 30:
        actions.append("Send case study or proposal")
    if total_score >= 70:
        actions.append("Prioritize for outreach — hot lead")

    # Create score snapshot
    lead_score = LeadScore(
        org_id=org_id,
        lead_id=lead_id,
        total_score=round(total_score, 1),
        confidence=confidence,
        demographic_score=round(demo_score, 1),
        engagement_score=round(engagement_score, 1),
        behavioral_score=round(behavioral_score, 1),
        historical_score=round(historical_score, 1),
        weights=weights,
        breakdown={
            "demographic": demo_breakdown,
            "engagement": engagement_breakdown,
            "behavioral": behavioral_breakdown,
            "historical": historical_breakdown,
        },
        recommended_actions=actions,
        algorithm_version=config.algorithm_version if config else "1.0",
        trigger=body.trigger,
    )
    db.add(lead_score)
    await db.flush()
    await db.refresh(lead_score)
    return LeadScoreResponse.model_validate(lead_score)


# ═══ Scoring Config ═════════════════════════════════════════

@router.get("/config", response_model=list[ScoringConfigResponse])
async def list_scoring_configs(
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(ScoringConfig).order_by(ScoringConfig.created_at.desc())
    )
    configs = result.scalars().all()
    return [ScoringConfigResponse.model_validate(c) for c in configs]


@router.post("/config", response_model=ScoringConfigResponse, status_code=201)
async def create_scoring_config(
    body: ScoringConfigCreate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    org_id = uuid.UUID(current_user["org_id"])

    # Validate weights sum to ~1.0
    weight_sum = sum(body.weights.values())
    if abs(weight_sum - 1.0) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Weights must sum to 1.0, got {weight_sum}",
        )

    config = ScoringConfig(
        org_id=org_id,
        name=body.name,
        weights=body.weights,
        demographic_brackets=body.demographic_brackets,
        engagement_rules=body.engagement_rules,
        behavioral_rules=body.behavioral_rules,
        thresholds=body.thresholds,
    )
    db.add(config)
    await db.flush()
    await db.refresh(config)
    return ScoringConfigResponse.model_validate(config)


@router.patch("/config/{config_id}", response_model=ScoringConfigResponse)
async def update_scoring_config(
    config_id: uuid.UUID,
    body: ScoringConfigUpdate,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(ScoringConfig).where(ScoringConfig.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        if field == "weights" and value:
            weight_sum = sum(value.values())
            if abs(weight_sum - 1.0) > 0.01:
                raise HTTPException(
                    status_code=400,
                    detail=f"Weights must sum to 1.0, got {weight_sum}",
                )
        setattr(config, field, value)

    await db.flush()
    await db.refresh(config)
    return ScoringConfigResponse.model_validate(config)
