"""Bootstrap a deterministic autonomous agency monitor demo.

This script creates one local demo org/user plus a full agency kickoff run:
engagement -> marketing run -> implementation brief -> access requests ->
virtual-agency tasks -> approval/access decisions -> first agent dispatch.

It is intended for local operator verification of /admin/agency. It does not
mock the domain service; it uses the same service functions the API calls.

Usage:
    cd plugged_in_social/backend
    ALLOW_QUEUE_DROP=1 python scripts/bootstrap_agency_monitor_demo.py --print-token

Then start the frontend with the printed NEXT_PUBLIC_LOCAL_API_BEARER_TOKEN.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
import uuid
from datetime import timedelta
from pathlib import Path
from typing import Any

# Add backend/ to path so this script runs from anywhere.
BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv

load_dotenv(BACKEND_DIR / ".env")

# Local monitor demos should be able to create durable dispatch evidence without
# a Cloudflare Queue producer running.
os.environ.setdefault("ALLOW_QUEUE_DROP", "1")

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.auth.tokens import create_access_token
from app.core.config import get_settings
from app.models.agency import ClientEngagement, MarketingRun
from app.models.organization import Organization
from app.models.user import User
from app.models.virtual_agency import VirtualAgencyTask
from app.schemas.agency import (
    AgencyApprovalCreate,
    AgencyArtifactCreate,
    ClientEngagementCreate,
)
from app.services.agency_domain import (
    MarketingRunAccessGateError,
    approve_and_dispatch_marketing_run,
    create_agency_artifact,
    create_approval_request,
    create_client_engagement,
    decide_access_request,
    decide_approval_request,
    kickoff_marketing_run,
    start_marketing_run,
)
from app.services.virtual_agency import AGENT_COS


DEMO_ORG_ID = uuid.UUID("10000000-0000-4000-8000-000000000001")
DEMO_USER_ID = uuid.UUID("10000000-0000-4000-8000-000000000010")
DEMO_ORG_SLUG = "agency-monitor-demo"
DEMO_USER_EMAIL = "operator@agency-monitor-demo.local"
DEMO_ENGAGEMENT_NAME = "Agency Monitor Demo - Brightside Wellness"
DEMO_OBJECTIVE = "Build and launch a 30-day autonomous marketing campaign"


async def _ensure_org(db) -> Organization:
    org = await db.get(Organization, DEMO_ORG_ID)
    if org is not None:
        return org

    result = await db.execute(
        select(Organization).where(Organization.slug == DEMO_ORG_SLUG)
    )
    org = result.scalar_one_or_none()
    if org is not None:
        return org

    org = Organization(
        id=DEMO_ORG_ID,
        name="Agency Monitor Demo",
        slug=DEMO_ORG_SLUG,
        plan="pro",
        domain="agency-monitor-demo.local",
        settings={
            "timezone": "America/Chicago",
            "demo": {"source": "bootstrap_agency_monitor_demo.py"},
        },
        compound_method_defaults={
            "phases": ["protect", "deepen", "amplify"],
            "default_duration_weeks": 12,
        },
    )
    db.add(org)
    await db.flush()
    return org


async def _ensure_user(db, *, org: Organization) -> User:
    user = await db.get(User, DEMO_USER_ID)
    if user is not None:
        return user

    result = await db.execute(select(User).where(User.email == DEMO_USER_EMAIL))
    user = result.scalar_one_or_none()
    if user is not None:
        return user

    user = User(
        id=DEMO_USER_ID,
        org_id=org.id,
        email=DEMO_USER_EMAIL,
        full_name="Agency Monitor Operator",
        role="owner",
        permissions={"developer": True, "agency_monitor_demo": True},
    )
    db.add(user)
    await db.flush()
    return user


async def _find_demo_engagement(db, *, org_id: uuid.UUID) -> ClientEngagement | None:
    result = await db.execute(
        select(ClientEngagement).where(
            ClientEngagement.org_id == org_id,
            ClientEngagement.name == DEMO_ENGAGEMENT_NAME,
        )
    )
    return result.scalar_one_or_none()


async def _latest_run(db, *, engagement: ClientEngagement) -> MarketingRun | None:
    result = await db.execute(
        select(MarketingRun)
        .where(
            MarketingRun.org_id == engagement.org_id,
            MarketingRun.engagement_id == engagement.id,
        )
        .order_by(MarketingRun.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _create_demo_run(db, *, org: Organization, user: User) -> MarketingRun:
    engagement = await create_client_engagement(
        db,
        org_id=org.id,
        body=ClientEngagementCreate(
            name=DEMO_ENGAGEMENT_NAME,
            client_url="https://brightside-wellness.example",
            repo_url="https://github.com/example/brightside-wellness",
            client_name="Sarah Chen",
            client_email="sarah@brightside-wellness.example",
            goals=[
                "Increase qualified discovery calls",
                "Build trust with wellness founders",
                "Turn educational content into booked consultations",
            ],
            constraints=[
                "Client approval required before publishing",
                "Use existing brand voice and no medical claims",
            ],
            intake_payload={
                "offer": "Wellness brand growth audit",
                "copy_inputs": [
                    "Homepage",
                    "Sales deck",
                    "Existing Instagram captions",
                ],
                "competitors": [
                    "local wellness studios",
                    "boutique nutrition coaches",
                ],
            },
            integration_state={
                "analytics_provider": "umami",
                "preferred_social_channels": ["linkedin", "instagram"],
                "demo_key": "agency-monitor-demo.v1",
            },
        ),
        created_by_agent=AGENT_COS,
    )
    run = await start_marketing_run(
        db,
        engagement=engagement,
        objective=DEMO_OBJECTIVE,
    )
    kickoff = await kickoff_marketing_run(
        db,
        engagement=engagement,
        run=run,
        actor_id=str(user.id),
    )

    strategy_task = kickoff.tasks[0]
    strategy_artifact = await create_agency_artifact(
        db,
        org_id=org.id,
        engagement=engagement,
        body=AgencyArtifactCreate(
            marketing_run_id=run.id,
            virtual_agency_task_id=strategy_task.id,
            artifact_type="strategy_plan",
            title="Strategy plan: Brightside Wellness 30-day campaign",
            body=(
                "Position Brightside Wellness around practical founder wellness. "
                "Lead with educational LinkedIn posts, repurpose proof points for "
                "Instagram, and route interested founders to the growth audit."
            ),
            payload={
                "positioning": "Practical wellness systems for busy founders",
                "channels": ["linkedin", "instagram"],
                "content_pillars": [
                    "founder stress reduction",
                    "repeatable wellness routines",
                    "client proof and consultation prompts",
                ],
                "primary_conversion": "booked growth audit",
            },
            evidence_refs=[
                {
                    "kind": "url",
                    "id": "https://brightside-wellness.example",
                    "label": "Client platform URL",
                },
                {
                    "kind": "source_record",
                    "id": f"plugged_in_social:virtual_agency_tasks:{strategy_task.id}",
                    "label": "Chief of Staff strategy task",
                },
            ],
            lineage={
                "marketing_run_id": str(run.id),
                "virtual_agency_task_id": str(strategy_task.id),
            },
            author_role=AGENT_COS,
        ),
    )
    approval = await create_approval_request(
        db,
        org_id=org.id,
        engagement=engagement,
        body=AgencyApprovalCreate(
            marketing_run_id=run.id,
            approval_type="strategy",
            subject_type="agency_artifact",
            subject_id=strategy_artifact.id,
            reason="Approve the strategy artifact before agent dispatch.",
            approval_payload={
                "artifact_id": str(strategy_artifact.id),
                "artifact_payload_hash": strategy_artifact.payload_hash,
            },
        ),
    )
    await decide_approval_request(
        db,
        approval=approval,
        decision="approved",
        decided_by_user_id=user.id,
        decision_note="Local monitor demo approval.",
    )
    for access_request in kickoff.access_requests:
        await decide_access_request(
            db,
            access_request=access_request,
            decision="granted",
            resolved_by_user_id=user.id,
            decision_note="Local monitor demo access grant.",
            resolution_payload={
                "credential_ref": f"local-demo:{access_request.provider}",
                "read_only": True,
            },
        )

    try:
        await approve_and_dispatch_marketing_run(
            db,
            engagement=engagement,
            run=run,
            actor_id=str(user.id),
        )
    except MarketingRunAccessGateError:
        # This should not happen because the script grants the kickoff access
        # requests first. Keep the run available for inspection if local data was
        # edited between steps.
        pass

    await db.flush()
    return run


async def _task_count(db, *, run: MarketingRun) -> int:
    if run.project_id is None:
        return 0
    result = await db.execute(
        select(VirtualAgencyTask).where(VirtualAgencyTask.project_id == run.project_id)
    )
    return len(
        [
            task
            for task in result.scalars().all()
            if str((task.lineage or {}).get("marketing_run_id") or "") == str(run.id)
        ]
    )


def _token_for(user: User) -> str:
    return create_access_token(
        {
            "sub": str(user.id),
            "org_id": str(user.org_id),
            "role": user.role,
            "email": user.email,
        },
        expires_delta=timedelta(hours=12),
    )


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--print-token",
        action="store_true",
        help="Print a local bearer token for the demo user.",
    )
    args = parser.parse_args()

    settings = get_settings()
    engine = create_async_engine(settings.database_url, future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as db:
        org = await _ensure_org(db)
        user = await _ensure_user(db, org=org)
        engagement = await _find_demo_engagement(db, org_id=org.id)
        if engagement is None:
            run = await _create_demo_run(db, org=org, user=user)
            engagement = await _find_demo_engagement(db, org_id=org.id)
            created = True
        else:
            run = await _latest_run(db, engagement=engagement)
            if run is None:
                run = await _create_demo_run(db, org=org, user=user)
                created = True
            else:
                created = False
        await db.commit()

        token = _token_for(user)
        tasks = await _task_count(db, run=run)
        status = "created" if created else "already present"
        print(f"Agency monitor demo {status}.")
        print(f"  org_id: {org.id}")
        print(f"  user_id: {user.id}")
        print(f"  engagement_id: {engagement.id if engagement else run.engagement_id}")
        print(f"  marketing_run_id: {run.id}")
        print(f"  task_count: {tasks}")
        print("  frontend_url: /admin/agency")
        if args.print_token:
            print("")
            print("Local frontend env:")
            print(f"  NEXT_PUBLIC_LOCAL_API_BEARER_TOKEN={token}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
