"""Automation engine — executes workflow steps triggered by events.

Invoked in-process by ``app/api/internal/automations.py`` after the
automation-runner Worker calls ``/internal/automations/{id}/execute``.
The Worker handles dispatch + retries; this module owns the per-step
business logic.

Supported step types:
  - send_email:     Send a template email to the contact
  - add_tag:        Add a tag to the contact
  - remove_tag:     Remove a tag from the contact
  - wait:           Wait N seconds/minutes/hours before next step
  - create_task:    Create a task in a project
  - update_field:   Update a contact or lead field
  - send_notification: Send a notification email to team members
  - webhook:        POST data to an external URL

Wait-step behavior:
    Reaching a ``wait`` step is handled by the dispatcher in
    ``app/api/internal/automations.py``: progress is persisted on the
    AutomationRun and the endpoint returns ``status="paused"``. The Worker
    ack's the message and the resume mechanism (out of scope for the
    initial migration) re-fires the run with ``resume_run_id`` set.
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy.orm import Session

from app.models.contact import Contact

logger = logging.getLogger(__name__)

# Upper bound on a single wait-step resume countdown. Waits longer than
# this should be split into multiple wait steps so any one resume
# doesn't sit pending in the queue for excessively long.
MAX_COUNTDOWN_SECONDS = 24 * 3600  # 24h


def _wait_seconds_for(config: dict) -> int:
    """Compute how long a wait step should defer for, in whole seconds."""
    unit = config.get("unit", "seconds")
    amount = config.get("amount", 0)
    multiplier = {"seconds": 1, "minutes": 60, "hours": 3600, "days": 86400}
    return max(0, int(amount * multiplier.get(unit, 1)))


class StepExecutor:
    """Executes individual automation steps within a sync DB session."""

    def __init__(self, db: Session, org_id: uuid.UUID, contact_id: uuid.UUID | None):
        self.db = db
        self.org_id = org_id
        self.contact_id = contact_id
        self._contact: Contact | None = None

    @property
    def contact(self) -> Contact | None:
        if self._contact is None and self.contact_id:
            self._contact = self.db.get(Contact, str(self.contact_id))
        return self._contact

    def execute(self, step: dict, trigger_data: dict) -> dict:
        """Execute a single automation step. Returns execution log entry."""
        step_type = step.get("type", "unknown")
        config = step.get("config", {})
        started_at = time.time()

        try:
            handler = getattr(self, f"_step_{step_type}", None)
            if not handler:
                return {
                    "type": step_type,
                    "status": "skipped",
                    "reason": f"Unknown step type: {step_type}",
                    "duration_ms": 0,
                }

            result = handler(config, trigger_data)
            duration = int((time.time() - started_at) * 1000)
            return {
                "type": step_type,
                "status": "completed",
                "result": result,
                "duration_ms": duration,
            }
        except Exception as e:
            duration = int((time.time() - started_at) * 1000)
            logger.exception("Step %s failed: %s", step_type, str(e))
            return {
                "type": step_type,
                "status": "failed",
                "error": str(e)[:500],
                "duration_ms": duration,
            }

    # ── Step Handlers ──────────────────────────────────────

    def _step_send_email(self, config: dict, trigger_data: dict) -> dict:
        """Send an email to the contact using a template or inline content."""
        contact = self.contact
        if not contact:
            return {"skipped": True, "reason": "no_contact"}

        subject = config.get("subject", "Update from Stevie Social")
        html_body = config.get("html_body", "")
        template_id = config.get("template_id")

        # If template_id provided, load template
        if template_id:
            from app.models.email_campaign import EmailTemplate
            template = self.db.get(EmailTemplate, template_id)
            if template:
                subject = template.subject or subject
                html_body = template.compiled_html or template.html_body or html_body

        # Variable substitution
        from app.services.email_sender import render_template
        variables = {
            "email": contact.email,
            "first_name": (contact.full_name or "").split()[0] if contact.full_name else "",
            "full_name": contact.full_name or "",
        }
        html_body = render_template(html_body, variables)
        subject = render_template(subject, variables)

        # Dispatch via the Cloudflare Queues email-sender Worker. This is a
        # sync executor (called from inside ``asyncio.to_thread``), and the
        # publisher helper is async, so we use ``asyncio.run`` for a one-shot
        # event loop. Cheap because we're already on a worker thread with no
        # loop running. Failures are swallowed at the executor level via the
        # surrounding try/except in ``execute()``.
        from app.services.queue_publisher import publish_email_notification
        asyncio.run(
            publish_email_notification(
                org_id=self.org_id,
                to=contact.email,
                subject=subject,
                html_body=html_body,
            )
        )
        return {"to": contact.email, "subject": subject}

    def _step_add_tag(self, config: dict, trigger_data: dict) -> dict:
        """Add a tag to the contact."""
        contact = self.contact
        if not contact:
            return {"skipped": True, "reason": "no_contact"}

        tag = config.get("tag", "")
        if not tag:
            return {"skipped": True, "reason": "no_tag_specified"}

        current_tags = list(contact.tags or [])
        if tag not in current_tags:
            current_tags.append(tag)
            contact.tags = current_tags
        return {"tag": tag, "added": tag not in (contact.tags or [])}

    def _step_remove_tag(self, config: dict, trigger_data: dict) -> dict:
        """Remove a tag from the contact."""
        contact = self.contact
        if not contact:
            return {"skipped": True, "reason": "no_contact"}

        tag = config.get("tag", "")
        current_tags = list(contact.tags or [])
        if tag in current_tags:
            current_tags.remove(tag)
            contact.tags = current_tags
            return {"tag": tag, "removed": True}
        return {"tag": tag, "removed": False}

    def _step_wait(self, config: dict, trigger_data: dict) -> dict:
        """Wait steps are handled by the dispatcher, not the executor.

        Reaching this method means the dispatcher in
        ``app/api/internal/automations.py`` failed to intercept the wait
        step and return ``status="paused"`` to the caller. We intentionally
        never block the worker with ``time.sleep`` here — raise so the
        bug is visible in logs.
        """
        raise RuntimeError(
            "wait step must be handled by the automations dispatcher, "
            "not executed in-worker"
        )

    def _step_create_task(self, config: dict, trigger_data: dict) -> dict:
        """Create a task in a specified project."""
        from app.models.project import Task

        project_id = config.get("project_id")
        if not project_id:
            return {"skipped": True, "reason": "no_project_id"}

        task = Task(
            org_id=self.org_id,
            project_id=uuid.UUID(project_id),
            title=config.get("title", "Auto-created task"),
            description=config.get("description", ""),
            workflow_step=config.get("workflow_step", 1),
            priority=config.get("priority", "medium"),
        )
        self.db.add(task)
        self.db.flush()
        return {"task_id": str(task.id), "title": task.title}

    def _step_update_field(self, config: dict, trigger_data: dict) -> dict:
        """Update a field on the contact."""
        contact = self.contact
        if not contact:
            return {"skipped": True, "reason": "no_contact"}

        field = config.get("field", "")
        value = config.get("value")

        # Only allow safe fields
        safe_fields = {"full_name", "source", "engagement_score"}
        if field in safe_fields:
            setattr(contact, field, value)
            return {"field": field, "value": value}
        elif field.startswith("metadata."):
            key = field.replace("metadata.", "")
            meta = dict(contact.metadata_ or {})
            meta[key] = value
            contact.metadata_ = meta
            return {"field": field, "value": value}
        return {"skipped": True, "reason": f"field '{field}' not allowed"}

    def _step_send_notification(self, config: dict, trigger_data: dict) -> dict:
        """Send a notification email to team members."""
        recipients = config.get("emails", [])
        subject = config.get("subject", "Automation Notification")
        message = config.get("message", "An automation event occurred.")

        html_body = f"""
        <h3>{subject}</h3>
        <p>{message}</p>
        <hr>
        <p style="color:#666;font-size:12px;">
            Trigger: {trigger_data.get('trigger_event', 'unknown')}<br>
            Contact: {self.contact.email if self.contact else 'N/A'}<br>
            Time: {datetime.now(timezone.utc).isoformat()}
        </p>
        """

        from app.services.queue_publisher import publish_email_notification
        for email in recipients:
            asyncio.run(
                publish_email_notification(
                    org_id=self.org_id,
                    to=email,
                    subject=subject,
                    html_body=html_body,
                )
            )
        return {"notified": recipients}

    def _step_webhook(self, config: dict, trigger_data: dict) -> dict:
        """POST data to an external webhook URL."""
        url = config.get("url", "")
        if not url:
            return {"skipped": True, "reason": "no_url"}

        payload = {
            "event": trigger_data.get("trigger_event"),
            "contact_email": self.contact.email if self.contact else None,
            "data": trigger_data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        # Merge any custom payload fields
        if config.get("payload"):
            payload.update(config["payload"])

        try:
            with httpx.Client(timeout=10) as client:
                resp = client.post(
                    url,
                    json=payload,
                    headers=config.get("headers", {}),
                )
            return {"url": url, "status_code": resp.status_code}
        except Exception as e:
            return {"url": url, "error": str(e)[:200]}


def _evaluate_condition(
    condition: dict, trigger_data: dict, contact: Contact | None
) -> bool:
    """Evaluate a simple condition for conditional step execution.

    Condition format:
      {"field": "data.email", "operator": "exists"}
      {"field": "contact.engagement_score", "operator": "gte", "value": 50}
      {"field": "data.subscribe", "operator": "eq", "value": true}
    """
    field_path = condition.get("field", "")
    operator = condition.get("operator", "exists")
    expected = condition.get("value")

    # Resolve field value
    value = None
    if field_path.startswith("data."):
        key = field_path.replace("data.", "")
        value = trigger_data.get("data", {}).get(key)
    elif field_path.startswith("contact.") and contact:
        key = field_path.replace("contact.", "")
        value = getattr(contact, key, None)
    elif field_path.startswith("trigger."):
        key = field_path.replace("trigger.", "")
        value = trigger_data.get(key)

    if operator == "exists":
        return value is not None
    elif operator == "eq":
        return value == expected
    elif operator == "neq":
        return value != expected
    elif operator == "gte":
        return (value or 0) >= (expected or 0)
    elif operator == "lte":
        return (value or 0) <= (expected or 0)
    elif operator == "contains" and isinstance(value, (list, str)):
        return expected in value

    return True  # Default: pass


__all__ = [
    "MAX_COUNTDOWN_SECONDS",
    "StepExecutor",
    "_evaluate_condition",
    "_wait_seconds_for",
]
