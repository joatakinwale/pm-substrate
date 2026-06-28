from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest

from app.models import Activity, ClientOnboarding, Invoice, Project, Proposal
from app.services.proposal_cascade import run_sign_cascade


class _ScalarResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _FakeSession:
    def __init__(self):
        self.added: list[object] = []

    def add(self, obj):
        if getattr(obj, "id", None) is None:
            obj.id = uuid.uuid4()
        self.added.append(obj)

    async def flush(self):
        return None

    async def execute(self, _query):
        return _ScalarResult(None)


@pytest.mark.asyncio
async def test_run_sign_cascade_propagates_agent_role():
    proposal = Proposal(
        id=uuid.uuid4(),
        org_id=uuid.uuid4(),
        client_name="Test Client",
        client_email="client@example.com",
        title="Test Proposal",
        status="sent",
        total_cents=250000,
        currency="usd",
        billing_interval="month",
        blocks=[],
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        agent_role="chief_of_staff",
    )
    db = _FakeSession()

    artifacts = await run_sign_cascade(db, proposal, org_id=proposal.org_id)

    invoice = next(obj for obj in db.added if isinstance(obj, Invoice))
    onboarding = next(obj for obj in db.added if isinstance(obj, ClientOnboarding))
    project = next(obj for obj in db.added if isinstance(obj, Project))
    activity = next(obj for obj in db.added if isinstance(obj, Activity))

    assert proposal.generated_invoice_id == invoice.id == artifacts["invoice_id"]
    assert proposal.generated_project_id == project.id == artifacts["project_id"]
    assert onboarding.id == artifacts["onboarding_id"]

    assert invoice.agent_role == "chief_of_staff"
    assert onboarding.agent_role == "chief_of_staff"
    assert project.created_by_agent == "chief_of_staff"
    assert project.metadata_["agent_role"] == "chief_of_staff"
    assert activity.agent_role == "chief_of_staff"
    assert activity.metadata_["agent_role"] == "chief_of_staff"
