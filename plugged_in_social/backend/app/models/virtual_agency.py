"""Virtual-agency orchestration ledger.

Durable, typed task/event records used to prove real inter-agent handoffs.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, OrgMixin, TimestampMixin


class VirtualAgencyTaskStatus(str, enum.Enum):
    todo = "todo"
    claimed = "claimed"
    done = "done"
    failed = "failed"
    superseded = "superseded"


class VirtualAgencyEventType(str, enum.Enum):
    task_created = "task_created"
    approved = "approved"
    revoked = "revoked"
    handoff_dispatched = "handoff_dispatched"
    execution_claimed = "execution_claimed"
    execution_completed = "execution_completed"
    execution_rejected = "execution_rejected"
    superseded = "superseded"


virtual_agency_task_dependencies = Table(
    "virtual_agency_task_dependencies",
    Base.metadata,
    Column(
        "task_id",
        UUID(as_uuid=True),
        ForeignKey("virtual_agency_tasks.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "depends_on_task_id",
        UUID(as_uuid=True),
        ForeignKey("virtual_agency_tasks.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "created_at",
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    ),
)


class VirtualAgencyTask(Base, OrgMixin, TimestampMixin):
    """Durable orchestration task that backs a single agent handoff."""

    __tablename__ = "virtual_agency_tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    source_task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="SET NULL"), index=True
    )
    parent_task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("virtual_agency_tasks.id", ondelete="SET NULL"),
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    reason: Mapped[str] = mapped_column(Text)
    agent_role: Mapped[str] = mapped_column(String(50), index=True)
    task_type: Mapped[str] = mapped_column(String(50), index=True)
    status: Mapped[str] = mapped_column(
        String(20), default=VirtualAgencyTaskStatus.todo.value, index=True
    )
    task_version: Mapped[int] = mapped_column(Integer, default=1)
    approved_version: Mapped[int | None] = mapped_column(Integer)
    approval_active: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", index=True
    )
    approval_payload_hash: Mapped[str | None] = mapped_column(String(64))
    latest_event_hash: Mapped[str | None] = mapped_column(String(64))
    creation_idempotency_key: Mapped[str] = mapped_column(
        String(120), unique=True, index=True
    )
    context: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    lineage: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    parent_task: Mapped["VirtualAgencyTask | None"] = relationship(
        remote_side=[id], backref="child_tasks"
    )
    events: Mapped[list["VirtualAgencyEvent"]] = relationship(
        back_populates="task", cascade="all, delete-orphan", lazy="selectin"
    )
    dependencies: Mapped[list["VirtualAgencyTask"]] = relationship(
        "VirtualAgencyTask",
        secondary=virtual_agency_task_dependencies,
        primaryjoin="VirtualAgencyTask.id == "
        "virtual_agency_task_dependencies.c.task_id",
        secondaryjoin="VirtualAgencyTask.id == "
        "virtual_agency_task_dependencies.c.depends_on_task_id",
        backref="blocks",
        lazy="selectin",
    )

    __table_args__ = (
        Index(
            "ix_virtual_agency_tasks_project_status",
            "org_id",
            "project_id",
            "status",
        ),
    )


class VirtualAgencyEvent(Base, OrgMixin):
    """Typed event in the orchestration ledger."""

    __tablename__ = "virtual_agency_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("virtual_agency_tasks.id", ondelete="CASCADE"),
        index=True,
    )
    event_type: Mapped[str] = mapped_column(String(50), index=True)
    actor_role: Mapped[str | None] = mapped_column(String(50))
    actor_id: Mapped[str | None] = mapped_column(String(255))
    idempotency_key: Mapped[str] = mapped_column(
        String(120), unique=True, index=True
    )
    task_version: Mapped[int | None] = mapped_column(Integer)
    approval_version: Mapped[int | None] = mapped_column(Integer)
    previous_event_hash: Mapped[str | None] = mapped_column(String(64))
    payload_hash: Mapped[str] = mapped_column(String(64))
    event_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    lineage: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )

    task: Mapped[VirtualAgencyTask] = relationship(
        back_populates="events", lazy="selectin"
    )
