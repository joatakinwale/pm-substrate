import inspect
import uuid

import pytest
from pydantic import ValidationError


def test_virtual_agency_router_imports_without_missing_get_org_id():
    import app.api.virtual_agency as module

    assert module.router.prefix == "/virtual-agency"


def test_virtual_agency_inbox_exposes_direct_orchestration_tasks():
    import app.api.virtual_agency as module

    src = inspect.getsource(module.get_virtual_agency_inbox)

    assert "select(VirtualAgencyTask)" in src
    assert '\"type\": \"orchestration_task\"' in src
    assert "VirtualAgencyTask.approval_active == False" in src
    assert "VirtualAgencyTask.source_task_id.is_(None)" in src


def test_virtual_agency_approve_dispatches_direct_orchestration_tasks():
    import app.api.virtual_agency as module

    src = inspect.getsource(module.approve_virtual_agency_item)

    assert 'if item_type == "orchestration_task":' in src
    assert "select(VirtualAgencyTask).where(" in src
    assert "VirtualAgencyTask.source_task_id.is_(None)" in src
    assert 'VirtualAgencyTask.status == "todo"' in src
    assert "approve_task(" in src
    assert "publish_agent_task(" in src
    assert "queue=\"stevie-virtual-agency\"" in src


def test_report_approval_creates_next_action_before_commit():
    import app.api.virtual_agency as module

    src = inspect.getsource(module.approve_virtual_agency_item)
    report_branch = src[src.index('if item_type == "report":'):]

    generated_pos = report_branch.index('report.status = "generated"')
    next_action_pos = report_branch.index(
        "create_next_action_proposal_task_for_report_async("
    )
    commit_pos = report_branch.index("await db.commit()")

    assert generated_pos < next_action_pos < commit_pos


def test_internal_virtual_agency_dependency_waits_are_retryable():
    import app.api.internal.virtual_agency as module

    src = inspect.getsource(module.execute_task)

    assert "DependencyNotSatisfiedError" in src
    assert "status_code=425" in src
    assert src.index("except DependencyNotSatisfiedError") < src.index(
        "except VirtualAgencyInvariantError"
    )


def _valid_internal_virtual_agency_payload():
    project_id = uuid.uuid4()
    legacy_task_id = uuid.uuid4()
    orchestration_task_id = uuid.uuid4()
    return {
        "type": "virtual_agency.task",
        "org_id": str(uuid.uuid4()),
        "idempotency_key": "virtual-agency-task-abc123",
        "emitted_at": "2026-05-01T12:00:00Z",
        "agent_role": "content_creative",
        "project_id": str(project_id),
        "task_id": str(legacy_task_id),
        "orchestration_task_id": str(orchestration_task_id),
        "task_version": 1,
        "approval_version": 1,
        "approval_payload_hash": "9" * 64,
        "lineage": {
            "client_request": "Launch a June campaign",
            "project_id": str(project_id),
            "legacy_task_id": str(legacy_task_id),
            "orchestration_task_id": str(orchestration_task_id),
            "marketing_run_id": str(uuid.uuid4()),
        },
        "dependency_ids": [str(uuid.uuid4())],
        "context": {"draft_type": "post", "tone": "friendly"},
    }


def test_internal_virtual_agency_payload_matches_worker_contract():
    from app.api.internal.virtual_agency import VirtualAgencyTaskRequest

    payload = _valid_internal_virtual_agency_payload()
    request = VirtualAgencyTaskRequest.model_validate(payload)

    assert request.type == "virtual_agency.task"
    assert request.project_id == uuid.UUID(payload["project_id"])
    assert request.dependency_ids == [uuid.UUID(payload["dependency_ids"][0])]
    assert request.approval_payload_hash == "9" * 64
    assert request.lineage["marketing_run_id"] == payload["lineage"]["marketing_run_id"]


@pytest.mark.parametrize(
    "field",
    [
        "type",
        "emitted_at",
        "project_id",
        "orchestration_task_id",
        "dependency_ids",
        "context",
    ],
)
def test_internal_virtual_agency_payload_rejects_missing_required_worker_fields(field):
    from app.api.internal.virtual_agency import VirtualAgencyTaskRequest

    payload = _valid_internal_virtual_agency_payload()
    payload.pop(field)

    with pytest.raises(ValidationError):
        VirtualAgencyTaskRequest.model_validate(payload)


@pytest.mark.parametrize(
    "patch",
    [
        {"type": "automation.run"},
        {"agent_role": "content_writer"},
        {"approval_payload_hash": "not-a-sha256"},
        {"dependency_ids": None},
        {"dependency_ids": ["not-a-uuid"]},
        {"lineage": {"client_request": "Launch", "project_id": "not-a-uuid"}},
    ],
)
def test_internal_virtual_agency_payload_rejects_contract_violations(patch):
    from app.api.internal.virtual_agency import VirtualAgencyTaskRequest

    payload = _valid_internal_virtual_agency_payload()
    payload.update(patch)

    with pytest.raises(ValidationError):
        VirtualAgencyTaskRequest.model_validate(payload)


def test_internal_virtual_agency_payload_requires_lineage_orchestration_task_id():
    from app.api.internal.virtual_agency import VirtualAgencyTaskRequest

    payload = _valid_internal_virtual_agency_payload()
    payload["lineage"].pop("orchestration_task_id")

    with pytest.raises(ValidationError):
        VirtualAgencyTaskRequest.model_validate(payload)


@pytest.mark.parametrize(
    ("lineage_field", "lineage_value"),
    [
        ("project_id", lambda: str(uuid.uuid4())),
        ("legacy_task_id", lambda: str(uuid.uuid4())),
        ("orchestration_task_id", lambda: str(uuid.uuid4())),
    ],
)
def test_internal_virtual_agency_payload_rejects_lineage_scope_mismatch(
    lineage_field,
    lineage_value,
):
    from app.api.internal.virtual_agency import VirtualAgencyTaskRequest

    payload = _valid_internal_virtual_agency_payload()
    payload["lineage"][lineage_field] = lineage_value()

    with pytest.raises(ValidationError):
        VirtualAgencyTaskRequest.model_validate(payload)


def test_internal_virtual_agency_route_forwards_full_worker_contract():
    import app.api.internal.virtual_agency as module

    src = inspect.getsource(module.execute_task)

    assert "lineage.project_id must match project_id" in inspect.getsource(
        module.VirtualAgencyTaskRequest
    )
    assert "emitted_at=req.emitted_at.isoformat()" in src
    assert "type=req.type" in src
    assert "dependency_ids=[str(item) for item in req.dependency_ids]" in src
    assert "**routed" in src
    assert '"source_task_id"' in src
