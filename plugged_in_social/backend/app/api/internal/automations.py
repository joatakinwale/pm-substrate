"""Internal automation endpoints — called by the stevie-automation-runner
Cloudflare Worker.

Worker flow:
  1. Worker pulls an AutomationRunMessage off the stevie-automation-runner queue.
  2. Worker POSTs ``/internal/automations/{automation_id}/execute`` with
     ``{org_id, trigger_event, trigger_data}``. We run every step
     (send_email, add_tag, remove_tag, wait, create_task, update_field,
     send_notification, webhook), evaluate conditional branches, and
     persist progress on the AutomationRun row under RLS.
  3. We return ``{status: "completed"}`` on terminal completion (the
     execution_log captures per-step success/failure) or
     ``{status: "paused"}`` when a wait step interrupts execution. The
     Worker ack's both — the resume mechanism for paused runs is a
     follow-up (documented in the Worker README).

Why this endpoint exists at all (vs porting to TypeScript): automations
are multi-step state machines with 8 step types and conditional branching.
The Python implementation already has full DB / model / service access
(EmailTemplate render, Contact mutation, Task creation, queue-publisher
sub-dispatch for send_email/notification, …). Porting all of that to
TypeScript is a large rewrite for zero behaviour change. This endpoint
keeps the step logic Python-side so the Worker stays thin.

Security: same shared-header pattern as ``app/api/internal/billing.py`` —
``X-Webhook-Secret`` must equal ``settings.webhook_secret``. Workers are
system actors; we set RLS context manually from the org_id in the body
using ``user_id="00000000-0000-0000-0000-00000000aaaa", role="system"``,
mirroring the billing/ai/video endpoints.

Sync-vs-async note:
    The step-handler code in ``app/services/automation_runner.py`` runs
    sync (``Session(sync_engine)``) because that's how the StepExecutor
    is built — handlers like ``_step_create_task`` mutate ORM objects
    directly. This endpoint is async (FastAPI), so we delegate the sync
    work to a worker thread via ``asyncio.to_thread(...)``. This is the
    standard FastAPI pattern for invoking sync code from an async handler
    — it keeps the event loop responsive while the run executes (which
    can take many seconds across multiple step handlers).
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Response
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.internal.webhooks import verify_webhook_secret
from app.db.session import sync_engine
from app.models.email_campaign import Automation, AutomationRun
from app.services.automation_runner import (
    MAX_COUNTDOWN_SECONDS,
    StepExecutor,
    _evaluate_condition,
    _wait_seconds_for,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal/automations", tags=["internal"])


# ── Schemas ──────────────────────────────────────────────────────


class AutomationExecuteBody(BaseModel):
    """Payload from the automation-runner Worker."""

    org_id: uuid.UUID = Field(
        description=(
            "Stevie organization UUID. Worker carries this from the original "
            "queue message; we use it to scope the Automation lookup and to "
            "set RLS context on writes."
        )
    )
    trigger_event: str = Field(
        max_length=100,
        description=(
            "What triggered this run, e.g. 'form_submission', 'tag_added', "
            "'invoice_paid'. Stored on the AutomationRun for audit."
        ),
    )
    trigger_data: dict[str, Any] = Field(
        default_factory=dict,
        description=(
            "Loose context blob from the trigger. Step handlers read fields "
            "from here (e.g. webhook step pulls trigger_event + the full "
            "blob). May contain a ``contact_id`` to scope contact mutations."
        ),
    )
    # Internal resume plumbing — set by the resume mechanism (out of scope
    # for this migration; see the automation-runner README's "Follow-up"
    # section). Public callers leave these unset.
    resume_run_id: uuid.UUID | None = Field(
        default=None,
        description=(
            "Internal: existing AutomationRun.id to resume on. Only set by "
            "the (yet-to-be-built) wait-step resume mechanism."
        ),
    )
    resume_from_step: int = Field(
        default=0,
        ge=0,
        description=(
            "Internal: step index to resume at. Only meaningful when "
            "``resume_run_id`` is set."
        ),
    )


class AutomationExecuteResponse(BaseModel):
    """Terminal status the Worker keys its ack/retry decision on.

    The HTTP status code mirrors the body field:
      - 200 OK         when status == "completed"
      - 202 Accepted   when status == "paused"

    Worker reads the body's ``status``, not the HTTP code, so the
    contract stays explicit even if a future change adds more statuses.
    """

    status: str = Field(
        description="Run terminal state: 'completed' or 'paused'."
    )
    automation_id: uuid.UUID
    run_id: uuid.UUID | None = Field(
        default=None,
        description=(
            "Created/resumed AutomationRun id. Null only when the "
            "automation lookup failed before a run row existed."
        ),
    )
    steps_completed: int = Field(ge=0)
    total_steps: int = Field(ge=0)


# ── Routes ───────────────────────────────────────────────────────


@router.post("/{automation_id}/execute", response_model=AutomationExecuteResponse)
async def execute_automation(
    automation_id: Annotated[uuid.UUID, Path()],
    body: Annotated[AutomationExecuteBody, Body()],
    response: Response,
    _: None = Depends(verify_webhook_secret),
) -> AutomationExecuteResponse:
    """Run an automation workflow inline and return its terminal status.

    Returns 200 on completion (success or per-step failure logged on the
    AutomationRun), 202 if paused at a wait step, 404 if the
    automation/org pairing doesn't exist, 410 if the automation is not
    active.

    The Worker treats 200/202 as ack, 404/410 as PermanentError → ack
    (DLQ), 5xx as RetryableError. See the automation-runner README for
    the full retry taxonomy.

    We dispatch the sync execution helper via ``asyncio.to_thread`` to
    avoid blocking the event loop; the helper opens its own
    ``Session(sync_engine)`` so DB connection pooling stays consistent
    with the rest of the sync code paths.
    """
    result = await asyncio.to_thread(
        _execute_automation_sync,
        automation_id=automation_id,
        org_id=body.org_id,
        trigger_event=body.trigger_event,
        trigger_data=body.trigger_data,
        resume_run_id=body.resume_run_id,
        resume_from_step=body.resume_from_step,
    )

    error = result.get("error")
    if error == "not_found":
        raise HTTPException(
            status_code=404,
            detail=f"Automation {automation_id} not found for org {body.org_id}",
        )
    if error == "not_active":
        # 410 Gone — the automation exists but has been disabled. Worker
        # treats this as PermanentError so a stale queue message for a
        # paused automation doesn't ping-pong.
        raise HTTPException(
            status_code=410,
            detail=(
                f"Automation {automation_id} is not active "
                f"(status='{result.get('status')}')"
            ),
        )
    if error == "resume_target_missing":
        # The resume mechanism passed an AutomationRun id that no longer
        # exists. Treat as 404 — same end-result for the Worker (DLQ).
        raise HTTPException(
            status_code=404,
            detail=(
                f"Resume target AutomationRun {body.resume_run_id} not found"
            ),
        )

    status = result.get("status", "completed")
    if status == "paused":
        # 202 Accepted — the run is in flight but won't progress until the
        # wait step's countdown elapses. The Worker ack's the message
        # immediately and the resume mechanism (out of scope) will fire a
        # fresh ``automation.run`` message with resume_run_id set.
        response.status_code = 202

    return AutomationExecuteResponse(
        status=status,
        automation_id=automation_id,
        run_id=(
            uuid.UUID(result["run_id"]) if result.get("run_id") else None
        ),
        steps_completed=int(result.get("steps_completed", 0)),
        total_steps=int(result.get("total_steps", 0)),
    )


# ── RLS helper ───────────────────────────────────────────────────


# Fixed system-actor user_id — same constant the billing / ai / video
# internal endpoints use. Real users never share this UUID, so audit
# trails stay readable.
_SYSTEM_USER_ID = "00000000-0000-0000-0000-00000000aaaa"


def _set_rls_sync(db: Session, *, org_id: uuid.UUID) -> None:
    """Set Postgres session variables for RLS on a sync session.

    Mirrors ``app.db.database._set_rls_context`` but executes against a
    sync session — needed because the work below runs in a worker thread
    via ``asyncio.to_thread`` and re-uses the existing sync StepExecutor.
    """
    db.execute(
        text("SELECT set_config('app.current_org_id', :org_id, true)"),
        {"org_id": str(org_id)},
    )
    db.execute(
        text("SELECT set_config('app.current_user_id', :user_id, true)"),
        {"user_id": _SYSTEM_USER_ID},
    )
    db.execute(
        text("SELECT set_config('app.current_user_role', :role, true)"),
        {"role": "system"},
    )


# ── Sync execution helper ────────────────────────────────────────
#
# Per-run orchestration: the wait-step branch returns ``status="paused"``
# to the caller (the automation-runner Worker). The Worker (or, eventually,
# a cron-based resumer) takes responsibility for scheduling the resume;
# this endpoint stays stateless beyond the DB writes.
#
# Step primitives — ``StepExecutor``, ``_evaluate_condition``,
# ``_wait_seconds_for``, ``MAX_COUNTDOWN_SECONDS`` — live in
# ``app/services/automation_runner.py``.


def _execute_automation_sync(
    *,
    automation_id: uuid.UUID,
    org_id: uuid.UUID,
    trigger_event: str,
    trigger_data: dict[str, Any],
    resume_run_id: uuid.UUID | None,
    resume_from_step: int,
) -> dict[str, Any]:
    """Run the workflow under a sync DB session. Returns a status dict.

    Returned shape:
        {automation_id, run_id, status, steps_completed, total_steps}
    On lookup/state errors:
        {error: "not_found" | "not_active" | "resume_target_missing", ...}
    """
    trigger_data = trigger_data or {}

    with Session(sync_engine) as db:
        # Apply RLS system-actor context to the sync session — same
        # variables ``_set_rls_context`` writes for the async path. Every
        # read/write below now goes through RLS scoped to ``org_id``. The
        # ``role="system"`` setting is honoured by RLS policies that allow
        # system-actor writes (the billing / ai endpoints already rely on
        # this).
        _set_rls_sync(db, org_id=org_id)

        automation = db.get(Automation, automation_id)
        if not automation:
            logger.error("Automation %s not found", automation_id)
            return {"error": "not_found"}

        # Cross-org guard: defensive against a stale queue message
        # carrying a different org's id. The Worker validates this at
        # enqueue time but we can't trust the network.
        if automation.org_id != org_id:
            logger.error(
                "Automation %s belongs to org %s, not %s — refusing",
                automation_id, automation.org_id, org_id,
            )
            return {"error": "not_found"}

        if automation.status != "active":
            logger.warning(
                "Automation %s is not active (status=%s)",
                automation_id, automation.status,
            )
            return {"error": "not_active", "status": automation.status}

        # Resolve contact_id from trigger_data.
        contact_id = trigger_data.get("contact_id")

        # Either load the existing AutomationRun (resume) or create a new one.
        if resume_run_id:
            run = db.get(AutomationRun, resume_run_id)
            if not run:
                logger.error(
                    "Resume target AutomationRun %s missing", resume_run_id
                )
                return {"error": "resume_target_missing"}
            execution_log = list(run.execution_log or [])
            steps_completed = run.steps_completed or 0
        else:
            run = AutomationRun(
                org_id=automation.org_id,
                automation_id=automation.id,
                contact_id=uuid.UUID(contact_id) if contact_id else None,
                trigger_event=trigger_event,
                status="running",
                execution_log=[],
            )
            db.add(run)
            db.flush()
            execution_log = []
            steps_completed = 0

        executor = StepExecutor(
            db=db,
            org_id=automation.org_id,
            contact_id=uuid.UUID(contact_id) if contact_id else None,
        )

        steps = automation.steps or []
        failed = False
        deferred = False

        for i in range(resume_from_step, len(steps)):
            step = steps[i]
            logger.info(
                "Automation %s run %s — executing step %d/%d: %s",
                automation_id, str(run.id), i + 1, len(steps), step.get("type"),
            )

            # Conditional skip — same _evaluate_condition contract.
            condition = step.get("condition")
            if condition and not _evaluate_condition(
                condition, trigger_data, executor.contact
            ):
                execution_log.append({
                    "step": i + 1,
                    "type": step.get("type"),
                    "status": "skipped",
                    "reason": "condition_not_met",
                })
                continue

            # ── Wait step: persist progress and tell the caller to resume ──
            # This endpoint stays stateless: we write the high-water mark
            # and return ``status="paused"`` so the Worker can ack and the
            # resume mechanism can re-fire us (resume mechanism is OUT of
            # scope — see automation-runner README's "Follow-up" section).
            if step.get("type") == "wait":
                wait_seconds = _wait_seconds_for(step.get("config") or {})
                if wait_seconds > MAX_COUNTDOWN_SECONDS:
                    logger.warning(
                        "Automation %s run %s — wait step %d requested %ds; "
                        "capping to MAX_COUNTDOWN_SECONDS=%d. Split into "
                        "multiple wait steps for longer delays.",
                        automation_id, str(run.id), i + 1,
                        wait_seconds, MAX_COUNTDOWN_SECONDS,
                    )
                countdown = min(wait_seconds, MAX_COUNTDOWN_SECONDS)

                execution_log.append({
                    "step": i + 1,
                    "type": "wait",
                    "status": "deferred",
                    "wait_seconds_requested": wait_seconds,
                    "countdown_seconds": countdown,
                })

                # Persist log + high-water mark so the resume can pick up.
                run.execution_log = execution_log
                run.steps_completed = steps_completed
                # Run stays ``running`` so the existing UI doesn't see a
                # spurious terminal state. Once the resume mechanism lands,
                # bump this to a dedicated ``paused`` status — coordinate
                # with the frontend at that point.
                db.commit()

                deferred = True
                break

            result = executor.execute(step, trigger_data)
            result["step"] = i + 1
            execution_log.append(result)

            if result["status"] == "completed":
                steps_completed += 1
            elif result["status"] == "failed":
                failed = True
                break  # Stop on first failure

            # Commit after each step so progress is durable across
            # interruptions.
            db.commit()

        if deferred:
            logger.info(
                "Automation %s run %s — paused at step %d (wait)",
                automation_id, str(run.id), len(execution_log),
            )
            return {
                "automation_id": str(automation_id),
                "run_id": str(run.id),
                "status": "paused",
                "steps_completed": steps_completed,
                "total_steps": len(steps),
            }

        # Terminal state.
        run.status = "failed" if failed else "completed"
        run.steps_completed = steps_completed
        run.execution_log = execution_log
        run.completed_at = datetime.now(timezone.utc)
        if failed:
            run.error_message = execution_log[-1].get(
                "error", "Step execution failed"
            )

        # Update automation stats. ``total_runs`` counts terminal runs.
        # We only reach this block once per run (initial path → terminal
        # OR initial → paused, then resume → terminal), so a single
        # unconditional increment gives us one count per end-to-end run.
        automation.total_runs = (automation.total_runs or 0) + 1
        automation.last_run_at = datetime.now(timezone.utc)

        db.commit()

        logger.info(
            "Automation %s run %s — %s (%d/%d steps)",
            automation_id, str(run.id), run.status,
            steps_completed, len(steps),
        )

        return {
            "automation_id": str(automation_id),
            "run_id": str(run.id),
            "status": run.status,
            "steps_completed": steps_completed,
            "total_steps": len(steps),
        }
