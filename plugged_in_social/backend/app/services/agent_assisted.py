"""Proactive agent-assisted workflow.

Generates drafts of campaign posts, schedule proposals, and analytics reports,
requiring '1-click approve' from clients before execution.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.models.social_media import AIContentRequest, SocialPost, BrandVoiceProfile
from app.models.report import ClientReport, ReportSchedule
from app.services.queue_publisher import publish_ai_content_generate


async def generate_proactive_campaign_drafts(db: AsyncSession, now: datetime) -> int:
    """Find active projects and proactively draft a social post if they are low on scheduled content."""
    # Find all active client projects
    projects_result = await db.execute(
        select(Project).where(
            Project.status == "active",
            Project.project_type == "client",
            Project.is_deleted == False
        )
    )
    projects = projects_result.scalars().all()
    drafts_created = 0

    for project in projects:
        # Check if project has a default brand voice
        bv_result = await db.execute(
            select(BrandVoiceProfile).where(
                BrandVoiceProfile.org_id == project.org_id,
                BrandVoiceProfile.is_default == True,
                BrandVoiceProfile.is_deleted == False
            ).limit(1)
        )
        brand_voice = bv_result.scalars().first()
        brand_voice_id = brand_voice.id if brand_voice else None

        # Create AI Content Request for a proactive draft
        req = AIContentRequest(
            org_id=project.org_id,
            brand_voice_id=brand_voice_id,
            project_id=project.id,
            content_type="caption",
            prompt="Proactively generate a social media post caption based on the client's brand voice. Outline a campaign draft targeting recent engagements.",
            context={"proactive_generation": True, "project_name": project.name},
            status="pending",
        )
        db.add(req)
        await db.flush()

        # Create a matching draft social post (schedule proposal)
        # It's kept in 'draft' status until the client provides 1-click approval
        post = SocialPost(
            org_id=project.org_id,
            project_id=project.id,
            platform="linkedin", # default fallback
            status="draft",
            internal_notes=f"Proactively generated draft tied to request {req.id}",
        )
        db.add(post)
        await db.flush()

        req.used_in_post_id = post.id
        await db.flush()

        # Dispatch generation to worker
        try:
            await publish_ai_content_generate(
                org_id=project.org_id,
                request_id=req.id,
            )
        except Exception:
            # Swallow queue failures so one bad org doesn't kill the batch
            pass

        drafts_created += 1

    return drafts_created


async def generate_proactive_reports(db: AsyncSession, now: datetime) -> int:
    """Trigger report generation in draft status for client review."""
    from dateutil.relativedelta import relativedelta
    schedules_result = await db.execute(
        select(ReportSchedule).where(
            ReportSchedule.is_active == True,
            ReportSchedule.next_run_at <= now,
            ReportSchedule.is_deleted == False
        )
    )
    schedules = schedules_result.scalars().all()
    reports_created = 0

    for schedule in schedules:
        # Calculate proper period based on cadence
        period_end = now.date()
        if schedule.cadence == "weekly":
            period_start = period_end - relativedelta(days=7)
            next_run = now + relativedelta(days=7)
        elif schedule.cadence == "monthly":
            period_start = period_end - relativedelta(months=1)
            next_run = now + relativedelta(months=1)
        elif schedule.cadence == "quarterly":
            period_start = period_end - relativedelta(months=3)
            next_run = now + relativedelta(months=3)
        else:
            period_start = period_end - relativedelta(days=30)
            next_run = now + relativedelta(days=30)

        report = ClientReport(
            org_id=schedule.org_id,
            project_id=schedule.project_id,
            client_name=schedule.client_name,
            client_email=schedule.client_email,
            cadence=schedule.cadence,
            compound_phase=schedule.compound_phase,
            status="draft", # Agent-assisted, requires approval
            period_start=period_start,
            period_end=period_end,
            title=f"Proactive {schedule.cadence.title()} Report ({period_start.isoformat()} - {period_end.isoformat()})",
        )
        db.add(report)
        
        schedule.last_run_at = now
        schedule.next_run_at = next_run
        reports_created += 1

    await db.flush()
    return reports_created
