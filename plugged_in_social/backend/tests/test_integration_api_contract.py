from __future__ import annotations

import inspect
import uuid
from datetime import date, datetime, timezone


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
    assert (
        "/integration/v1/engagements/{engagement_id}",
        frozenset({"GET"}),
    ) in route_methods
    assert (
        "/integration/v1/engagements/{engagement_id}/marketing-runs",
        frozenset({"GET"}),
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


def test_integration_schemas_expose_stable_external_envelopes():
    from app.schemas.integration import (
        IntegrationAcceptedResponse,
        IntegrationAccessRequestEnvelope,
        IntegrationArtifactEnvelope,
        IntegrationCapabilityResponse,
        IntegrationClientReportEnvelope,
        IntegrationPlatformManifestEnvelope,
        IntegrationEvidenceSummaryEnvelope,
        IntegrationEventIngest,
        IntegrationExternalAdapterManifest,
        IntegrationRunDispatchEnvelope,
        IntegrationRunEventEnvelope,
        IntegrationRunEvidenceSnapshotEnvelope,
        IntegrationMarketingRunEnvelope,
        IntegrationSocialPostEnvelope,
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
    event_fields = set(IntegrationEventIngest.model_fields)
    external_adapter_fields = set(IntegrationExternalAdapterManifest.model_fields)
    accepted_fields = set(IntegrationAcceptedResponse.model_fields)

    assert {"version", "service", "capabilities", "closed_loop_stages"}.issubset(
        capability_fields
    )
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
        "evidence_hashes",
    }.issubset(evidence_summary_fields)
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
        and "marketing_run.dispatch" in resource.write_capability_ids
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
    assert "tool_call_hash" in agent_adapter.evidence_fields
    assert browser_adapter.boundary == "sandboxed_process"
    assert "network_har" in browser_adapter.output_artifacts
    assert "evidence_hash_gate" in browser_adapter.required_gates
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
        config.key == "BACKEND_BASE_URL" and config.kind == "secret"
        for config in manifest.configuration_requirements
    )
    assert "tenant_rls" in manifest.governance_gates
    assert "content_hash_gate" in manifest.governance_gates
    assert "external_adapter_boundary" in manifest.governance_gates
    assert "sandbox_boundary" in manifest.governance_gates


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
