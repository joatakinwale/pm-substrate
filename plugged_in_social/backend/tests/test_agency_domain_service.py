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
from app.models.project import Project
from app.models.virtual_agency import VirtualAgencyEvent, VirtualAgencyTask
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

    def get_by_id(self, model, item_id):
        return self._store.get(model, {}).get(item_id)

    def list_agency_access_requests_for_run(self, run_id):
        return [
            request
            for request in self._store.get(AgencyAccessRequest, {}).values()
            if request.marketing_run_id == run_id
        ]

    def list_virtual_tasks_for_marketing_run(self, run_id):
        return [
            task
            for task in self._store.get(VirtualAgencyTask, {}).values()
            if (task.lineage or {}).get("marketing_run_id") == str(run_id)
        ]

    def list_virtual_task_dependencies(self, task):
        return list(task.dependencies)

    def find_event_by_idempotency_key(self, idempotency_key):
        for event in self._store.get(VirtualAgencyEvent, {}).values():
            if event.idempotency_key == idempotency_key:
                return event
        return None


async def _capture_publish(monkeypatch):
    sent: list[dict] = []

    async def _fake_publish(*, queue, message):
        sent.append({"queue": queue, "message": message})

    monkeypatch.setattr("app.services.virtual_agency._publish", _fake_publish)
    return sent


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
async def test_kickoff_marketing_run_builds_autonomous_agency_workbreakdown():
    from app.services.agency_domain import (
        create_client_engagement,
        kickoff_marketing_run,
        start_marketing_run,
    )
    from app.services.virtual_agency import (
        AGENT_ANALYTICS,
        AGENT_COMMUNITY,
        AGENT_CONTENT,
        AGENT_COS,
        AGENT_SCHEDULING,
    )

    db = _FakeAgencySession()
    org_id = uuid.uuid4()

    engagement = await create_client_engagement(
        db,
        org_id=org_id,
        body=ClientEngagementCreate(
            name="Acme Launch",
            client_url="https://acme.example",
            repo_url="https://github.com/acme/app",
            client_name="Ada",
            client_email="ada@example.com",
            goals=["increase qualified demo bookings"],
            constraints=["client approval required before publishing"],
            intake_payload={
                "copy_inputs": ["homepage", "sales deck"],
                "offer": "AI implementation audit",
            },
            integration_state={
                "preferred_social_channels": ["linkedin"],
                "analytics_provider": "umami",
            },
        ),
        created_by_agent="chief_of_staff",
    )
    run = await start_marketing_run(
        db,
        engagement=engagement,
        objective="Build and launch an autonomous 30-day marketing campaign",
    )

    kickoff = await kickoff_marketing_run(
        db,
        engagement=engagement,
        run=run,
        actor_id="agent:chief_of_staff",
    )

    assert kickoff.project.id == engagement.project_id == run.project_id
    assert kickoff.artifact.artifact_type == "implementation_brief"
    assert kickoff.artifact.payload_hash
    assert kickoff.artifact.lineage["engagement_id"] == str(engagement.id)
    assert kickoff.artifact.lineage["marketing_run_id"] == str(run.id)
    assert run.stage == "strategy"
    assert run.strategy_summary["kickoff"]["task_count"] == 5
    assert run.strategy_summary["client_context"] == {
        "client_url": "https://acme.example/",
        "repo_url": "https://github.com/acme/app",
        "goals": ["increase qualified demo bookings"],
        "constraints": ["client approval required before publishing"],
    }

    access_requests = list(db._store.get(AgencyAccessRequest, {}).values())
    assert {(item.request_type, item.provider) for item in access_requests} == {
        ("client_platform", "website"),
        ("repository", "github"),
        ("analytics", "umami"),
        ("social_account", "linkedin"),
    }
    assert all(item.marketing_run_id == run.id for item in access_requests)

    tasks = list(db._store.get(VirtualAgencyTask, {}).values())
    assert [task.agent_role for task in tasks] == [
        AGENT_COS,
        AGENT_CONTENT,
        AGENT_SCHEDULING,
        AGENT_COMMUNITY,
        AGENT_ANALYTICS,
    ]
    assert [task.task_type for task in tasks] == [
        "strategy_research",
        "content_generation",
        "content_scheduling",
        "community_engagement",
        "analytics_reporting",
    ]
    assert tasks[1].dependencies == [tasks[0]]
    assert tasks[2].dependencies == [tasks[1]]
    assert tasks[3].dependencies == [tasks[2]]
    assert tasks[4].dependencies == [tasks[3]]
    assert all(task.lineage["engagement_id"] == str(engagement.id) for task in tasks)
    assert all(task.lineage["marketing_run_id"] == str(run.id) for task in tasks)
    assert all(task.lineage["orchestration_task_id"] == str(task.id) for task in tasks)
    assert all(task.context["client_url"] == "https://acme.example/" for task in tasks)
    assert all(task.context["repo_url"] == "https://github.com/acme/app" for task in tasks)
    assert "approval_payload_hash" in tasks[0].context["required_gates"]

    events = list(db._store.get(VirtualAgencyEvent, {}).values())
    assert len(events) == 5
    assert all(event.event_type == "task_created" for event in events)
    assert len(kickoff.tasks) == 5


@pytest.mark.asyncio
async def test_dispatch_marketing_run_blocks_until_access_requests_are_resolved():
    from app.services.agency_domain import (
        MarketingRunAccessGateError,
        approve_and_dispatch_marketing_run,
        create_client_engagement,
        kickoff_marketing_run,
        start_marketing_run,
    )

    db = _FakeAgencySession()
    org_id = uuid.uuid4()
    engagement = await create_client_engagement(
        db,
        org_id=org_id,
        body=ClientEngagementCreate(
            name="Acme Launch",
            client_url="https://acme.example",
            integration_state={"preferred_social_channels": ["linkedin"]},
        ),
        created_by_agent="chief_of_staff",
    )
    run = await start_marketing_run(
        db,
        engagement=engagement,
        objective="Build campaign",
    )
    await kickoff_marketing_run(db, engagement=engagement, run=run)

    with pytest.raises(MarketingRunAccessGateError) as exc:
        await approve_and_dispatch_marketing_run(
            db,
            engagement=engagement,
            run=run,
            actor_id="client-1",
        )

    open_ids = {request.id for request in exc.value.open_access_requests}
    assert open_ids == {
        request.id
        for request in db._store.get(AgencyAccessRequest, {}).values()
        if request.status == "requested"
    }
    assert run.status == "blocked"
    assert run.current_blocker is not None
    assert run.current_blocker["access_request_ids"] == sorted(
        run.current_blocker["access_request_ids"]
    )
    assert run.current_blocker == {
        "type": "access_requests",
        "status": "blocked",
        "access_request_ids": sorted(str(request_id) for request_id in open_ids),
        "providers": ["analytics", "linkedin", "website"],
        "request_types": ["analytics", "client_platform", "social_account"],
        "reason": "Marketing run cannot dispatch until access requests are resolved.",
    }
    assert [
        event.event_type
        for event in db._store.get(VirtualAgencyEvent, {}).values()
        if event.event_type == "approved"
    ] == []


@pytest.mark.asyncio
async def test_dispatch_marketing_run_approves_tasks_and_dispatches_first_ready_agent(
    monkeypatch,
):
    from app.services.agency_domain import (
        approve_and_dispatch_marketing_run,
        create_client_engagement,
        kickoff_marketing_run,
        start_marketing_run,
    )

    sent = await _capture_publish(monkeypatch)
    db = _FakeAgencySession()
    org_id = uuid.uuid4()
    engagement = await create_client_engagement(
        db,
        org_id=org_id,
        body=ClientEngagementCreate(
            name="Acme Launch",
            client_url="https://acme.example",
            integration_state={"preferred_social_channels": ["linkedin"]},
        ),
        created_by_agent="chief_of_staff",
    )
    run = await start_marketing_run(
        db,
        engagement=engagement,
        objective="Build campaign",
    )
    await kickoff_marketing_run(db, engagement=engagement, run=run)
    for request in db._store.get(AgencyAccessRequest, {}).values():
        request.status = "granted"

    dispatch = await approve_and_dispatch_marketing_run(
        db,
        engagement=engagement,
        run=run,
        actor_id="client-1",
    )

    tasks = list(db._store.get(VirtualAgencyTask, {}).values())
    assert len(dispatch.approved_tasks) == 5
    assert len(dispatch.dispatched_messages) == 1
    assert dispatch.dispatched_messages[0]["agent_role"] == "chief_of_staff"
    assert dispatch.dispatched_messages[0]["idempotency_key"] == (
        f"agency-run:handoff:{run.id}:{tasks[0].id}:{tasks[0].task_version}"
    )
    assert sent == [
        {
            "queue": "stevie-virtual-agency",
            "message": dispatch.dispatched_messages[0],
        }
    ]
    assert all(task.approval_active for task in tasks)
    assert [task.status for task in tasks] == ["todo", "todo", "todo", "todo", "todo"]
    events = list(db._store.get(VirtualAgencyEvent, {}).values())
    assert [event.event_type for event in events].count("approved") == 5
    assert [event.event_type for event in events].count("handoff_dispatched") == 1

    second = await approve_and_dispatch_marketing_run(
        db,
        engagement=engagement,
        run=run,
        actor_id="client-1",
    )

    assert second.approved_tasks == []
    assert second.dispatched_messages == []
    events_after_second = list(db._store.get(VirtualAgencyEvent, {}).values())
    assert [event.event_type for event in events_after_second].count("approved") == 5
    assert (
        [event.event_type for event in events_after_second].count("handoff_dispatched")
        == 1
    )


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


@pytest.mark.asyncio
async def test_decide_access_request_records_resolution_and_run_blocker():
    from app.services.agency_domain import (
        create_access_request,
        create_client_engagement,
        decide_access_request,
        start_marketing_run,
    )

    db = _FakeAgencySession()
    org_id = uuid.uuid4()
    user_id = uuid.uuid4()
    engagement = await create_client_engagement(
        db,
        org_id=org_id,
        body=ClientEngagementCreate(name="Acme"),
        created_by_agent="chief_of_staff",
    )
    run = await start_marketing_run(
        db,
        engagement=engagement,
        objective="Build campaign",
    )
    request = await create_access_request(
        db,
        org_id=org_id,
        engagement=engagement,
        body=AgencyAccessRequestCreate(
            marketing_run_id=run.id,
            request_type="analytics",
            provider="umami",
            scope={"website_id": "required"},
            reason="Metrics reporting needs analytics access",
            instructions={"action": "connect_umami"},
        ),
    )

    blocked = await decide_access_request(
        db,
        access_request=request,
        decision="blocked",
        resolved_by_user_id=user_id,
        decision_note="Client has not granted analytics yet",
        resolution_payload={"provider": "umami"},
    )

    assert blocked is request
    assert request.status == "blocked"
    assert request.resolved_by_user_id == user_id
    assert request.resolved_at is not None
    assert request.instructions["resolution"] == {
        "decision": "blocked",
        "decision_note": "Client has not granted analytics yet",
        "resolution_payload": {"provider": "umami"},
        "resolved_at": request.resolved_at.isoformat(),
    }
    assert run.status == "blocked"
    assert run.current_blocker == {
        "type": "access_request",
        "access_request_id": str(request.id),
        "request_type": "analytics",
        "provider": "umami",
        "status": "blocked",
        "reason": "Metrics reporting needs analytics access",
        "decision_note": "Client has not granted analytics yet",
        "resolved_at": request.resolved_at.isoformat(),
    }

    granted = await decide_access_request(
        db,
        access_request=request,
        decision="granted",
        resolved_by_user_id=user_id,
        decision_note="Analytics connected",
        resolution_payload={"connection_ref": "umami:workspace"},
    )

    assert granted is request
    assert request.status == "granted"
    assert request.instructions["resolution"]["decision"] == "granted"
    assert request.instructions["resolution"]["decision_note"] == "Analytics connected"
    assert run.status == "active"
    assert run.current_blocker is None


@pytest.mark.asyncio
async def test_decide_approval_request_records_decision_actor_and_note():
    from app.services.agency_domain import (
        create_approval_request,
        create_client_engagement,
        decide_approval_request,
    )

    db = _FakeAgencySession()
    org_id = uuid.uuid4()
    user_id = uuid.uuid4()
    subject_id = uuid.uuid4()
    engagement = await create_client_engagement(
        db,
        org_id=org_id,
        body=ClientEngagementCreate(name="Acme"),
        created_by_agent="chief_of_staff",
    )
    approval = await create_approval_request(
        db,
        org_id=org_id,
        engagement=engagement,
        body=AgencyApprovalCreate(
            approval_type="strategy",
            subject_type="agency_artifact",
            subject_id=subject_id,
            reason="Approve strategy",
            approval_payload={"subject_id": str(subject_id)},
        ),
    )

    decided = await decide_approval_request(
        db,
        approval=approval,
        decision="approved",
        decided_by_user_id=user_id,
        decision_note="Approved for production",
    )

    assert decided is approval
    assert approval.status == "approved"
    assert approval.decided_by_user_id == user_id
    assert approval.decision_note == "Approved for production"
    assert approval.decided_at is not None
