from __future__ import annotations

import inspect
import uuid
from datetime import date, datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException, Response
from pydantic import ValidationError


def test_integration_router_imports_with_neutral_v1_prefix():
    import app.api.integration as module

    assert module.router.prefix == "/integration/v1"
    route_methods = {
        (route.path, frozenset(route.methods or set()))
        for route in module.router.routes
    }

    assert ("/integration/v1/capabilities", frozenset({"GET"})) in route_methods
    assert ("/integration/v1/platform-manifest", frozenset({"GET"})) in route_methods
    assert ("/integration/v1/external-adapters", frozenset({"GET"})) in route_methods
    assert ("/integration/v1/events", frozenset({"POST"})) in route_methods
    assert ("/integration/v1/engagements", frozenset({"GET"})) in route_methods
    assert ("/integration/v1/engagements", frozenset({"POST"})) in route_methods
    assert (
        "/integration/v1/engagements/{engagement_id}",
        frozenset({"GET"}),
    ) in route_methods
    assert (
        "/integration/v1/engagements/{engagement_id}/marketing-runs",
        frozenset({"GET"}),
    ) in route_methods
    assert (
        "/integration/v1/engagements/{engagement_id}/marketing-runs",
        frozenset({"POST"}),
    ) in route_methods
    assert (
        "/integration/v1/engagements/{engagement_id}/artifacts",
        frozenset({"GET"}),
    ) in route_methods
    assert (
        "/integration/v1/engagements/{engagement_id}/approvals",
        frozenset({"GET"}),
    ) in route_methods
    assert (
        "/integration/v1/engagements/{engagement_id}/access-requests",
        frozenset({"GET"}),
    ) in route_methods
    assert (
        "/integration/v1/marketing-runs/{run_id}",
        frozenset({"GET"}),
    ) in route_methods
    assert (
        "/integration/v1/marketing-runs/{run_id}/dispatch",
        frozenset({"POST"}),
    ) in route_methods
    assert (
        "/integration/v1/marketing-runs/{run_id}/artifacts",
        frozenset({"GET"}),
    ) in route_methods
    assert (
        "/integration/v1/marketing-runs/{run_id}/external-adapter-runs",
        frozenset({"GET"}),
    ) in route_methods
    assert (
        "/integration/v1/marketing-runs/{run_id}/external-adapter-runs",
        frozenset({"POST"}),
    ) in route_methods
    assert (
        "/integration/v1/marketing-runs/{run_id}/social-posts",
        frozenset({"GET"}),
    ) in route_methods
    assert (
        "/integration/v1/marketing-runs/{run_id}/reports",
        frozenset({"GET"}),
    ) in route_methods
    assert (
        "/integration/v1/reports/{report_id}",
        frozenset({"GET"}),
    ) in route_methods
    assert (
        "/integration/v1/marketing-runs/{run_id}/tasks",
        frozenset({"GET"}),
    ) in route_methods
    assert (
        "/integration/v1/marketing-runs/{run_id}/approvals",
        frozenset({"GET"}),
    ) in route_methods
    assert (
        "/integration/v1/marketing-runs/{run_id}/access-requests",
        frozenset({"GET"}),
    ) in route_methods
    assert (
        "/integration/v1/marketing-runs/{run_id}/events",
        frozenset({"GET"}),
    ) in route_methods
    assert (
        "/integration/v1/marketing-runs/{run_id}/evidence-summary",
        frozenset({"GET"}),
    ) in route_methods
    assert (
        "/integration/v1/marketing-runs/{run_id}/evidence-snapshot",
        frozenset({"GET"}),
    ) in route_methods
    assert (
        "/integration/v1/approvals/{approval_id}/decision",
        frozenset({"POST"}),
    ) in route_methods
    assert (
        "/integration/v1/access-requests/{access_request_id}/decision",
        frozenset({"POST"}),
    ) in route_methods
    assert ("/integration/v1/webhooks", frozenset({"POST"})) in route_methods


def test_integration_router_uses_rls_and_has_no_substrate_imports():
    import app.api.integration as module

    src = inspect.getsource(module)

    assert "get_db_with_rls_dep" in src
    assert "get_current_user" in src
    assert "async def get_capabilities(" in src
    assert "async def get_platform_manifest(" in src
    assert "async def create_engagement(" in src
    assert "create_client_engagement(" in src
    assert "async def create_engagement_marketing_run(" in src
    assert "kickoff_marketing_run(" in src
    assert "_org_id_from_user(current_user)" in src
    assert "pm_substrate" not in src
    assert "packages.profile" not in src
    assert "packages/evals" not in src


def test_main_registers_neutral_integration_router():
    import app.main as module

    src = inspect.getsource(module)

    assert "from app.api.integration import router as integration_router" in src
    assert 'app.include_router(integration_router, prefix="/api")' in src


def test_engagement_envelope_links_expose_neutral_related_resources():
    import app.api.integration as module

    engagement_id = uuid.uuid4()

    links = {link.rel: link.href for link in module._engagement_links(engagement_id)}

    assert links == {
        "self": f"/api/integration/v1/engagements/{engagement_id}",
        "marketing_runs": (
            f"/api/integration/v1/engagements/{engagement_id}/marketing-runs"
        ),
        "artifacts": f"/api/integration/v1/engagements/{engagement_id}/artifacts",
        "approvals": f"/api/integration/v1/engagements/{engagement_id}/approvals",
        "access_requests": (
            f"/api/integration/v1/engagements/{engagement_id}/access-requests"
        ),
    }


def test_marketing_run_links_expose_adapter_run_evidence_resource():
    import app.api.integration as module

    run_id = uuid.uuid4()

    links = {link.rel: link.href for link in module._run_links(run_id)}

    assert (
        links["external_adapter_runs"]
        == f"/api/integration/v1/marketing-runs/{run_id}/external-adapter-runs"
    )


def test_integration_schemas_expose_stable_external_envelopes():
    from app.schemas.integration import (
        IntegrationAcceptedResponse,
        IntegrationAccessRequestEnvelope,
        IntegrationAdapterReadinessItem,
        IntegrationArtifactEnvelope,
        IntegrationCapabilityResponse,
        IntegrationClientReportEnvelope,
        IntegrationEngagementCreate,
        IntegrationPlatformManifestEnvelope,
        IntegrationEvidenceSummaryEnvelope,
        IntegrationEventIngest,
        IntegrationExternalAdapterManifest,
        IntegrationExternalAdapterRunIngest,
        IntegrationMarketingRunCreate,
        IntegrationRunDispatchEnvelope,
        IntegrationRunEventEnvelope,
        IntegrationRunEvidenceSnapshotEnvelope,
        IntegrationMarketingRunEnvelope,
        IntegrationSocialPostEnvelope,
        IntegrationStrategyAdapterReadinessEnvelope,
        IntegrationTaskEnvelope,
    )

    capability_fields = set(IntegrationCapabilityResponse.model_fields)
    platform_manifest_fields = set(IntegrationPlatformManifestEnvelope.model_fields)
    run_fields = set(IntegrationMarketingRunEnvelope.model_fields)
    dispatch_fields = set(IntegrationRunDispatchEnvelope.model_fields)
    artifact_fields = set(IntegrationArtifactEnvelope.model_fields)
    social_post_fields = set(IntegrationSocialPostEnvelope.model_fields)
    report_fields = set(IntegrationClientReportEnvelope.model_fields)
    task_fields = set(IntegrationTaskEnvelope.model_fields)
    access_request_fields = set(IntegrationAccessRequestEnvelope.model_fields)
    run_event_fields = set(IntegrationRunEventEnvelope.model_fields)
    evidence_summary_fields = set(IntegrationEvidenceSummaryEnvelope.model_fields)
    evidence_snapshot_fields = set(
        IntegrationRunEvidenceSnapshotEnvelope.model_fields
    )
    adapter_readiness_fields = set(
        IntegrationStrategyAdapterReadinessEnvelope.model_fields
    )
    adapter_readiness_item_fields = set(IntegrationAdapterReadinessItem.model_fields)
    event_fields = set(IntegrationEventIngest.model_fields)
    external_adapter_fields = set(IntegrationExternalAdapterManifest.model_fields)
    external_adapter_run_fields = set(
        IntegrationExternalAdapterRunIngest.model_fields
    )
    accepted_fields = set(IntegrationAcceptedResponse.model_fields)

    assert {"version", "service", "capabilities", "closed_loop_stages"}.issubset(
        capability_fields
    )
    assert IntegrationEngagementCreate.__name__ == "ClientEngagementCreate"
    assert IntegrationMarketingRunCreate.__name__ == "MarketingRunCreate"
    assert {
        "resource_type",
        "version",
        "service",
        "closed_loop_stages",
        "governance_gates",
        "agents",
        "queues",
        "api_endpoints",
        "data_resources",
        "configuration_requirements",
        "external_adapters",
        "links",
    }.issubset(platform_manifest_fields)
    assert {
        "id",
        "name",
        "adapter_type",
        "boundary",
        "capabilities",
        "input_contracts",
        "output_artifacts",
        "required_gates",
        "evidence_fields",
        "notes",
    }.issubset(external_adapter_fields)
    assert {
        "adapter_id",
        "adapter_run_id",
        "status",
        "gate_results",
        "input_refs",
        "output_artifacts",
        "evidence",
        "metrics",
        "idempotency_key",
    }.issubset(external_adapter_run_fields)
    assert {
        "id",
        "org_id",
        "engagement_id",
        "status",
        "stage",
        "objective",
        "strategy_summary",
        "current_blocker",
        "links",
    }.issubset(run_fields)
    assert {
        "run_id",
        "org_id",
        "status",
        "stage",
        "approved_count",
        "dispatched_count",
        "dispatched_task_ids",
        "links",
    }.issubset(dispatch_fields)
    assert {
        "id",
        "artifact_type",
        "payload_hash",
        "version",
        "evidence_refs",
        "lineage",
        "links",
    }.issubset(artifact_fields)
    assert {
        "id",
        "project_id",
        "social_account_id",
        "platform",
        "status",
        "current_content_hash",
        "scheduled_content_hash",
        "published_content_hash",
        "lineage",
        "links",
    }.issubset(social_post_fields)
    assert {
        "id",
        "org_id",
        "project_id",
        "lead_id",
        "title",
        "status",
        "cadence",
        "period_start",
        "period_end",
        "sections",
        "metrics_snapshot",
        "metrics_snapshot_hash",
        "report_hash",
        "pdf_url",
        "pdf_generated_at",
        "sent_at",
        "links",
    }.issubset(report_fields)
    assert {
        "id",
        "agent_role",
        "task_type",
        "status",
        "task_version",
        "approval_payload_hash",
        "latest_event_hash",
        "lineage",
    }.issubset(task_fields)
    assert {
        "id",
        "engagement_id",
        "marketing_run_id",
        "request_type",
        "provider",
        "status",
        "scope",
        "instructions",
        "resolved_at",
        "resolved_by_user_id",
        "links",
    }.issubset(access_request_fields)
    assert {
        "id",
        "task_id",
        "event_type",
        "payload_hash",
        "event_hash",
        "previous_event_hash",
        "lineage",
        "occurred_at",
    }.issubset(run_event_fields)
    assert {
        "run_id",
        "artifact_count",
        "artifact_type_counts",
        "task_count",
        "task_status_counts",
        "event_count",
        "event_type_counts",
        "approval_count",
        "pending_approval_count",
        "access_request_count",
        "open_access_request_count",
        "social_post_count",
        "social_post_status_counts",
        "report_count",
        "report_status_counts",
        "adapter_readiness",
        "evidence_hashes",
    }.issubset(evidence_summary_fields)
    assert {
        "strategy_artifact_present",
        "strategy_artifact_id",
        "strategy_artifact_payload_hash",
        "ready",
        "required_adapter_ids",
        "succeeded_adapter_ids",
        "missing_adapter_ids",
        "blocked_adapter_ids",
        "adapters",
    }.issubset(adapter_readiness_fields)
    assert {
        "adapter_id",
        "status",
        "run_status",
        "artifact_id",
        "artifact_payload_hash",
        "adapter_run_id",
        "required_gates",
        "missing_or_failed_gates",
        "required_evidence_fields",
        "present_evidence_fields",
        "missing_evidence_fields",
    }.issubset(adapter_readiness_item_fields)
    assert {
        "resource_type",
        "run",
        "summary",
        "tasks",
        "events",
        "artifacts",
        "approvals",
        "access_requests",
        "social_posts",
        "reports",
        "links",
    }.issubset(evidence_snapshot_fields)
    assert {"engagement_id", "event_type", "source", "payload"}.issubset(
        event_fields
    )
    assert {"ok", "status", "payload_hash", "artifact_id"}.issubset(
        accepted_fields
    )


def test_external_adapter_run_ingest_requires_retry_identity():
    from app.schemas.integration import IntegrationExternalAdapterRunIngest

    with pytest.raises(ValidationError):
        IntegrationExternalAdapterRunIngest.model_validate(
            {
                "adapter_id": "agent_harness",
                "status": "succeeded",
                "gate_results": {},
            }
        )

    request = IntegrationExternalAdapterRunIngest.model_validate(
        {
            "adapter_id": "agent_harness",
            "adapter_run_id": "external-session-1",
            "status": "succeeded",
            "gate_results": {},
        }
    )

    assert request.adapter_run_id == "external-session-1"


class _FakeExternalAdapterRunDb:
    def __init__(self):
        self.artifacts = []
        self.commit_count = 0

    def list_external_adapter_run_artifacts(self, *, org_id, run_id):
        return [
            artifact
            for artifact in self.artifacts
            if artifact.org_id == org_id
            and artifact.marketing_run_id == run_id
            and artifact.artifact_type == "external_adapter_run"
        ]

    def add(self, obj):
        if getattr(obj, "id", None) is None:
            obj.id = uuid.uuid4()
        if getattr(obj, "version", None) is None:
            obj.version = 1
        now = datetime.now(timezone.utc)
        if getattr(obj, "created_at", None) is None:
            obj.created_at = now
        if getattr(obj, "updated_at", None) is None:
            obj.updated_at = now
        self.artifacts.append(obj)

    async def flush(self):
        return None

    async def commit(self):
        self.commit_count += 1

    async def refresh(self, _obj):
        return None


AGENT_HARNESS_EVIDENCE = {
    "instance_id": "agent-instance-1",
    "session_id": "agent-session-1",
    "session_file": "sessions/agent-session-1.jsonl",
    "agent_event_hash": "a" * 64,
    "turn_id": "turn-1",
    "tool_call_id": "tool-call-1",
    "tool_call_hash": "b" * 64,
    "tool_result_hash": "c" * 64,
    "rpc_command_hash": "d" * 64,
    "state_ref": "pm://state/agent-session-1",
    "approval_payload_hash": "e" * 64,
    "output_payload_hash": "f" * 64,
}


def _adapter_artifact(
    module,
    *,
    adapter_id: str,
    evidence: dict[str, object],
    status: str = "succeeded",
    created_at: datetime | None = None,
):
    adapter = module._external_adapter_by_id(adapter_id)
    assert adapter is not None
    run_id = f"{adapter_id}-run-1"
    return SimpleNamespace(
        id=uuid.uuid4(),
        artifact_type="external_adapter_run",
        payload={
            "adapter_id": adapter_id,
            "adapter_run_id": run_id,
            "status": status,
            "gate_results": {gate: True for gate in adapter.required_gates},
            "evidence": evidence,
        },
        lineage={
            "adapter_id": adapter_id,
            "adapter_run_id": run_id,
            "status": status,
        },
        payload_hash=adapter_id.ljust(64, "0")[:64],
        created_at=created_at or datetime.now(timezone.utc),
    )


def _browser_harness_evidence(module) -> dict[str, object]:
    adapter = module._external_adapter_by_id("browser_qa_harness")
    assert adapter is not None
    evidence = {field: f"{field}-value" for field in adapter.evidence_fields}
    evidence["run_count"] = 1
    evidence["console_error_count"] = 0
    evidence["screenshot_hashes"] = ["d" * 64]
    return evidence


def _external_adapter_body(**overrides):
    from app.schemas.integration import IntegrationExternalAdapterRunIngest

    values = {
        "adapter_id": "agent_harness",
        "adapter_run_id": "agent-session-1",
        "status": "succeeded",
        "gate_results": {
            "tenant_rls": True,
            "capability_gate": True,
            "approval_payload_hash": True,
            "content_hash_gate": True,
            "sandbox_boundary": True,
            "durable_event_hash": True,
        },
        "input_refs": [
            {
                "kind": "source_record",
                "id": "plugged_in_social:marketing_runs:run-1",
                "label": "Marketing run",
            }
        ],
        "output_artifacts": [{"kind": "agent_session_tree"}],
        "evidence": dict(AGENT_HARNESS_EVIDENCE),
        "metrics": {"tool_calls": 3},
        "idempotency_key": "adapter-retry-1",
    }
    values.update(overrides)
    return IntegrationExternalAdapterRunIngest.model_validate(values)


@pytest.mark.asyncio
async def test_external_adapter_run_ingest_is_idempotent_for_matching_payload(
    monkeypatch,
):
    import app.api.integration as module

    org_id = uuid.uuid4()
    engagement_id = uuid.uuid4()
    run_id = uuid.uuid4()
    db = _FakeExternalAdapterRunDb()

    async def _fake_get_run(_db, *, org_id: uuid.UUID, run_id: uuid.UUID):
        return SimpleNamespace(
            id=run_id,
            org_id=org_id,
            engagement_id=engagement_id,
        )

    async def _fake_get_engagement(
        _db,
        *,
        org_id: uuid.UUID,
        engagement_id: uuid.UUID,
    ):
        return SimpleNamespace(id=engagement_id, org_id=org_id)

    monkeypatch.setattr(module, "_get_run", _fake_get_run)
    monkeypatch.setattr(module, "_get_engagement", _fake_get_engagement)
    dispatch_calls = []

    async def _fake_dispatch(_db, **kwargs):
        dispatch_calls.append(kwargs)
        return SimpleNamespace(approved_tasks=[], dispatched_messages=[])

    monkeypatch.setattr(
        module,
        "approve_and_dispatch_marketing_run",
        _fake_dispatch,
    )

    body = _external_adapter_body()
    first = await module.ingest_run_external_adapter_run(
        run_id=run_id,
        body=body,
        response=Response(),
        db=db,
        current_user={"org_id": str(org_id)},
    )
    retry_response = Response()
    second = await module.ingest_run_external_adapter_run(
        run_id=run_id,
        body=body,
        response=retry_response,
        db=db,
        current_user={"org_id": str(org_id)},
    )

    assert first.id == second.id
    assert len(db.artifacts) == 1
    assert db.commit_count == 1
    assert retry_response.status_code == 200
    assert second.lineage["idempotency_key"] == "adapter-retry-1"
    assert second.payload["client_idempotency_key"] == "adapter-retry-1"
    assert second.payload["adapter_contract"]["compatible_protocols"] == [
        "pi.orchestrator.spawn",
        "pi.orchestrator.rpc",
        "pi.agent_event_stream",
    ]
    assert "tool_execution_start" in second.payload["adapter_contract"][
        "required_event_types"
    ]
    assert second.payload["adapter_contract"]["required_result_shape"] is None
    assert len(dispatch_calls) == 1
    assert dispatch_calls[0]["actor_id"] == "external_adapter:agent_harness"
    assert dispatch_calls[0]["approve_tasks"] is False


@pytest.mark.asyncio
async def test_external_adapter_run_ingest_rejects_idempotency_conflict(
    monkeypatch,
):
    import app.api.integration as module

    org_id = uuid.uuid4()
    engagement_id = uuid.uuid4()
    run_id = uuid.uuid4()
    db = _FakeExternalAdapterRunDb()

    async def _fake_get_run(_db, *, org_id: uuid.UUID, run_id: uuid.UUID):
        return SimpleNamespace(
            id=run_id,
            org_id=org_id,
            engagement_id=engagement_id,
        )

    async def _fake_get_engagement(
        _db,
        *,
        org_id: uuid.UUID,
        engagement_id: uuid.UUID,
    ):
        return SimpleNamespace(id=engagement_id, org_id=org_id)

    monkeypatch.setattr(module, "_get_run", _fake_get_run)
    monkeypatch.setattr(module, "_get_engagement", _fake_get_engagement)

    async def _fake_dispatch(_db, **_kwargs):
        return SimpleNamespace(approved_tasks=[], dispatched_messages=[])

    monkeypatch.setattr(
        module,
        "approve_and_dispatch_marketing_run",
        _fake_dispatch,
    )

    await module.ingest_run_external_adapter_run(
        run_id=run_id,
        body=_external_adapter_body(),
        response=Response(),
        db=db,
        current_user={"org_id": str(org_id)},
    )

    with pytest.raises(HTTPException) as exc_info:
        await module.ingest_run_external_adapter_run(
            run_id=run_id,
            body=_external_adapter_body(metrics={"tool_calls": 4}),
            response=Response(),
            db=db,
            current_user={"org_id": str(org_id)},
        )

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail["code"] == "external_adapter_idempotency_conflict"
    assert len(db.artifacts) == 1


@pytest.mark.asyncio
async def test_external_adapter_run_ingest_rejects_succeeded_without_required_evidence(
    monkeypatch,
):
    import app.api.integration as module

    org_id = uuid.uuid4()
    engagement_id = uuid.uuid4()
    run_id = uuid.uuid4()
    db = _FakeExternalAdapterRunDb()

    async def _fake_get_run(_db, *, org_id: uuid.UUID, run_id: uuid.UUID):
        return SimpleNamespace(
            id=run_id,
            org_id=org_id,
            engagement_id=engagement_id,
        )

    monkeypatch.setattr(module, "_get_run", _fake_get_run)

    evidence = dict(AGENT_HARNESS_EVIDENCE)
    evidence.pop("agent_event_hash")

    with pytest.raises(HTTPException) as exc_info:
        await module.ingest_run_external_adapter_run(
            run_id=run_id,
            body=_external_adapter_body(evidence=evidence),
            response=Response(),
            db=db,
            current_user={"org_id": str(org_id)},
        )

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail["code"] == "external_adapter_evidence_missing"
    assert exc_info.value.detail["missing_evidence_fields"] == ["agent_event_hash"]
    assert db.artifacts == []


@pytest.mark.asyncio
async def test_external_adapter_run_ingest_allows_partial_without_full_evidence(
    monkeypatch,
):
    import app.api.integration as module

    org_id = uuid.uuid4()
    engagement_id = uuid.uuid4()
    run_id = uuid.uuid4()
    db = _FakeExternalAdapterRunDb()

    async def _fake_get_run(_db, *, org_id: uuid.UUID, run_id: uuid.UUID):
        return SimpleNamespace(
            id=run_id,
            org_id=org_id,
            engagement_id=engagement_id,
        )

    async def _fake_get_engagement(
        _db,
        *,
        org_id: uuid.UUID,
        engagement_id: uuid.UUID,
    ):
        return SimpleNamespace(id=engagement_id, org_id=org_id)

    async def _fake_dispatch(_db, **_kwargs):
        return SimpleNamespace(approved_tasks=[], dispatched_messages=[])

    monkeypatch.setattr(module, "_get_run", _fake_get_run)
    monkeypatch.setattr(module, "_get_engagement", _fake_get_engagement)
    monkeypatch.setattr(module, "approve_and_dispatch_marketing_run", _fake_dispatch)

    result = await module.ingest_run_external_adapter_run(
        run_id=run_id,
        body=_external_adapter_body(
            status="partial",
            evidence={"session_id": "agent-session-1"},
            idempotency_key="adapter-partial-1",
        ),
        response=Response(),
        db=db,
        current_user={"org_id": str(org_id)},
    )

    assert result.payload["status"] == "partial"
    assert len(db.artifacts) == 1


def test_strategy_adapter_readiness_reports_manifest_evidence_gaps():
    import app.api.integration as module

    strategy_artifact = SimpleNamespace(
        id=uuid.uuid4(),
        artifact_type="strategy_research_brief",
        payload={
            "external_adapter_requirements": [
                {
                    "adapter_id": "browser_qa_harness",
                    "required_evidence_fields": [
                        "session_id",
                        "report_html_hash",
                        "network_har_hash",
                    ],
                },
                {
                    "adapter_id": "agent_harness",
                    "required_evidence_fields": [
                        "session_id",
                        "agent_event_hash",
                        "output_payload_hash",
                    ],
                },
            ]
        },
        payload_hash="s" * 64,
        created_at=datetime.now(timezone.utc),
    )
    partial_browser_run = _adapter_artifact(
        module,
        adapter_id="browser_qa_harness",
        evidence={"session_id": "browser-session-1"},
    )
    complete_agent_run = _adapter_artifact(
        module,
        adapter_id="agent_harness",
        evidence=dict(AGENT_HARNESS_EVIDENCE),
    )

    readiness = module._build_strategy_adapter_readiness(
        [strategy_artifact, partial_browser_run, complete_agent_run]
    )

    assert readiness.strategy_artifact_present is True
    assert readiness.strategy_artifact_id == strategy_artifact.id
    assert readiness.ready is False
    assert readiness.required_adapter_ids == ["agent_harness", "browser_qa_harness"]
    assert readiness.succeeded_adapter_ids == ["agent_harness"]
    assert readiness.missing_adapter_ids == ["browser_qa_harness"]
    assert readiness.blocked_adapter_ids == ["browser_qa_harness"]

    browser = next(
        item for item in readiness.adapters if item.adapter_id == "browser_qa_harness"
    )
    assert browser.status == "incomplete"
    assert browser.run_status == "succeeded"
    assert browser.missing_or_failed_gates == []
    assert "session_id" in browser.present_evidence_fields
    assert "report_html_hash" in browser.missing_evidence_fields
    assert "console_error_count" in browser.missing_evidence_fields

    agent = next(item for item in readiness.adapters if item.adapter_id == "agent_harness")
    assert agent.status == "ready"
    assert agent.missing_evidence_fields == []


def test_strategy_adapter_readiness_marks_all_adapters_ready_with_full_evidence():
    import app.api.integration as module

    strategy_artifact = SimpleNamespace(
        id=uuid.uuid4(),
        artifact_type="strategy_research_brief",
        payload={
            "external_adapter_requirements": [
                {"adapter_id": "browser_qa_harness"},
                {"adapter_id": "agent_harness"},
            ]
        },
        payload_hash="s" * 64,
        created_at=datetime.now(timezone.utc),
    )
    readiness = module._build_strategy_adapter_readiness(
        [
            strategy_artifact,
            _adapter_artifact(
                module,
                adapter_id="browser_qa_harness",
                evidence=_browser_harness_evidence(module),
            ),
            _adapter_artifact(
                module,
                adapter_id="agent_harness",
                evidence=dict(AGENT_HARNESS_EVIDENCE),
            ),
        ]
    )

    assert readiness.ready is True
    assert readiness.missing_adapter_ids == []
    assert readiness.blocked_adapter_ids == []
    assert readiness.succeeded_adapter_ids == ["agent_harness", "browser_qa_harness"]


def test_platform_manifest_exposes_agents_config_data_and_gates():
    import app.api.integration as module

    manifest = module._platform_manifest()

    assert manifest.resource_type == "plugged_in_social_platform_manifest"
    assert manifest.closed_loop_stages == [
        "intake",
        "strategy",
        "content",
        "approval",
        "scheduling",
        "publishing",
        "metrics",
        "report",
        "next_action",
    ]
    assert {agent.role for agent in manifest.agents} == {
        "chief_of_staff",
        "content_creative",
        "scheduling_distribution",
        "community_engagement",
        "analytics_reporting",
    }
    content_agent = next(
        agent for agent in manifest.agents if agent.role == "content_creative"
    )
    assert content_agent.queue == "stevie-virtual-agency"
    assert "social_post.create" in content_agent.writes
    assert "social_post.draft_created" in content_agent.emits
    assert any(queue.queue == "stevie-virtual-agency" for queue in manifest.queues)
    assert any(
        endpoint.path == "/api/internal/virtual-agency/task"
        and endpoint.boundary == "internal_system_rls"
        for endpoint in manifest.api_endpoints
    )
    assert any(
        endpoint.path == "/api/integration/v1/marketing-runs/{run_id}/dispatch"
        and "marketing_run.dispatch" in endpoint.capability_ids
        for endpoint in manifest.api_endpoints
    )
    assert any(
        endpoint.path == "/api/integration/v1/external-adapters"
        and endpoint.boundary == "public_rls"
        and "external_adapter_manifest.read" in endpoint.capability_ids
        for endpoint in manifest.api_endpoints
    )
    assert any(
        endpoint.path == "/api/integration/v1/engagements"
        and endpoint.method == "POST"
        and endpoint.boundary == "public_rls"
        and "engagement.create" in endpoint.capability_ids
        for endpoint in manifest.api_endpoints
    )
    assert any(
        endpoint.path == "/api/integration/v1/engagements/{engagement_id}/marketing-runs"
        and endpoint.method == "POST"
        and endpoint.boundary == "public_rls"
        and "marketing_run.create" in endpoint.capability_ids
        for endpoint in manifest.api_endpoints
    )
    assert any(
        endpoint.path == "/api/integration/v1/engagements/{engagement_id}/marketing-runs"
        and endpoint.boundary == "public_rls"
        and "marketing_run.read" in endpoint.capability_ids
        for endpoint in manifest.api_endpoints
    )
    assert any(
        endpoint.path == "/api/integration/v1/engagements/{engagement_id}/artifacts"
        and endpoint.boundary == "public_rls"
        and "artifact.read" in endpoint.capability_ids
        for endpoint in manifest.api_endpoints
    )
    assert any(
        endpoint.path == "/api/integration/v1/engagements/{engagement_id}/approvals"
        and endpoint.boundary == "public_rls"
        and "approval.read" in endpoint.capability_ids
        for endpoint in manifest.api_endpoints
    )
    assert any(
        endpoint.path == "/api/integration/v1/engagements/{engagement_id}/access-requests"
        and endpoint.boundary == "public_rls"
        and "access_request.read" in endpoint.capability_ids
        for endpoint in manifest.api_endpoints
    )
    assert any(
        resource.table == "marketing_runs"
        and "marketing_run.create" in resource.write_capability_ids
        and "marketing_run.dispatch" in resource.write_capability_ids
        for resource in manifest.data_resources
    )
    assert any(
        resource.table == "client_engagements"
        and "engagement.create" in resource.write_capability_ids
        for resource in manifest.data_resources
    )
    assert any(
        resource.table == "virtual_agency_events"
        and "event_hash" in resource.durable_evidence_fields
        for resource in manifest.data_resources
    )
    assert any(
        resource.table == "agency_access_requests"
        and "access_request.decide" in resource.write_capability_ids
        for resource in manifest.data_resources
    )
    assert any(
        endpoint.path == "/api/integration/v1/access-requests/{access_request_id}/decision"
        and endpoint.boundary == "public_rls"
        for endpoint in manifest.api_endpoints
    )
    assert any(
        endpoint.path == "/api/integration/v1/marketing-runs/{run_id}/social-posts"
        and endpoint.boundary == "public_rls"
        and "social_post.read" in endpoint.capability_ids
        for endpoint in manifest.api_endpoints
    )
    assert any(
        endpoint.path == "/api/integration/v1/marketing-runs/{run_id}/reports"
        and endpoint.boundary == "public_rls"
        and "report.read" in endpoint.capability_ids
        for endpoint in manifest.api_endpoints
    )
    assert any(
        endpoint.path == "/api/integration/v1/reports/{report_id}"
        and endpoint.boundary == "public_rls"
        and "report.read" in endpoint.capability_ids
        for endpoint in manifest.api_endpoints
    )
    assert any(
        endpoint.path == "/api/integration/v1/marketing-runs/{run_id}/evidence-snapshot"
        and endpoint.boundary == "public_rls"
        and "run_evidence_snapshot.read" in endpoint.capability_ids
        for endpoint in manifest.api_endpoints
    )
    assert any(
        endpoint.path == "/api/integration/v1/marketing-runs/{run_id}/external-adapter-runs"
        and endpoint.method == "GET"
        and endpoint.boundary == "public_rls"
        and "external_adapter_run.read" in endpoint.capability_ids
        for endpoint in manifest.api_endpoints
    )
    assert any(
        endpoint.path == "/api/integration/v1/marketing-runs/{run_id}/external-adapter-runs"
        and endpoint.method == "POST"
        and endpoint.boundary == "public_rls"
        and "external_adapter_run.ingest" in endpoint.capability_ids
        for endpoint in manifest.api_endpoints
    )
    assert any(
        capability.id == "run_evidence_snapshot.read"
        and "virtual_agency_task" in capability.resources
        and "social_post" in capability.resources
        and "client_report" in capability.resources
        for capability in module._capabilities()
    )
    assert any(
        capability.id == "report.read"
        and "client_report" in capability.resources
        for capability in module._capabilities()
    )
    assert any(
        capability.id == "external_adapter_run.read"
        and "external_adapter_run" in capability.resources
        and "agency_artifact" in capability.resources
        for capability in module._capabilities()
    )
    assert any(
        capability.id == "external_adapter_run.ingest"
        and "external_adapter_run" in capability.resources
        and "agency_artifact" in capability.resources
        for capability in module._capabilities()
    )
    assert any(
        capability.id == "engagement.create"
        and "client_engagement" in capability.resources
        for capability in module._capabilities()
    )
    assert any(
        capability.id == "marketing_run.create"
        and "marketing_run" in capability.resources
        and "agency_artifact" in capability.resources
        and "agency_access_request" in capability.resources
        and "virtual_agency_task" in capability.resources
        for capability in module._capabilities()
    )
    assert any(
        capability.id == "external_adapter_manifest.read"
        and "external_adapter" in capability.resources
        for capability in module._capabilities()
    )
    assert {adapter.id for adapter in manifest.external_adapters} == {
        "agent_harness",
        "browser_qa_harness",
    }
    agent_adapter = next(
        adapter for adapter in manifest.external_adapters if adapter.id == "agent_harness"
    )
    browser_adapter = next(
        adapter
        for adapter in manifest.external_adapters
        if adapter.id == "browser_qa_harness"
    )
    assert agent_adapter.boundary == "containerized_process"
    assert "sandbox_boundary" in agent_adapter.required_gates
    assert "pi_spawn_request" in agent_adapter.input_contracts
    assert "agent_event_stream" in agent_adapter.output_artifacts
    assert "tool_execution_events" in agent_adapter.output_artifacts
    assert "pi.orchestrator.spawn" in agent_adapter.notes["compatible_protocols"]
    assert "tool_execution_start" in agent_adapter.notes["required_event_types"]
    assert "agent_event_hash" in agent_adapter.evidence_fields
    assert "tool_call_hash" in agent_adapter.evidence_fields
    assert browser_adapter.boundary == "sandboxed_process"
    assert "canary_session_start" in browser_adapter.input_contracts
    assert "session_manifest" in browser_adapter.output_artifacts
    assert "results_json" in browser_adapter.output_artifacts
    assert "network_har" in browser_adapter.output_artifacts
    assert "evidence_hash_gate" in browser_adapter.required_gates
    assert "canary.session-start" in browser_adapter.notes["compatible_protocols"]
    assert browser_adapter.notes["required_result_shape"]["artifacts"] == [
        "kind",
        "path",
        "bytes",
    ]
    assert "report_html_hash" in browser_adapter.evidence_fields
    assert "network_har_hash" in browser_adapter.evidence_fields
    assert any(
        resource.table == "social_posts"
        and "current_content_hash" in resource.durable_evidence_fields
        and "lineage" in resource.durable_evidence_fields
        for resource in manifest.data_resources
    )
    assert any(
        resource.table == "client_reports"
        and "metrics_snapshot" in resource.durable_evidence_fields
        and "report.read" in resource.read_capability_ids
        for resource in manifest.data_resources
    )
    assert any(
        resource.table == "agency_artifacts"
        and "external_adapter_run.read" in resource.read_capability_ids
        and "external_adapter_run.ingest" in resource.write_capability_ids
        for resource in manifest.data_resources
    )
    assert any(
        config.key == "BACKEND_BASE_URL" and config.kind == "secret"
        for config in manifest.configuration_requirements
    )
    assert "tenant_rls" in manifest.governance_gates
    assert "content_hash_gate" in manifest.governance_gates
    assert "strategy_research_artifact_gate" in manifest.governance_gates
    assert "external_adapter_run_evidence_gate" in manifest.governance_gates
    assert "external_adapter_boundary" in manifest.governance_gates
    assert "sandbox_boundary" in manifest.governance_gates


def test_external_adapter_run_gate_validation_requires_manifest_gates():
    import app.api.integration as module

    adapter = module._external_adapter_by_id("agent_harness")
    assert adapter is not None

    missing = module._missing_external_adapter_gates(
        adapter,
        {
            "tenant_rls": True,
            "capability_gate": True,
            "approval_payload_hash": True,
        },
    )
    satisfied = module._missing_external_adapter_gates(
        adapter,
        {gate: True for gate in adapter.required_gates},
    )

    assert "content_hash_gate" in missing
    assert "sandbox_boundary" in missing
    assert "durable_event_hash" in missing
    assert satisfied == []


def test_social_post_integration_envelope_derives_hash_and_lineage():
    import app.api.integration as module
    from app.models.agency import MarketingRun
    from app.models.social_media import SocialPost
    from app.services.virtual_agency_orchestration import social_post_content_hash

    org_id = uuid.uuid4()
    run_id = uuid.uuid4()
    project_id = uuid.uuid4()
    account_id = uuid.uuid4()
    post = SocialPost(
        id=uuid.uuid4(),
        org_id=org_id,
        project_id=project_id,
        social_account_id=account_id,
        platform="linkedin",
        status="scheduled",
        caption="Approved campaign draft",
        hashtags=["launch"],
        media_urls=["r2://media/launch.png"],
        media_type="image",
        scheduled_at=datetime.now(timezone.utc),
        created_by_agent="content_creative",
        version=2,
        scheduled_content_hash="a" * 64,
        likes=0,
        comments=0,
        shares=0,
        impressions=0,
        reach=0,
        engagement_rate=None,
        internal_notes=(
            'Lineage: {"client_request":"Launch","project_id":"'
            f'{project_id}","legacy_task_id":"{uuid.uuid4()}",'
            f'"marketing_run_id":"{run_id}"}}'
        ),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    run = MarketingRun(
        id=run_id,
        org_id=org_id,
        engagement_id=uuid.uuid4(),
        project_id=project_id,
        status="active",
        stage="execution",
        objective="Launch campaign",
    )

    envelope = module._to_social_post(post)

    assert module._social_post_belongs_to_run(post, run)
    assert envelope.resource_type == "social_post"
    assert envelope.lineage["marketing_run_id"] == str(run_id)
    assert envelope.current_content_hash == social_post_content_hash(post)
    assert envelope.scheduled_content_hash == "a" * 64


def test_client_report_integration_envelope_derives_hashes_without_private_fields():
    import app.api.integration as module
    from app.models.report import ClientReport, ReportCadence, ReportStatus

    org_id = uuid.uuid4()
    project_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    report = ClientReport(
        id=uuid.uuid4(),
        org_id=org_id,
        project_id=project_id,
        lead_id=uuid.uuid4(),
        title="Launch conversion report",
        status=ReportStatus.generated.value,
        cadence=ReportCadence.weekly.value,
        compound_phase="amplify",
        created_by_agent="analytics_reporting",
        client_name="Acme",
        client_email="client@example.com",
        period_start=date(2026, 6, 24),
        period_end=date(2026, 7, 1),
        sections=[{"type": "kpi_grid", "title": "Pipeline"}],
        metrics_snapshot={
            "qualified_leads_generated": 18,
            "avg_engagement_rate": 7.3,
        },
        pdf_url="r2://reports/launch.pdf",
        pdf_generated_at=now,
        sent_at=None,
        created_at=now,
        updated_at=now,
        share_token="private-share-token",
        internal_notes="internal only",
    )

    envelope = module._to_report(report)
    dumped = envelope.model_dump()

    assert envelope.resource_type == "client_report"
    assert envelope.metrics_snapshot == report.metrics_snapshot
    assert len(envelope.metrics_snapshot_hash) == 64
    assert len(envelope.report_hash) == 64
    assert "share_token" not in dumped
    assert "internal_notes" not in dumped
    assert envelope.links[0].href == f"/api/integration/v1/reports/{report.id}"
