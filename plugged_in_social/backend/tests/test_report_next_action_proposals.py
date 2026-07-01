from __future__ import annotations

import inspect
import uuid
from collections import defaultdict
from datetime import date, datetime, timezone

from app.api.internal import reports as internal_reports
from app.models.report import ClientReport, ReportStatus
from app.models.virtual_agency import (
    VirtualAgencyEvent,
    VirtualAgencyEventType,
    VirtualAgencyTask,
)
from app.services.report_next_actions import (
    create_next_action_proposal_task_for_report,
)
from app.services.virtual_agency import AGENT_ANALYTICS


class _FakeSyncSession:
    def __init__(self):
        self._store: dict[type[object], dict[uuid.UUID, object]] = defaultdict(dict)
        self.flush_count = 0

    def add(self, obj):
        if getattr(obj, "id", None) is None:
            obj.id = uuid.uuid4()
        self._store[type(obj)][obj.id] = obj

    def flush(self):
        self.flush_count += 1

    def find_virtual_task_by_creation_idempotency_key(self, key: str):
        for task in self._store.get(VirtualAgencyTask, {}).values():
            if task.creation_idempotency_key == key:
                return task
        return None


def _report(**overrides) -> ClientReport:
    values = {
        "id": uuid.UUID("11111111-1111-4111-8111-111111111111"),
        "org_id": uuid.UUID("22222222-2222-4222-8222-222222222222"),
        "project_id": uuid.UUID("33333333-3333-4333-8333-333333333333"),
        "title": "Summer pipeline report",
        "status": ReportStatus.generated.value,
        "cadence": "weekly",
        "period_start": date(2026, 6, 24),
        "period_end": date(2026, 7, 1),
        "metrics_snapshot": {
            "total_reach": 400,
            "avg_engagement_rate": 7.3,
            "qualified_leads_generated": 18,
        },
        "pdf_url": "https://reports.example/summer.pdf",
        "pdf_generated_at": datetime(2026, 7, 1, 17, 45, tzinfo=timezone.utc),
    }
    values.update(overrides)
    return ClientReport(**values)


def test_generated_report_creates_idempotent_next_action_task_with_evidence_refs():
    db = _FakeSyncSession()
    report = _report()

    first = create_next_action_proposal_task_for_report(
        db,
        report=report,
        actor_id="system:report-builder",
    )
    second = create_next_action_proposal_task_for_report(
        db,
        report=report,
        actor_id="system:report-builder",
    )

    assert first is second
    assert first is not None
    assert first.org_id == report.org_id
    assert first.project_id == report.project_id
    assert first.agent_role == AGENT_ANALYTICS
    assert first.task_type == "next_action_proposal"
    assert first.creation_idempotency_key == f"va-next-action:{report.id}"
    assert first.context["source_report"]["client_report_id"] == str(report.id)
    assert first.context["source_report"]["status"] == "generated"
    assert first.context["pm_substrate"]["adapter"] == (
        "packages/profile-agency/src/plugged-in-social-axis-b-adapter.ts"
    )
    assert first.context["evidence_refs"] == [
        {
            "kind": "source_record",
            "id": f"plugged_in_social:client_reports:{report.id}",
            "label": "PluggedInSocial ClientReport row",
        },
        {
            "kind": "source_record",
            "id": f"plugged_in_social:client_reports:{report.id}:metrics_snapshot",
            "label": "PluggedInSocial ClientReport metrics_snapshot",
        },
        {
            "kind": "source_record",
            "id": (
                f"plugged_in_social:analytics_daily:{report.org_id}:"
                "2026-06-24:2026-07-01"
            ),
            "label": "PluggedInSocial analytics_daily period",
        },
    ]
    assert first.context["content_hashes"]["metrics_snapshot_hash"]
    assert first.lineage["client_report_id"] == str(report.id)
    assert first.lineage["orchestration_task_id"] == str(first.id)

    tasks = list(db._store.get(VirtualAgencyTask, {}).values())
    events = list(db._store.get(VirtualAgencyEvent, {}).values())
    assert tasks == [first]
    assert len(events) == 1
    assert events[0].event_type == VirtualAgencyEventType.task_created.value
    assert events[0].idempotency_key == f"va-event:create-next-action:{report.id}"
    assert events[0].payload["context"] == first.context


def test_report_without_project_does_not_create_invalid_orchestration_task():
    db = _FakeSyncSession()
    report = _report(project_id=None)

    task = create_next_action_proposal_task_for_report(
        db,
        report=report,
        actor_id="system:report-builder",
    )

    assert task is None
    assert list(db._store.get(VirtualAgencyTask, {}).values()) == []
    assert list(db._store.get(VirtualAgencyEvent, {}).values()) == []


def test_report_render_persists_next_action_task_before_terminal_commit():
    src = inspect.getsource(internal_reports._render_report_sync)

    generated_pos = src.index("report.status = ReportStatus.generated.value")
    next_action_pos = src.index("create_next_action_proposal_task_for_report(")
    final_commit_pos = src.index("db.commit()", next_action_pos)

    assert generated_pos < next_action_pos < final_commit_pos
