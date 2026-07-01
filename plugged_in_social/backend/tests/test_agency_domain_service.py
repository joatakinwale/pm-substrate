from __future__ import annotations

import uuid
from collections import defaultdict

import pytest

from app.models.agency import (
    AgencyAccessRequest,
    AgencyApprovalRequest,
    AgencyArtifact,
    ClientEngagement,
    MarketingRun,
)
from app.schemas.agency import (
    AgencyAccessRequestCreate,
    AgencyApprovalCreate,
    AgencyArtifactCreate,
    ClientEngagementCreate,
)


class _FakeAgencySession:
    def __init__(self):
        self._store: dict[type[object], dict[uuid.UUID, object]] = defaultdict(dict)
        self.flush_count = 0

    def add(self, obj):
        if getattr(obj, "id", None) is None:
            obj.id = uuid.uuid4()
        self._store[type(obj)][obj.id] = obj

    async def flush(self):
        self.flush_count += 1

    async def get(self, model, item_id):
        return self._store.get(model, {}).get(item_id)


@pytest.mark.asyncio
async def test_create_engagement_and_marketing_run():
    from app.services.agency_domain import create_client_engagement, start_marketing_run

    db = _FakeAgencySession()
    org_id = uuid.uuid4()

    engagement = await create_client_engagement(
        db,
        org_id=org_id,
        body=ClientEngagementCreate(
            name="Acme",
            client_url="https://example.com",
            goals=["increase qualified leads"],
            constraints=["approval required before publishing"],
        ),
        created_by_agent="chief_of_staff",
    )
    run = await start_marketing_run(
        db,
        engagement=engagement,
        objective="Build a 30-day launch strategy",
    )

    assert engagement.org_id == org_id
    assert engagement.status == "intake"
    assert engagement.name == "Acme"
    assert engagement.goals == ["increase qualified leads"]
    assert run.org_id == org_id
    assert run.engagement_id == engagement.id
    assert run.stage == "intake"
    assert run.objective == "Build a 30-day launch strategy"
    assert db.flush_count == 2


@pytest.mark.asyncio
async def test_create_artifact_hashes_payload_and_lineage():
    from app.services.agency_domain import (
        create_agency_artifact,
        create_client_engagement,
        start_marketing_run,
    )

    db = _FakeAgencySession()
    org_id = uuid.uuid4()
    engagement = await create_client_engagement(
        db,
        org_id=org_id,
        body=ClientEngagementCreate(name="Acme"),
        created_by_agent="chief_of_staff",
    )
    run = await start_marketing_run(
        db,
        engagement=engagement,
        objective="Build a launch strategy",
    )

    artifact = await create_agency_artifact(
        db,
        org_id=org_id,
        engagement=engagement,
        body=AgencyArtifactCreate(
            marketing_run_id=run.id,
            artifact_type="research_brief",
            title="Research brief",
            payload={"positioning": "trust-first"},
            evidence_refs=[
                {"kind": "url", "id": "https://example.com", "label": "Homepage"}
            ],
            author_role="research_strategist",
        ),
    )

    assert artifact.payload_hash
    assert len(artifact.payload_hash) == 64
    assert artifact.lineage["engagement_id"] == str(engagement.id)
    assert artifact.lineage["marketing_run_id"] == str(run.id)
    assert artifact.evidence_refs[0]["label"] == "Homepage"


@pytest.mark.asyncio
async def test_create_approval_request_hashes_subject_payload():
    from app.services.agency_domain import (
        create_agency_artifact,
        create_approval_request,
        create_client_engagement,
        start_marketing_run,
    )

    db = _FakeAgencySession()
    org_id = uuid.uuid4()
    engagement = await create_client_engagement(
        db,
        org_id=org_id,
        body=ClientEngagementCreate(name="Acme"),
        created_by_agent="chief_of_staff",
    )
    run = await start_marketing_run(db, engagement=engagement, objective="Strategy")
    artifact = await create_agency_artifact(
        db,
        org_id=org_id,
        engagement=engagement,
        body=AgencyArtifactCreate(
            marketing_run_id=run.id,
            artifact_type="strategy_plan",
            title="Strategy",
            payload={"pillars": ["trust"]},
            author_role="strategy_director",
        ),
    )

    approval = await create_approval_request(
        db,
        org_id=org_id,
        engagement=engagement,
        body=AgencyApprovalCreate(
            marketing_run_id=run.id,
            approval_type="strategy",
            subject_type="agency_artifact",
            subject_id=artifact.id,
            reason="Approve strategy before production begins",
            approval_payload=artifact.payload,
        ),
    )

    assert approval.status == "pending"
    assert approval.approval_payload_hash
    assert len(approval.approval_payload_hash) == 64
    assert approval.subject_id == artifact.id


@pytest.mark.asyncio
async def test_create_access_request_records_visible_blocker():
    from app.services.agency_domain import create_access_request, create_client_engagement

    db = _FakeAgencySession()
    org_id = uuid.uuid4()
    engagement = await create_client_engagement(
        db,
        org_id=org_id,
        body=ClientEngagementCreate(name="Acme"),
        created_by_agent="chief_of_staff",
    )

    request = await create_access_request(
        db,
        org_id=org_id,
        engagement=engagement,
        body=AgencyAccessRequestCreate(
            request_type="analytics",
            provider="umami",
            scope={"website_id": "required"},
            reason="Metrics reporting needs analytics access",
            instructions={"action": "connect_umami"},
        ),
    )

    assert request.status == "requested"
    assert request.provider == "umami"
    assert request.scope == {"website_id": "required"}
    assert request.reason == "Metrics reporting needs analytics access"
