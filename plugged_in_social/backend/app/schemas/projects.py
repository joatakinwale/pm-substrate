"""Project and task schemas."""
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


# PM-1: a single WorkflowStep entry that internal projects can override.
# Matches the shape of WORKFLOW_STEPS in models.project. ``step`` must be
# unique within a project's steps array; the admin UI enforces this but we
# also validate on write.
class WorkflowStepDef(BaseModel):
    step: int = Field(ge=1, le=50)
    key: str = Field(min_length=1, max_length=50)
    title: str = Field(min_length=1, max_length=100)


# ── Project ──────────────────────────────────────────────────
class ProjectCreate(BaseModel):
    name: str = Field(max_length=500)
    description: str | None = None
    client_name: str | None = None
    client_email: str | None = None
    compound_phase: str | None = None
    lead_id: uuid.UUID | None = None
    proposal_id: uuid.UUID | None = None
    start_date: datetime | None = None
    target_date: datetime | None = None
    color: str | None = Field(default=None, max_length=7)
    # PM-1: internal vs client distinction. Defaults to 'client' so the
    # existing proposal-to-project cascade and portal invite flow keep
    # working without schema-level changes at every call site.
    project_type: Literal["client", "internal"] = "client"
    visibility: Literal["team", "admins_only"] = "team"
    workflow_steps: list[WorkflowStepDef] | None = None

    @field_validator("workflow_steps")
    @classmethod
    def _unique_step_numbers(cls, v: list[WorkflowStepDef] | None) -> list[WorkflowStepDef] | None:
        if v is None:
            return None
        step_nums = [s.step for s in v]
        if len(step_nums) != len(set(step_nums)):
            raise ValueError("workflow_steps: step numbers must be unique")
        keys = [s.key for s in v]
        if len(keys) != len(set(keys)):
            raise ValueError("workflow_steps: keys must be unique")
        return v


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None
    compound_phase: str | None = None
    target_date: datetime | None = None
    color: str | None = None
    # PM-1: visibility is editable in-place; project_type is NOT — flipping
    # a project from client to internal (or vice versa) would break portal
    # sessions mid-engagement. Callers who really need to switch should
    # archive and re-create.
    visibility: Literal["team", "admins_only"] | None = None
    workflow_steps: list[WorkflowStepDef] | None = None

    @field_validator("workflow_steps")
    @classmethod
    def _unique_step_numbers(cls, v: list[WorkflowStepDef] | None) -> list[WorkflowStepDef] | None:
        if v is None:
            return None
        step_nums = [s.step for s in v]
        if len(step_nums) != len(set(step_nums)):
            raise ValueError("workflow_steps: step numbers must be unique")
        keys = [s.key for s in v]
        if len(keys) != len(set(keys)):
            raise ValueError("workflow_steps: keys must be unique")
        return v


class ProjectResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    proposal_id: uuid.UUID | None
    lead_id: uuid.UUID | None
    name: str
    description: str | None
    status: str
    project_type: str
    visibility: str
    workflow_steps: list[WorkflowStepDef] | None = None
    client_name: str | None
    client_email: str | None
    compound_phase: str | None
    start_date: datetime | None
    target_date: datetime | None
    completed_at: datetime | None
    color: str | None
    task_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Task ─────────────────────────────────────────────────────
class TaskCreate(BaseModel):
    title: str = Field(max_length=500)
    description: str | None = None
    # PM-1: widened from 1–13 to 1–50 to accommodate internal projects
    # that define a custom workflow step list via Project.workflow_steps.
    # Client projects still map step 9 to the portal-approval contract —
    # the API endpoint enforces that convention independently of this
    # upper bound.
    workflow_step: int = Field(default=1, ge=1, le=50)
    priority: str = Field(default="medium")
    assignee_id: uuid.UUID | None = None
    assignee_name: str | None = None
    due_date: datetime | None = None
    tags: list[str] = []
    client_visible: bool = False
    # PM-2: estimation + sprint assignment. All optional — a task created
    # quickly from the board has no reason to require them. Callers who
    # want to create a task directly into a sprint set sprint_id here;
    # otherwise the task lands in the backlog.
    story_points: int | None = Field(default=None, ge=0, le=1000)
    estimate_hours: float | None = Field(default=None, ge=0)
    sprint_id: uuid.UUID | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    priority: str | None = None
    assignee_id: uuid.UUID | None = None
    assignee_name: str | None = None
    due_date: datetime | None = None
    tags: list[str] | None = None
    client_visible: bool | None = None
    client_approved: bool | None = None
    client_feedback: str | None = None
    # PM-2: partial-update fields. These share the None/unset semantic with
    # the other columns — callers should rely on exclude_unset to tell the
    # difference between "don't change" and "clear to null". When a value
    # is explicitly ``None`` in the payload, it clears the field.
    story_points: int | None = Field(default=None, ge=0, le=1000)
    estimate_hours: float | None = Field(default=None, ge=0)
    sprint_id: uuid.UUID | None = None


class TaskMoveRequest(BaseModel):
    """Move a task to a new workflow step and/or position."""
    # PM-1: widened from 1–13 to 1–50 (same rationale as TaskCreate).
    workflow_step: int = Field(ge=1, le=50)
    position: float
    version: int = Field(description="Current version for optimistic concurrency")


class TaskResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    project_id: uuid.UUID
    workflow_step: int
    position: float
    title: str
    description: str | None
    priority: str
    assignee_id: uuid.UUID | None
    assignee_name: str | None
    due_date: datetime | None
    completed_at: datetime | None
    tags: list
    attachments: list
    client_visible: bool
    client_approved: bool
    client_feedback: str | None
    version: int
    # PM-2: surfaced on the response so the board/detail UIs can render
    # estimates and sprint badges without a second round-trip.
    story_points: int | None = None
    estimate_hours: float | None = None
    sprint_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Sprint (PM-2) ────────────────────────────────────────────
# Sprints are time-boxed planning windows scoped to a single project.
# The ``active`` status is enforced at the DB layer: a partial unique
# index ensures only one sprint per project can be active at a time.
# The API catches the resulting IntegrityError and returns 409.
class SprintCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    goal: str | None = None
    # ``draft`` is the sensible default — a new sprint is just a container
    # until the planner explicitly starts it. Callers who want to create-
    # and-start in one call can pass status="active" and accept the 409
    # if another sprint is already active.
    status: Literal["draft", "active", "completed"] = "draft"
    start_date: datetime | None = None
    end_date: datetime | None = None


class SprintUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    goal: str | None = None
    status: Literal["draft", "active", "completed"] | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None


class SprintResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    project_id: uuid.UUID
    name: str
    goal: str | None
    status: str
    start_date: datetime | None
    end_date: datetime | None
    completed_at: datetime | None
    # Rollups — computed server-side so the UI doesn't have to aggregate
    # per-sprint task lists. Missing estimates simply count as zero.
    task_count: int = 0
    completed_count: int = 0
    total_story_points: int = 0
    completed_story_points: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Dependency (PM-2) ────────────────────────────────────────
# A task_dependencies row models "task_id is blocked by depends_on_task_id".
# Cycle prevention is application-layer: when creating A→B, we walk B's
# transitive dependencies and refuse if A appears in the closure. A DB-
# level CHECK prevents self-loops; longer cycles rely on the app check.
class DependencyAdd(BaseModel):
    depends_on_task_id: uuid.UUID


class DependencyResponse(BaseModel):
    task_id: uuid.UUID
    depends_on_task_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Workload (PM-2) ──────────────────────────────────────────
# Per-assignee rollup for project- or sprint-scoped capacity views.
# Unassigned tasks are bucketed under a synthetic row with assignee_id
# set to ``None`` so the UI can render "Unassigned" without a null-guard
# at every list site.
class WorkloadEntry(BaseModel):
    assignee_id: uuid.UUID | None
    assignee_name: str | None
    open_tasks: int = 0
    total_story_points: int = 0
    total_estimate_hours: float = 0.0
    overdue_count: int = 0


# ── Comment ──────────────────────────────────────────────────
class CommentCreate(BaseModel):
    content: str


class CommentResponse(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    author_id: uuid.UUID | None
    author_name: str | None
    content: str
    is_client_comment: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Workflow step info ───────────────────────────────────────
class WorkflowStepInfo(BaseModel):
    step: int
    key: str
    title: str
    task_count: int = 0
