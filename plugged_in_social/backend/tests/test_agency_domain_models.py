from __future__ import annotations

import pytest
from pydantic import ValidationError
from sqlalchemy import inspect


def test_agency_models_export_expected_table_names():
    from app.models import (
        AgencyAccessRequest,
        AgencyApprovalRequest,
        AgencyArtifact,
        ClientEngagement,
        MarketingRun,
    )

    assert ClientEngagement.__tablename__ == "client_engagements"
    assert MarketingRun.__tablename__ == "marketing_runs"
    assert AgencyArtifact.__tablename__ == "agency_artifacts"
    assert AgencyApprovalRequest.__tablename__ == "agency_approval_requests"
    assert AgencyAccessRequest.__tablename__ == "agency_access_requests"


def test_client_engagement_columns_support_intake_and_integrations():
    from app.models.agency import ClientEngagement

    columns = {column.name for column in inspect(ClientEngagement).columns}

    assert {
        "id",
        "org_id",
        "lead_id",
        "project_id",
        "name",
        "client_url",
        "repo_url",
        "client_name",
        "client_email",
        "status",
        "goals",
        "constraints",
        "intake_payload",
        "integration_state",
        "created_by_agent",
        "created_at",
        "updated_at",
    }.issubset(columns)


def test_marketing_run_columns_track_lifecycle_and_blockers():
    from app.models.agency import MarketingRun

    columns = {column.name for column in inspect(MarketingRun).columns}

    assert {
        "id",
        "org_id",
        "engagement_id",
        "project_id",
        "status",
        "stage",
        "objective",
        "strategy_summary",
        "current_blocker",
        "started_at",
        "completed_at",
        "created_at",
        "updated_at",
    }.issubset(columns)


def test_artifact_approval_and_access_tables_are_hashable_and_traceable():
    from app.models.agency import (
        AgencyAccessRequest,
        AgencyApprovalRequest,
        AgencyArtifact,
    )

    artifact_columns = {column.name for column in inspect(AgencyArtifact).columns}
    approval_columns = {column.name for column in inspect(AgencyApprovalRequest).columns}
    access_columns = {column.name for column in inspect(AgencyAccessRequest).columns}

    assert {
        "artifact_type",
        "title",
        "body",
        "payload",
        "payload_hash",
        "version",
        "evidence_refs",
        "lineage",
        "author_role",
    }.issubset(artifact_columns)

    assert {
        "approval_type",
        "status",
        "subject_type",
        "subject_id",
        "approval_version",
        "approval_payload_hash",
        "decided_at",
        "decided_by_user_id",
    }.issubset(approval_columns)

    assert {
        "request_type",
        "provider",
        "status",
        "scope",
        "reason",
        "instructions",
        "resolved_at",
    }.issubset(access_columns)


def test_client_engagement_create_schema_requires_name_or_url():
    from app.schemas.agency import ClientEngagementCreate

    with pytest.raises(ValidationError):
        ClientEngagementCreate()

    body = ClientEngagementCreate(
        name="Acme",
        client_url="https://example.com",
        goals=["increase qualified leads"],
    )

    assert body.name == "Acme"
    assert str(body.client_url) == "https://example.com/"
    assert body.goals == ["increase qualified leads"]


def test_agency_artifact_create_schema_accepts_evidence_refs():
    from app.schemas.agency import AgencyArtifactCreate

    body = AgencyArtifactCreate(
        artifact_type="research_brief",
        title="Research brief",
        body="Initial findings",
        payload={"positioning": "trust-first"},
        evidence_refs=[
            {
                "kind": "url",
                "id": "https://example.com",
                "label": "Client homepage",
            }
        ],
        author_role="research_strategist",
    )

    assert body.artifact_type == "research_brief"
    assert body.evidence_refs[0].kind == "url"


def test_approval_decision_schema_validates_supported_decisions():
    from app.schemas.agency import AgencyApprovalDecision

    assert AgencyApprovalDecision(decision="approved").decision == "approved"

    with pytest.raises(ValidationError):
        AgencyApprovalDecision(decision="maybe")
