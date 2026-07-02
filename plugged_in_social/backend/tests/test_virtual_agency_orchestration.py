from __future__ import annotations

import uuid
import inspect
from collections import defaultdict
from datetime import datetime, timezone

import pytest

from app.models.project import Task
from app.models.report import ClientReport, ReportStatus
from app.models.social_media import SocialAccount, SocialPost
from app.models.virtual_agency import VirtualAgencyEvent, VirtualAgencyTask
from app.models.virtual_agency import VirtualAgencyEventType
from app.services.report_next_actions import (
    create_next_action_proposal_task_for_report_async,
)
from app.services.virtual_agency import (
    AGENT_ANALYTICS,
    AGENT_CONTENT,
    AGENT_SCHEDULING,
    dispatch_metrics_ready_analytics_tasks,
    revoke_department_agents_for_project,
    start_campaign_planning,
    trigger_department_agents_for_project,
)
from app.services.virtual_agency_agents import route_virtual_agency_task
from app.services.virtual_agency_orchestration import (
    ApprovalStateError,
    CapabilityViolationError,
    ConcurrentMutationError,
    DependencyNotSatisfiedError,
    ExecutionScopeError,
    MissingContextError,
    MutationRequest,
    apply_mutations,
    approve_task,
    build_handoff_payload,
    create_scheduling_mutations,
    social_post_content_hash,
    validate_required_context,
)


class _FakeSession:
    def __init__(self):
        self._store: dict[type[object], dict[uuid.UUID, object]] = defaultdict(dict)

    def add(self, obj):
        if getattr(obj, "id", None) is None:
            obj.id = uuid.uuid4()
        self._store[type(obj)][obj.id] = obj

    def add_all(self, objs):
        for obj in objs:
            self.add(obj)

    async def flush(self):
        return None

    async def get(self, model, item_id):
        return self.get_by_id(model, item_id)

    def get_by_id(self, model, item_id):
        return self._store.get(model, {}).get(item_id)

    def list_virtual_tasks_for_project(self, project_id):
        return [
            task
            for task in self._store.get(VirtualAgencyTask, {}).values()
            if task.project_id == project_id
        ]

    def list_virtual_task_dependencies(self, task):
        return list(task.dependencies)

    def list_virtual_task_dependents(self, task):
        return [
            candidate
            for candidate in self._store.get(VirtualAgencyTask, {}).values()
            if task in candidate.dependencies
        ]

    def find_event_by_idempotency_key(self, idempotency_key):
        for event in self._store.get(VirtualAgencyEvent, {}).values():
            if event.idempotency_key == idempotency_key:
                return event
        return None

    def find_virtual_task_by_creation_idempotency_key(self, key):
        for task in self._store.get(VirtualAgencyTask, {}).values():
            if task.creation_idempotency_key == key:
                return task
        return None

    def list_project_draft_posts(self, project_id):
        return [
            post
            for post in self._store.get(SocialPost, {}).values()
            if post.project_id == project_id and post.status == "draft"
        ]

    def list_project_metric_posts(self, project_id):
        return [
            post
            for post in self._store.get(SocialPost, {}).values()
            if post.project_id == project_id
            and post.status == "published"
            and post.published_at is not None
            and any([
                post.likes,
                post.comments,
                post.shares,
                post.impressions,
                post.reach,
                post.engagement_rate is not None,
            ])
        ]

    def first_social_account(self, org_id):
        for account in self._store.get(SocialAccount, {}).values():
            if account.org_id == org_id:
                return account
        return None


async def _capture_publish(monkeypatch):
    sent: list[dict] = []

    async def _fake_publish(*, queue, message):
        sent.append({"queue": queue, "message": message})

    monkeypatch.setattr("app.services.virtual_agency._publish", _fake_publish)
    return sent


def test_task_dependencies_are_initialized_before_handoff_payloads() -> None:
    import app.services.agency_domain as agency_domain
    import app.services.virtual_agency as virtual_agency

    agency_source = inspect.getsource(agency_domain._create_kickoff_virtual_tasks)
    virtual_source = inspect.getsource(virtual_agency.start_campaign_planning)

    assert "task.dependencies = []" in agency_source
    assert agency_source.index("task.dependencies = []") < agency_source.index(
        "build_handoff_payload(task)"
    )
    assert "task.dependencies = []" in virtual_source
    assert virtual_source.index("task.dependencies = []") < virtual_source.index(
        "build_handoff_payload(task)"
    )


@pytest.mark.asyncio
async def test_start_campaign_planning_creates_orchestration_tasks():
    db = _FakeSession()
    org_id = uuid.uuid4()

    project = await start_campaign_planning(
        db,
        org_id=org_id,
        client_request="Launch a June campaign",
        client_name="Client",
        client_email="client@example.com",
    )

    tasks = db.list_virtual_tasks_for_project(project.id)
    assert len(tasks) == 3
    scheduling_task = next(task for task in tasks if task.agent_role == AGENT_SCHEDULING)
    analytics_task = next(task for task in tasks if task.agent_role == AGENT_ANALYTICS)
    assert scheduling_task.dependencies
    assert scheduling_task.dependencies[0].agent_role == AGENT_CONTENT
    assert analytics_task.dependencies
    assert analytics_task.dependencies[0].agent_role == AGENT_SCHEDULING
    assert scheduling_task.lineage["client_request"] == "Launch a June campaign"


@pytest.mark.asyncio
async def test_campaign_approval_dispatches_only_unblocked_tasks(monkeypatch):
    db = _FakeSession()
    org_id = uuid.uuid4()
    sent = await _capture_publish(monkeypatch)
    project = await start_campaign_planning(
        db,
        org_id=org_id,
        client_request="Launch a June campaign",
        client_name="Client",
        client_email="client@example.com",
    )

    await trigger_department_agents_for_project(db, org_id, project.id)

    assert [item["message"]["agent_role"] for item in sent] == [AGENT_CONTENT]


@pytest.mark.asyncio
async def test_scheduling_completion_waits_for_metrics_before_analytics(monkeypatch):
    db = _FakeSession()
    org_id = uuid.uuid4()
    sent = await _capture_publish(monkeypatch)
    db.add(
        SocialAccount(
            id=uuid.uuid4(),
            org_id=org_id,
            platform="linkedin",
            account_name="Acme",
            account_id="acct-1",
        )
    )
    project = await start_campaign_planning(
        db,
        org_id=org_id,
        client_request="Launch a June campaign",
        client_name="Client",
        client_email="client@example.com",
    )

    await trigger_department_agents_for_project(db, org_id, project.id)
    content_message = sent[-1]["message"]
    assert content_message["agent_role"] == AGENT_CONTENT

    await route_virtual_agency_task(db=db, **content_message)
    scheduling_message = sent[-1]["message"]
    assert scheduling_message["agent_role"] == AGENT_SCHEDULING

    await route_virtual_agency_task(db=db, **scheduling_message)

    assert [item["message"]["agent_role"] for item in sent] == [
        AGENT_CONTENT,
        AGENT_SCHEDULING,
    ]

    analytics_task = next(
        task
        for task in db.list_virtual_tasks_for_project(project.id)
        if task.agent_role == AGENT_ANALYTICS
    )
    analytics_message = {
        **build_handoff_payload(analytics_task),
        "idempotency_key": f"va-exec:{analytics_task.id}:1",
        "type": "virtual_agency.task",
        "emitted_at": None,
    }
    with pytest.raises(DependencyNotSatisfiedError):
        await route_virtual_agency_task(db=db, **analytics_message)


@pytest.mark.asyncio
async def test_metrics_ready_project_dispatches_analytics_task(monkeypatch):
    db = _FakeSession()
    org_id = uuid.uuid4()
    sent = await _capture_publish(monkeypatch)
    db.add(
        SocialAccount(
            id=uuid.uuid4(),
            org_id=org_id,
            platform="linkedin",
            account_name="Acme",
            account_id="acct-1",
        )
    )
    project = await start_campaign_planning(
        db,
        org_id=org_id,
        client_request="Launch a June campaign",
        client_name="Client",
        client_email="client@example.com",
    )

    await trigger_department_agents_for_project(db, org_id, project.id)
    await route_virtual_agency_task(db=db, **sent[-1]["message"])
    await route_virtual_agency_task(db=db, **sent[-1]["message"])

    post = next(iter(db._store.get(SocialPost, {}).values()))
    post.status = "published"
    post.published_at = datetime.now(timezone.utc)
    post.platform_post_id = "li-post-1"
    post.impressions = 250
    post.reach = 200
    post.engagement_rate = 0.07

    dispatched = await dispatch_metrics_ready_analytics_tasks(
        db,
        project_ids={project.id},
    )

    assert [message["agent_role"] for message in dispatched] == [AGENT_ANALYTICS]
    assert [item["message"]["agent_role"] for item in sent] == [
        AGENT_CONTENT,
        AGENT_SCHEDULING,
    ]
    dispatch_events = [
        event
        for event in db._store.get(VirtualAgencyEvent, {}).values()
        if event.event_type == "handoff_dispatched"
        and event.payload.get("agent_role") == AGENT_ANALYTICS
    ]
    assert len(dispatch_events) == 1


@pytest.mark.asyncio
async def test_virtual_agency_closed_loop_reaches_next_action_with_durable_evidence(monkeypatch):
    db = _FakeSession()
    org_id = uuid.uuid4()
    sent = await _capture_publish(monkeypatch)
    db.add(
        SocialAccount(
            id=uuid.uuid4(),
            org_id=org_id,
            platform="linkedin",
            account_name="Acme",
            account_id="acct-1",
        )
    )
    project = await start_campaign_planning(
        db,
        org_id=org_id,
        client_request="Launch a June campaign",
        client_name="Client",
        client_email="client@example.com",
    )

    await trigger_department_agents_for_project(db, org_id, project.id)
    await route_virtual_agency_task(db=db, **sent[-1]["message"])
    await route_virtual_agency_task(db=db, **sent[-1]["message"])

    post = next(iter(db._store.get(SocialPost, {}).values()))
    assert post.status == "scheduled"
    post.status = "published"
    post.published_at = datetime.now(timezone.utc)
    post.platform_post_id = "li-post-1"
    post.impressions = 400
    post.reach = 320
    post.engagement_rate = 0.073

    analytics_messages = await dispatch_metrics_ready_analytics_tasks(
        db,
        project_ids={project.id},
        actor_id="system:metrics-refresh",
    )
    assert [message["agent_role"] for message in analytics_messages] == [
        AGENT_ANALYTICS
    ]
    await route_virtual_agency_task(db=db, **analytics_messages[0])

    report = next(iter(db._store.get(ClientReport, {}).values()))
    report.status = ReportStatus.generated.value
    report.metrics_snapshot = {
        "total_reach": 400,
        "avg_engagement_rate": 7.3,
        "qualified_leads_generated": 18,
    }
    report.pdf_url = "https://reports.example/summer.pdf"
    report.pdf_generated_at = datetime.now(timezone.utc)
    next_action_task = await create_next_action_proposal_task_for_report_async(
        db,
        report=report,
        actor_id="system:report-builder",
    )

    assert next_action_task is not None
    assert next_action_task.task_type == "next_action_proposal"
    assert next_action_task.source_task_id is None
    assert next_action_task.context["required_gates"] == [
        "tenant_rls",
        "client_report_generated",
        "metrics_snapshot_hash",
        "pm_substrate_next_action_adapter",
        "client_approval_before_execution",
    ]
    assert next_action_task.context["content_hashes"]["metrics_snapshot_hash"]
    assert next_action_task.lineage["client_report_id"] == str(report.id)

    db.add(
        approve_task(
            next_action_task,
            actor_id="client-1",
            idempotency_key=f"va-event:approve:{next_action_task.id}:1",
        )
    )
    result = await route_virtual_agency_task(
        db=db,
        **{
            **build_handoff_payload(next_action_task),
            "idempotency_key": f"va-exec:{next_action_task.id}:1",
            "type": "virtual_agency.task",
            "emitted_at": None,
        },
    )

    assert result["status"] == "done"
    completed_events = [
        event
        for event in db._store.get(VirtualAgencyEvent, {}).values()
        if event.event_type == VirtualAgencyEventType.execution_completed.value
    ]
    completed_roles = [
        db.get_by_id(VirtualAgencyTask, event.task_id).agent_role
        for event in completed_events
    ]
    assert completed_roles == [
        AGENT_CONTENT,
        AGENT_SCHEDULING,
        AGENT_ANALYTICS,
        AGENT_ANALYTICS,
    ]
    next_action_completed = completed_events[-1]
    assert next_action_completed.payload["next_action_proposal"] == {
        "recommended_action": "launch_followup_campaign",
        "source_report_id": str(report.id),
        "evidence_ref_count": 3,
        "content_hashes": next_action_task.context["content_hashes"],
        "pm_substrate_action_type": "marketing.next_action.propose",
    }


@pytest.mark.asyncio
async def test_scheduling_agent_marks_posts_scheduled_for_publish_sweep(monkeypatch):
    db = _FakeSession()
    org_id = uuid.uuid4()
    sent = await _capture_publish(monkeypatch)
    db.add(
        SocialAccount(
            id=uuid.uuid4(),
            org_id=org_id,
            platform="linkedin",
            account_name="Acme",
            account_id="acct-1",
        )
    )
    project = await start_campaign_planning(
        db,
        org_id=org_id,
        client_request="Launch a June campaign",
        client_name="Client",
        client_email="client@example.com",
    )

    await trigger_department_agents_for_project(db, org_id, project.id)
    await route_virtual_agency_task(db=db, **sent[-1]["message"])
    await route_virtual_agency_task(db=db, **sent[-1]["message"])

    posts = list(db._store.get(SocialPost, {}).values())
    assert len(posts) == 1
    assert posts[0].scheduled_at is not None
    assert posts[0].status == "scheduled"
    assert posts[0].scheduled_content_hash == social_post_content_hash(posts[0])
    assert str(project.id) in (posts[0].internal_notes or "")
    assert "orchestration_task_id" in (posts[0].internal_notes or "")


@pytest.mark.asyncio
async def test_stale_approval_is_rejected_after_revoke(monkeypatch):
    db = _FakeSession()
    org_id = uuid.uuid4()
    sent = await _capture_publish(monkeypatch)
    db.add(
        SocialAccount(
            id=uuid.uuid4(),
            org_id=org_id,
            platform="linkedin",
            account_name="Acme",
            account_id="acct-1",
        )
    )
    project = await start_campaign_planning(
        db,
        org_id=org_id,
        client_request="Launch a June campaign",
        client_name="Client",
        client_email="client@example.com",
    )

    await trigger_department_agents_for_project(db, org_id, project.id)
    await revoke_department_agents_for_project(db, org_id, project.id)

    content_message = next(
        item["message"] for item in sent if item["message"]["agent_role"] == AGENT_CONTENT
    )
    with pytest.raises(ApprovalStateError):
        await route_virtual_agency_task(
            db=db,
            **content_message,
        )


@pytest.mark.asyncio
async def test_out_of_order_handoff_is_rejected(monkeypatch):
    db = _FakeSession()
    org_id = uuid.uuid4()
    sent = await _capture_publish(monkeypatch)
    project = await start_campaign_planning(
        db,
        org_id=org_id,
        client_request="Launch a June campaign",
        client_name="Client",
        client_email="client@example.com",
    )

    await trigger_department_agents_for_project(db, org_id, project.id)
    scheduling_task = next(
        task
        for task in db.list_virtual_tasks_for_project(project.id)
        if task.agent_role == AGENT_SCHEDULING
    )
    scheduling_message = {
        **build_handoff_payload(scheduling_task),
        "idempotency_key": f"va-exec:{scheduling_task.id}:1",
        "type": "virtual_agency.task",
        "emitted_at": None,
    }

    assert [
        item["message"]["agent_role"]
        for item in sent
        if item["message"]["agent_role"] == AGENT_SCHEDULING
    ] == []

    with pytest.raises(DependencyNotSatisfiedError):
        await route_virtual_agency_task(
            db=db,
            **scheduling_message,
        )


@pytest.mark.asyncio
async def test_duplicate_handoff_is_idempotent(monkeypatch):
    db = _FakeSession()
    org_id = uuid.uuid4()
    sent = await _capture_publish(monkeypatch)
    db.add(
        SocialAccount(
            id=uuid.uuid4(),
            org_id=org_id,
            platform="linkedin",
            account_name="Acme",
            account_id="acct-1",
        )
    )
    project = await start_campaign_planning(
        db,
        org_id=org_id,
        client_request="Launch a June campaign",
        client_name="Client",
        client_email="client@example.com",
    )

    await trigger_department_agents_for_project(db, org_id, project.id)
    content_message = next(
        item["message"] for item in sent if item["message"]["agent_role"] == AGENT_CONTENT
    )

    first = await route_virtual_agency_task(db=db, **content_message)
    second = await route_virtual_agency_task(db=db, **content_message)

    assert first["status"] == "done"
    assert second["status"] == "duplicate"
    posts = list(db._store.get(SocialPost, {}).values())
    assert len(posts) == 1


@pytest.mark.asyncio
async def test_handoff_org_mismatch_is_rejected(monkeypatch):
    db = _FakeSession()
    org_id = uuid.uuid4()
    sent = await _capture_publish(monkeypatch)
    db.add(
        SocialAccount(
            id=uuid.uuid4(),
            org_id=org_id,
            platform="linkedin",
            account_name="Acme",
            account_id="acct-1",
        )
    )
    project = await start_campaign_planning(
        db,
        org_id=org_id,
        client_request="Launch a June campaign",
        client_name="Client",
        client_email="client@example.com",
    )

    await trigger_department_agents_for_project(db, org_id, project.id)
    content_message = next(
        item["message"] for item in sent if item["message"]["agent_role"] == AGENT_CONTENT
    )

    with pytest.raises(ExecutionScopeError):
        await route_virtual_agency_task(
            db=db,
            **{**content_message, "org_id": str(uuid.uuid4())},
        )

    assert list(db._store.get(SocialPost, {}).values()) == []


@pytest.mark.asyncio
async def test_handoff_project_mismatch_is_rejected(monkeypatch):
    db = _FakeSession()
    org_id = uuid.uuid4()
    sent = await _capture_publish(monkeypatch)
    db.add(
        SocialAccount(
            id=uuid.uuid4(),
            org_id=org_id,
            platform="linkedin",
            account_name="Acme",
            account_id="acct-1",
        )
    )
    project = await start_campaign_planning(
        db,
        org_id=org_id,
        client_request="Launch a June campaign",
        client_name="Client",
        client_email="client@example.com",
    )

    await trigger_department_agents_for_project(db, org_id, project.id)
    content_message = next(
        item["message"] for item in sent if item["message"]["agent_role"] == AGENT_CONTENT
    )

    with pytest.raises(ExecutionScopeError):
        await route_virtual_agency_task(
            db=db,
            **{**content_message, "project_id": str(uuid.uuid4())},
        )

    assert list(db._store.get(SocialPost, {}).values()) == []


@pytest.mark.asyncio
async def test_handoff_lineage_project_mismatch_is_rejected(monkeypatch):
    db = _FakeSession()
    org_id = uuid.uuid4()
    sent = await _capture_publish(monkeypatch)
    db.add(
        SocialAccount(
            id=uuid.uuid4(),
            org_id=org_id,
            platform="linkedin",
            account_name="Acme",
            account_id="acct-1",
        )
    )
    project = await start_campaign_planning(
        db,
        org_id=org_id,
        client_request="Launch a June campaign",
        client_name="Client",
        client_email="client@example.com",
    )

    await trigger_department_agents_for_project(db, org_id, project.id)
    content_message = next(
        item["message"] for item in sent if item["message"]["agent_role"] == AGENT_CONTENT
    )

    with pytest.raises(ExecutionScopeError, match="lineage project_id"):
        await route_virtual_agency_task(
            db=db,
            **{
                **content_message,
                "lineage": {
                    **content_message["lineage"],
                    "project_id": str(uuid.uuid4()),
                },
            },
        )

    assert list(db._store.get(SocialPost, {}).values()) == []


@pytest.mark.asyncio
async def test_handoff_source_task_mismatch_is_rejected(monkeypatch):
    db = _FakeSession()
    org_id = uuid.uuid4()
    sent = await _capture_publish(monkeypatch)
    db.add(
        SocialAccount(
            id=uuid.uuid4(),
            org_id=org_id,
            platform="linkedin",
            account_name="Acme",
            account_id="acct-1",
        )
    )
    project = await start_campaign_planning(
        db,
        org_id=org_id,
        client_request="Launch a June campaign",
        client_name="Client",
        client_email="client@example.com",
    )

    await trigger_department_agents_for_project(db, org_id, project.id)
    content_message = next(
        item["message"] for item in sent if item["message"]["agent_role"] == AGENT_CONTENT
    )

    with pytest.raises(ExecutionScopeError):
        await route_virtual_agency_task(
            db=db,
            **{**content_message, "task_id": str(uuid.uuid4())},
        )

    assert list(db._store.get(SocialPost, {}).values()) == []


@pytest.mark.asyncio
async def test_handoff_dependency_claim_mismatch_is_rejected(monkeypatch):
    db = _FakeSession()
    org_id = uuid.uuid4()
    sent = await _capture_publish(monkeypatch)
    db.add(
        SocialAccount(
            id=uuid.uuid4(),
            org_id=org_id,
            platform="linkedin",
            account_name="Acme",
            account_id="acct-1",
        )
    )
    project = await start_campaign_planning(
        db,
        org_id=org_id,
        client_request="Launch a June campaign",
        client_name="Client",
        client_email="client@example.com",
    )

    await trigger_department_agents_for_project(db, org_id, project.id)
    content_message = next(
        item["message"] for item in sent if item["message"]["agent_role"] == AGENT_CONTENT
    )

    with pytest.raises(ExecutionScopeError, match="dependency_ids"):
        await route_virtual_agency_task(
            db=db,
            **{
                **content_message,
                "dependency_ids": [str(uuid.uuid4())],
            },
        )

    assert list(db._store.get(SocialPost, {}).values()) == []


@pytest.mark.asyncio
async def test_conflicting_write_is_rejected():
    db = _FakeSession()
    org_id = uuid.uuid4()
    project_id = uuid.uuid4()
    legacy_task_id = uuid.uuid4()
    orchestration_task = VirtualAgencyTask(
        id=uuid.uuid4(),
        org_id=org_id,
        project_id=project_id,
        source_task_id=legacy_task_id,
        title="Schedule Content Distribution",
        description="Schedule content",
        reason="Schedule content",
        agent_role=AGENT_SCHEDULING,
        task_type="content_scheduling",
        creation_idempotency_key="create-1",
        lineage={
            "client_request": "Launch a June campaign",
            "project_id": str(project_id),
            "legacy_task_id": str(legacy_task_id),
        },
    )
    post = SocialPost(
        id=uuid.uuid4(),
        org_id=org_id,
        project_id=project_id,
        social_account_id=uuid.uuid4(),
        platform="linkedin",
        status="draft",
        version=2,
    )
    db.add(orchestration_task)
    db.add(post)

    with pytest.raises(ConcurrentMutationError):
        await apply_mutations(
            db=db,
            task=orchestration_task,
            mutations=[
                MutationRequest(
                    write_kind="social_post.schedule",
                    target_id=post.id,
                    expected_version=1,
                    payload={"scheduled_at": None},
                )
            ],
        )


@pytest.mark.asyncio
async def test_scheduling_write_rejects_content_hash_mismatch():
    db = _FakeSession()
    org_id = uuid.uuid4()
    project_id = uuid.uuid4()
    legacy_task_id = uuid.uuid4()
    orchestration_task = VirtualAgencyTask(
        id=uuid.uuid4(),
        org_id=org_id,
        project_id=project_id,
        source_task_id=legacy_task_id,
        title="Schedule Content Distribution",
        description="Schedule content",
        reason="Schedule content",
        agent_role=AGENT_SCHEDULING,
        task_type="content_scheduling",
        creation_idempotency_key="schedule-hash-1",
        lineage={
            "client_request": "Launch a June campaign",
            "project_id": str(project_id),
            "legacy_task_id": str(legacy_task_id),
        },
    )
    post = SocialPost(
        id=uuid.uuid4(),
        org_id=org_id,
        project_id=project_id,
        social_account_id=uuid.uuid4(),
        platform="linkedin",
        status="draft",
        caption="Original approved draft",
        hashtags=["launch"],
        media_urls=["r2://media/original.png"],
        media_type="image",
        version=1,
    )
    db.add(orchestration_task)
    db.add(post)
    mutation = create_scheduling_mutations([post])[0]
    assert mutation.payload["expected_content_hash"] == social_post_content_hash(post)

    post.caption = "Changed after approval"

    with pytest.raises(ConcurrentMutationError, match="content hash conflict"):
        await apply_mutations(
            db=db,
            task=orchestration_task,
            mutations=[mutation],
        )
    assert post.status == "draft"
    assert post.scheduled_at is None
    assert post.version == 1


def test_missing_context_is_rejected():
    task = VirtualAgencyTask(
        id=uuid.uuid4(),
        org_id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        title="Bad Task",
        description=None,
        reason="",
        agent_role=AGENT_CONTENT,
        task_type="content_generation",
        creation_idempotency_key="bad-task",
        lineage={},
    )

    with pytest.raises(MissingContextError):
        validate_required_context(task)


@pytest.mark.asyncio
async def test_capability_contract_blocks_wrong_mutation():
    task = VirtualAgencyTask(
        id=uuid.uuid4(),
        org_id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        source_task_id=uuid.uuid4(),
        title="Track Campaign Performance",
        description="Track registration conversions.",
        reason="Track registration conversions.",
        agent_role=AGENT_ANALYTICS,
        task_type="analytics_reporting",
        creation_idempotency_key="analytics-task",
        lineage={
            "client_request": "Launch a June campaign",
            "project_id": str(uuid.uuid4()),
            "legacy_task_id": str(uuid.uuid4()),
        },
    )

    with pytest.raises(CapabilityViolationError):
        await apply_mutations(
            db=_FakeSession(),
            task=task,
            mutations=[
                MutationRequest(
                    write_kind="social_post.create",
                    payload={
                        "social_account_id": uuid.uuid4(),
                        "platform": "linkedin",
                        "status": "draft",
                        "caption": "Wrong artifact",
                        "created_by_agent": AGENT_ANALYTICS,
                    },
                )
            ],
        )


@pytest.mark.asyncio
async def test_next_action_proposal_handoff_emits_proposal_without_new_report():
    db = _FakeSession()
    org_id = uuid.uuid4()
    project_id = uuid.uuid4()
    report_id = uuid.uuid4()
    task = VirtualAgencyTask(
        id=uuid.uuid4(),
        org_id=org_id,
        project_id=project_id,
        source_task_id=None,
        title="Propose next marketing action",
        description="Review the generated report and propose next action.",
        reason="Generated report reached terminal state with metrics evidence.",
        agent_role=AGENT_ANALYTICS,
        task_type="next_action_proposal",
        creation_idempotency_key=f"va-next-action:{report_id}",
        context={
            "source_report": {
                "client_report_id": str(report_id),
                "status": "generated",
            },
            "metrics_snapshot": {
                "total_reach": 400,
                "avg_engagement_rate": 7.3,
                "qualified_leads_generated": 18,
            },
            "content_hashes": {
                "client_report_hash": "a" * 64,
                "metrics_snapshot_hash": "b" * 64,
            },
            "evidence_refs": [
                {
                    "kind": "source_record",
                    "id": f"plugged_in_social:client_reports:{report_id}",
                    "label": "PluggedInSocial ClientReport row",
                }
            ],
            "pm_substrate": {
                "adapter": "packages/profile-agency/src/plugged-in-social-axis-b-adapter.ts",
                "next_action_proposal": "packages/profile-agency/src/next-action-proposal.ts",
                "action_type": "marketing.next_action.propose",
            },
        },
        lineage={
            "client_request": "Summer campaign report",
            "project_id": str(project_id),
            "legacy_task_id": str(report_id),
            "client_report_id": str(report_id),
        },
    )
    db.add(task)
    db.add(
        approve_task(
            task,
            actor_id="client-1",
            idempotency_key=f"va-event:approve:{task.id}:1",
        )
    )

    result = await route_virtual_agency_task(
        db=db,
        **{
            **build_handoff_payload(task),
            "idempotency_key": f"va-exec:{task.id}:1",
            "type": "virtual_agency.task",
            "emitted_at": None,
        },
    )

    assert result["status"] == "done"
    assert list(db._store.get(ClientReport, {}).values()) == []
    completed = next(
        event
        for event in db._store.get(VirtualAgencyEvent, {}).values()
        if event.event_type == VirtualAgencyEventType.execution_completed.value
    )
    assert completed.payload["artifacts_created"] == 0
    assert completed.payload["next_action_proposal"] == {
        "recommended_action": "launch_followup_campaign",
        "source_report_id": str(report_id),
        "evidence_ref_count": 1,
        "content_hashes": {
            "client_report_hash": "a" * 64,
            "metrics_snapshot_hash": "b" * 64,
        },
        "pm_substrate_action_type": "marketing.next_action.propose",
    }


def test_build_lineage_accepts_agency_context_ids_without_breaking_legacy_keys():
    from app.services.virtual_agency_orchestration import build_lineage

    project_id = uuid.uuid4()
    legacy_task_id = uuid.uuid4()
    engagement_id = uuid.uuid4()
    marketing_run_id = uuid.uuid4()
    artifact_id = uuid.uuid4()

    lineage = build_lineage(
        client_request="Launch campaign",
        project_id=project_id,
        legacy_task_id=legacy_task_id,
        engagement_id=engagement_id,
        marketing_run_id=marketing_run_id,
        artifact_id=artifact_id,
    )

    assert lineage["client_request"] == "Launch campaign"
    assert lineage["project_id"] == str(project_id)
    assert lineage["legacy_task_id"] == str(legacy_task_id)
    assert lineage["engagement_id"] == str(engagement_id)
    assert lineage["marketing_run_id"] == str(marketing_run_id)
    assert lineage["artifact_id"] == str(artifact_id)
