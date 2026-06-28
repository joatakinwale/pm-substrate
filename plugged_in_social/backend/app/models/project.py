"""Project and Task models — 13-step Kanban production workflow.

Stevie Social's 13-step content production workflow:
1.  Strategy & Planning
2.  Content Ideation
3.  Content Briefs
4.  Creative Direction
5.  Content Production
6.  Editing & Post-Production
7.  Copywriting & Captions
8.  Internal Review
9.  Client Approval & Revisions   ← visible in client portal
10. Scheduling & Publishing
11. Community Management
12. Performance Monitoring
13. Reporting & Optimization

Tasks use float-based positioning for drag-and-drop reorder without
sibling locks. Optimistic concurrency is handled via a `version` column.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, OrgMixin, TimestampMixin


# ── 13-step workflow ─────────────────────────────────────────
WORKFLOW_STEPS = [
    {"step": 1, "key": "strategy_planning", "title": "Strategy & Planning"},
    {"step": 2, "key": "content_ideation", "title": "Content Ideation"},
    {"step": 3, "key": "content_briefs", "title": "Content Briefs"},
    {"step": 4, "key": "creative_direction", "title": "Creative Direction"},
    {"step": 5, "key": "content_production", "title": "Content Production"},
    {"step": 6, "key": "editing_post_production", "title": "Editing & Post-Production"},
    {"step": 7, "key": "copywriting_captions", "title": "Copywriting & Captions"},
    {"step": 8, "key": "internal_review", "title": "Internal Review"},
    {"step": 9, "key": "client_approval", "title": "Client Approval & Revisions"},
    {"step": 10, "key": "scheduling_publishing", "title": "Scheduling & Publishing"},
    {"step": 11, "key": "community_management", "title": "Community Management"},
    {"step": 12, "key": "performance_monitoring", "title": "Performance Monitoring"},
    {"step": 13, "key": "reporting_optimization", "title": "Reporting & Optimization"},
]

CLIENT_VISIBLE_STEP = 9  # Only step 9 is visible in client portal


class ProjectStatus(str, enum.Enum):
    active = "active"
    paused = "paused"
    completed = "completed"
    archived = "archived"


class ProjectType(str, enum.Enum):
    """PM-1: distinguishes client-facing engagements from internal-team work.

    ``client`` projects flow through the portal + 13-step Stevie workflow
    and are visible to the external client via magic-link. ``internal``
    projects never surface through the portal API — migration 014 added
    the column; portal queries filter on it defensively.
    """

    client = "client"
    internal = "internal"


class ProjectVisibility(str, enum.Enum):
    """PM-1: visibility gate for internal projects.

    ``team``         — any authenticated team member (role != client)
    ``admins_only``  — only admin or owner roles

    Ignored for client projects (which derive access from client_email).
    """

    team = "team"
    admins_only = "admins_only"


class Project(Base, OrgMixin, TimestampMixin):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )

    # References
    proposal_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("proposals.id", ondelete="SET NULL")
    )
    lead_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leads.id", ondelete="SET NULL")
    )

    # Project metadata
    name: Mapped[str] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(30), default=ProjectStatus.active.value, index=True
    )

    # PM-1: client vs internal split. ``project_type`` partitions the
    # Project table into two distinct surfaces: client projects flow
    # through the portal; internal projects never do. A sidecar table was
    # considered but rejected — the existing Task, Comment, activity, and
    # presence stacks already key off Project.id, so duplicating that
    # graph for internals would mean duplicating every dependent query.
    project_type: Mapped[str] = mapped_column(
        String(20), default=ProjectType.client.value, index=True
    )
    # PM-1: visibility applies to INTERNAL projects only. Client projects
    # always route through the client-email + portal-session gate and
    # ignore this field. Defaults to "team" so a newly-created internal
    # project is visible to all team members unless explicitly narrowed.
    visibility: Mapped[str] = mapped_column(
        String(20), default=ProjectVisibility.team.value
    )
    # PM-1: optional custom workflow step list for internal projects.
    # ``None`` means "use the canonical 13-step Stevie workflow".
    # Internal projects can substitute a smaller list (e.g. Backlog,
    # In Progress, Review, Done) which /board returns instead. Client
    # projects ignore this — their client-approval contract is pinned
    # to step 9 of the canonical flow.
    workflow_steps: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    # Client info
    client_name: Mapped[str | None] = mapped_column(String(255))
    client_email: Mapped[str | None] = mapped_column(String(255))

    # Compound Method
    compound_phase: Mapped[str | None] = mapped_column(String(30))

    # Dates
    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    target_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Metadata
    color: Mapped[str | None] = mapped_column(String(7))  # hex color
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    # Virtual Agency
    created_by_agent: Mapped[str | None] = mapped_column(String(50))

    # Relationships
    tasks: Mapped[list["Task"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", lazy="selectin"
    )


class TaskPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"


class SprintStatus(str, enum.Enum):
    """PM-2: sprint lifecycle.

    - ``draft``     — planning phase; tasks can be added/removed freely.
    - ``active``    — the sprint is live. DB enforces only one active
                      sprint per project (partial unique index, see
                      migration 015).
    - ``completed`` — sprint is done; read-only for burndown history.
    """

    draft = "draft"
    active = "active"
    completed = "completed"


class Sprint(Base, OrgMixin, TimestampMixin):
    """PM-2: time-boxed planning window over a project's task list.

    A project can have zero or many sprints; tasks associate via
    ``Task.sprint_id`` (nullable). Tasks without a sprint are the
    backlog.

    Only one sprint per project may be ``active`` at a time. Enforced by
    a partial unique index on the ``sprints`` table — not a Python-side
    check — so concurrent requests can't race past the constraint.
    """

    __tablename__ = "sprints"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )

    name: Mapped[str] = mapped_column(String(255))
    goal: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(20), default=SprintStatus.draft.value
    )

    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Relationships
    tasks: Mapped[list["Task"]] = relationship(
        back_populates="sprint", lazy="selectin"
    )


# ── Task dependencies join table ─────────────────────────────
# PM-2: "task A is blocked by task B" is a many-to-many relation over
# ``tasks`` itself. Modeled as a plain Table (not a mapped class)
# because the row has no independent identity — the PK is the pair.
# A DB CheckConstraint prevents self-dependencies; deeper cycle
# detection is done application-side before insert.
task_dependencies = Table(
    "task_dependencies",
    Base.metadata,
    Column(
        "task_id",
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "depends_on_task_id",
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "created_at",
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    ),
    CheckConstraint(
        "task_id != depends_on_task_id",
        name="ck_task_dependencies_no_self_ref",
    ),
)


class Task(Base, OrgMixin, TimestampMixin):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )

    # Workflow position
    workflow_step: Mapped[int] = mapped_column(Integer, default=1, index=True)
    position: Mapped[float] = mapped_column(Float, default=0.0)

    # Task details
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text)
    priority: Mapped[str] = mapped_column(
        String(20), default=TaskPriority.medium.value
    )

    # Assignment
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    assignee_name: Mapped[str | None] = mapped_column(String(255))
    
    # Virtual Agency
    assigned_agent: Mapped[str | None] = mapped_column(String(50))
    created_by_agent: Mapped[str | None] = mapped_column(String(50))

    # Dates
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Tags and labels
    tags: Mapped[list] = mapped_column(JSONB, default=list)

    # File attachments (R2 keys stored as JSONB array)
    attachments: Mapped[list] = mapped_column(JSONB, default=list)

    # Client-facing flag (for Step 9 portal visibility)
    client_visible: Mapped[bool] = mapped_column(default=False)
    client_approved: Mapped[bool] = mapped_column(default=False)
    client_feedback: Mapped[str | None] = mapped_column(Text)

    # PM-2: estimation fields. ``story_points`` follows the agile
    # convention; ``estimate_hours`` is for teams that prefer time over
    # points. Either/both/neither may be set — no mutual-exclusion
    # constraint because small/backlog tasks are often un-estimated.
    story_points: Mapped[int | None] = mapped_column(Integer, nullable=True)
    estimate_hours: Mapped[float | None] = mapped_column(Float, nullable=True)

    # PM-2: sprint assignment. ``None`` == backlog. ON DELETE SET NULL so
    # archiving/deleting a sprint doesn't cascade-kill the work.
    sprint_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sprints.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Optimistic concurrency
    version: Mapped[int] = mapped_column(Integer, default=1)

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="tasks")
    sprint: Mapped["Sprint | None"] = relationship(back_populates="tasks")
    comments: Mapped[list["TaskComment"]] = relationship(
        back_populates="task", cascade="all, delete-orphan", lazy="selectin"
    )
    # PM-2: self-referential M2M. ``dependencies`` are tasks that block
    # this one; ``blocks`` is the reverse (tasks this one is blocking).
    dependencies: Mapped[list["Task"]] = relationship(
        "Task",
        secondary=task_dependencies,
        primaryjoin="Task.id == task_dependencies.c.task_id",
        secondaryjoin="Task.id == task_dependencies.c.depends_on_task_id",
        backref="blocks",
        lazy="selectin",
    )


class TaskComment(Base, TimestampMixin):
    __tablename__ = "task_comments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), index=True
    )
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    author_name: Mapped[str | None] = mapped_column(String(255))

    content: Mapped[str] = mapped_column(Text)
    is_client_comment: Mapped[bool] = mapped_column(default=False)

    # Relationship
    task: Mapped["Task"] = relationship(back_populates="comments")
