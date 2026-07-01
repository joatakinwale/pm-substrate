from __future__ import annotations

import uuid
from collections import defaultdict

import pytest

from app.models.project import Task
from app.models.social_media import SocialAccount, SocialPost
from app.models.virtual_agency import VirtualAgencyEvent, VirtualAgencyTask
from app.services.virtual_agency import (
    AGENT_ANALYTICS,
    AGENT_CONTENT,
    AGENT_SCHEDULING,
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
    MissingContextError,
    MutationRequest,
    apply_mutations,
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

    def find_event_by_idempotency_key(self, idempotency_key):
        for event in self._store.get(VirtualAgencyEvent, {}).values():
            if event.idempotency_key == idempotency_key:
                return event
        return None

    def list_project_draft_posts(self, project_id):
        return [
            post
            for post in self._store.get(SocialPost, {}).values()
            if post.project_id == project_id and post.status == "draft"
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
    assert scheduling_task.dependencies
    assert scheduling_task.dependencies[0].agent_role == AGENT_CONTENT
    assert scheduling_task.lineage["client_request"] == "Launch a June campaign"


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
    scheduling_message = next(
        item["message"]
        for item in sent
        if item["message"]["agent_role"] == AGENT_SCHEDULING
    )

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
