from __future__ import annotations

import inspect


def test_integration_router_imports_with_neutral_v1_prefix():
    import app.api.integration as module

    assert module.router.prefix == "/integration/v1"
    route_methods = {
        (route.path, frozenset(route.methods or set()))
        for route in module.router.routes
    }

    assert ("/integration/v1/capabilities", frozenset({"GET"})) in route_methods
    assert ("/integration/v1/events", frozenset({"POST"})) in route_methods
    assert ("/integration/v1/engagements", frozenset({"GET"})) in route_methods
    assert (
        "/integration/v1/engagements/{engagement_id}",
        frozenset({"GET"}),
    ) in route_methods
    assert (
        "/integration/v1/marketing-runs/{run_id}",
        frozenset({"GET"}),
    ) in route_methods
    assert (
        "/integration/v1/marketing-runs/{run_id}/artifacts",
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
        "/integration/v1/marketing-runs/{run_id}/events",
        frozenset({"GET"}),
    ) in route_methods
    assert (
        "/integration/v1/marketing-runs/{run_id}/evidence-summary",
        frozenset({"GET"}),
    ) in route_methods
    assert (
        "/integration/v1/approvals/{approval_id}/decision",
        frozenset({"POST"}),
    ) in route_methods
    assert ("/integration/v1/webhooks", frozenset({"POST"})) in route_methods


def test_integration_router_uses_rls_and_has_no_substrate_imports():
    import app.api.integration as module

    src = inspect.getsource(module)

    assert "get_db_with_rls_dep" in src
    assert "get_current_user" in src
    assert "async def get_capabilities(" in src
    assert "_org_id_from_user(current_user)" in src
    assert "pm_substrate" not in src
    assert "packages.profile" not in src
    assert "packages/evals" not in src


def test_main_registers_neutral_integration_router():
    import app.main as module

    src = inspect.getsource(module)

    assert "from app.api.integration import router as integration_router" in src
    assert 'app.include_router(integration_router, prefix="/api")' in src


def test_integration_schemas_expose_stable_external_envelopes():
    from app.schemas.integration import (
        IntegrationAcceptedResponse,
        IntegrationArtifactEnvelope,
        IntegrationCapabilityResponse,
        IntegrationEvidenceSummaryEnvelope,
        IntegrationEventIngest,
        IntegrationRunEventEnvelope,
        IntegrationMarketingRunEnvelope,
        IntegrationTaskEnvelope,
    )

    capability_fields = set(IntegrationCapabilityResponse.model_fields)
    run_fields = set(IntegrationMarketingRunEnvelope.model_fields)
    artifact_fields = set(IntegrationArtifactEnvelope.model_fields)
    task_fields = set(IntegrationTaskEnvelope.model_fields)
    run_event_fields = set(IntegrationRunEventEnvelope.model_fields)
    evidence_summary_fields = set(IntegrationEvidenceSummaryEnvelope.model_fields)
    event_fields = set(IntegrationEventIngest.model_fields)
    accepted_fields = set(IntegrationAcceptedResponse.model_fields)

    assert {"version", "service", "capabilities", "closed_loop_stages"}.issubset(
        capability_fields
    )
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
        "pending_approval_count",
        "evidence_hashes",
    }.issubset(evidence_summary_fields)
    assert {"engagement_id", "event_type", "source", "payload"}.issubset(
        event_fields
    )
    assert {"ok", "status", "payload_hash", "artifact_id"}.issubset(
        accepted_fields
    )
