"""Bridge generated ClientReports into durable virtual-agency next actions."""
from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.models.report import ClientReport, ReportStatus
from app.models.virtual_agency import (
    VirtualAgencyEventType,
    VirtualAgencyTask,
    VirtualAgencyTaskStatus,
)
from app.services.virtual_agency import AGENT_ANALYTICS
from app.services.virtual_agency_orchestration import (
    build_event,
    build_handoff_payload,
    build_lineage,
    compute_hash,
)

PM_SUBSTRATE_AXIS_B_ADAPTER = (
    "packages/profile-agency/src/plugged-in-social-axis-b-adapter.ts"
)
PM_SUBSTRATE_NEXT_ACTION_PROPOSAL = (
    "packages/profile-agency/src/next-action-proposal.ts"
)

_GENERATED_REPORT_STATUSES = {
    ReportStatus.generated.value,
    ReportStatus.sent.value,
}


def create_next_action_proposal_task_for_report(
    db: Session,
    *,
    report: ClientReport,
    actor_id: str | None,
) -> VirtualAgencyTask | None:
    """Create the next-action proposal task for a generated ClientReport.

    This is the backend-side durable handoff that closes the report ->
    next-action loop. It does not execute the recommendation directly; it
    records a reviewable virtual-agency task whose context points to the
    report, metrics snapshot, substrate adapter, and content hashes.
    """
    if report.project_id is None:
        return None
    if report.status not in _GENERATED_REPORT_STATUSES:
        return None

    idempotency_key = f"va-next-action:{report.id}"
    existing = _find_task_by_creation_idempotency_key(db, idempotency_key)
    if existing is not None:
        return existing

    metrics_snapshot = report.metrics_snapshot or {}
    metrics_snapshot_hash = compute_hash(metrics_snapshot)
    report_hash = compute_hash(
        {
            "client_report_id": str(report.id),
            "org_id": str(report.org_id),
            "project_id": str(report.project_id),
            "period_start": report.period_start,
            "period_end": report.period_end,
            "metrics_snapshot_hash": metrics_snapshot_hash,
            "pdf_url": report.pdf_url,
            "pdf_generated_at": report.pdf_generated_at,
        }
    )
    context = _build_context(
        report=report,
        metrics_snapshot=metrics_snapshot,
        metrics_snapshot_hash=metrics_snapshot_hash,
        report_hash=report_hash,
    )
    task = _build_task(report=report, idempotency_key=idempotency_key, context=context)
    db.add(task)
    db.flush()

    task.lineage["orchestration_task_id"] = str(task.id)
    event = build_event(
        task=task,
        event_type=VirtualAgencyEventType.task_created.value,
        idempotency_key=f"va-event:create-next-action:{report.id}",
        actor_role=AGENT_ANALYTICS,
        actor_id=actor_id,
        payload=build_handoff_payload(task),
        approval_version=None,
    )
    db.add(event)
    db.flush()
    return task


async def create_next_action_proposal_task_for_report_async(
    db: AsyncSession,
    *,
    report: ClientReport,
    actor_id: str | None,
) -> VirtualAgencyTask | None:
    """AsyncSession variant for public/API report approval paths."""
    if report.project_id is None:
        return None
    if report.status not in _GENERATED_REPORT_STATUSES:
        return None

    idempotency_key = f"va-next-action:{report.id}"
    existing = await _find_task_by_creation_idempotency_key_async(db, idempotency_key)
    if existing is not None:
        return existing

    metrics_snapshot = report.metrics_snapshot or {}
    metrics_snapshot_hash = compute_hash(metrics_snapshot)
    report_hash = compute_hash(
        {
            "client_report_id": str(report.id),
            "org_id": str(report.org_id),
            "project_id": str(report.project_id),
            "period_start": report.period_start,
            "period_end": report.period_end,
            "metrics_snapshot_hash": metrics_snapshot_hash,
            "pdf_url": report.pdf_url,
            "pdf_generated_at": report.pdf_generated_at,
        }
    )
    context = _build_context(
        report=report,
        metrics_snapshot=metrics_snapshot,
        metrics_snapshot_hash=metrics_snapshot_hash,
        report_hash=report_hash,
    )
    task = _build_task(report=report, idempotency_key=idempotency_key, context=context)
    db.add(task)
    await db.flush()

    task.lineage["orchestration_task_id"] = str(task.id)
    event = build_event(
        task=task,
        event_type=VirtualAgencyEventType.task_created.value,
        idempotency_key=f"va-event:create-next-action:{report.id}",
        actor_role=AGENT_ANALYTICS,
        actor_id=actor_id,
        payload=build_handoff_payload(task),
        approval_version=None,
    )
    db.add(event)
    await db.flush()
    return task


def _build_task(
    *,
    report: ClientReport,
    idempotency_key: str,
    context: dict[str, Any],
) -> VirtualAgencyTask:
    return VirtualAgencyTask(
        org_id=report.org_id,
        project_id=report.project_id,
        source_task_id=None,
        title="Propose next marketing action",
        description=(
            "Review the generated campaign report and propose the next "
            "governed marketing action before any follow-on writes."
        ),
        reason=(
            f"ClientReport {report.id} reached generated state with "
            "metrics evidence; create a substrate-governed next-action "
            "proposal rather than mutating campaign state directly."
        ),
        agent_role=AGENT_ANALYTICS,
        task_type="next_action_proposal",
        status=VirtualAgencyTaskStatus.todo.value,
        task_version=1,
        approval_active=False,
        creation_idempotency_key=idempotency_key,
        context=context,
        lineage=build_lineage(
            client_request=report.title,
            project_id=report.project_id,
            legacy_task_id=report.id,
            artifact_id=report.id,
        )
        | {
            "client_report_id": str(report.id),
            "source_table": "client_reports",
            "source_event": "client_report.generated",
        },
    )


def _build_context(
    *,
    report: ClientReport,
    metrics_snapshot: dict[str, Any],
    metrics_snapshot_hash: str,
    report_hash: str,
) -> dict[str, Any]:
    evidence_refs = [
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
                f"{report.period_start}:{report.period_end}"
            ),
            "label": "PluggedInSocial analytics_daily period",
        },
    ]
    return {
        "source_report": {
            "client_report_id": str(report.id),
            "org_id": str(report.org_id),
            "project_id": str(report.project_id),
            "status": report.status,
            "period_start": str(report.period_start),
            "period_end": str(report.period_end),
            "pdf_url": report.pdf_url,
            "pdf_generated_at": (
                report.pdf_generated_at.isoformat()
                if report.pdf_generated_at is not None
                else None
            ),
        },
        "metrics_snapshot": metrics_snapshot,
        "evidence_refs": evidence_refs,
        "content_hashes": {
            "client_report_hash": report_hash,
            "metrics_snapshot_hash": metrics_snapshot_hash,
        },
        "pm_substrate": {
            "adapter": PM_SUBSTRATE_AXIS_B_ADAPTER,
            "next_action_proposal": PM_SUBSTRATE_NEXT_ACTION_PROPOSAL,
            "proposal_schema": "agency-marketing-next-action-proposal.v1",
            "action_type": "marketing.next_action.propose",
        },
        "required_gates": [
            "tenant_rls",
            "client_report_generated",
            "metrics_snapshot_hash",
            "pm_substrate_next_action_adapter",
            "client_approval_before_execution",
        ],
    }


def _find_task_by_creation_idempotency_key(
    db: Session,
    key: str,
) -> VirtualAgencyTask | None:
    if hasattr(db, "find_virtual_task_by_creation_idempotency_key"):
        return db.find_virtual_task_by_creation_idempotency_key(key)
    result = db.execute(
        select(VirtualAgencyTask).where(
            VirtualAgencyTask.creation_idempotency_key == key
        )
    )
    return result.scalar_one_or_none()


async def _find_task_by_creation_idempotency_key_async(
    db: AsyncSession,
    key: str,
) -> VirtualAgencyTask | None:
    if hasattr(db, "find_virtual_task_by_creation_idempotency_key"):
        return db.find_virtual_task_by_creation_idempotency_key(key)
    result = await db.execute(
        select(VirtualAgencyTask).where(
            VirtualAgencyTask.creation_idempotency_key == key
        )
    )
    return result.scalar_one_or_none()
