"use client";

// Required for next-on-pages: dynamic [id] routes can't be statically
// prerendered (the ID isn't known at build time), so they must run as
// edge functions. The other 22 admin pages are static, so this is one
// of only ~4 edge functions in the whole bundle — well under Pages' 25 MiB.
export const runtime = 'edge';

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  GripVertical,
  Clock,
  User,
  Flag,
  X,
  Loader2,
  CheckCircle2,
  Eye,
  Trash2,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { apiFetch, ConflictError, type Project, type TaskItem, type WorkflowStep } from "@/lib/api";
import { useAdminPresence } from "@/lib/use-admin-presence";
import PresenceAvatarStack from "@/components/presence/PresenceAvatarStack";

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-gray-400",
  medium: "text-stevie-sky",
  high: "text-stevie-orange",
  urgent: "text-red-500",
};

const STEP_COLORS: Record<number, string> = {
  1: "border-t-stevie-sky",
  2: "border-t-stevie-lavender",
  3: "border-t-stevie-chartreuse",
  4: "border-t-purple-400",
  5: "border-t-stevie-green",
  6: "border-t-amber-400",
  7: "border-t-pink-400",
  8: "border-t-indigo-400",
  9: "border-t-stevie-orange",
  10: "border-t-teal-400",
  11: "border-t-emerald-400",
  12: "border-t-cyan-400",
  13: "border-t-stevie-green",
};

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ── Sortable Task Card ── */
function SortableTaskCard({
  task,
  onClick,
}: {
  task: TaskItem;
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { task, step: task.workflow_step } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white rounded-lg border border-border p-3 cursor-pointer hover:border-foreground/20 transition shadow-sm"
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab active:cursor-grabbing touch-none"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-3.5 h-3.5 text-gray-300" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight">{task.title}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Flag className={`w-3 h-3 ${PRIORITY_COLORS[task.priority] || "text-gray-400"}`} />
            {task.assignee_name && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <User className="w-2.5 h-2.5" /> {task.assignee_name.split("@")[0]}
              </span>
            )}
            {task.due_date && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Clock className="w-2.5 h-2.5" /> {formatDate(task.due_date)}
              </span>
            )}
            {task.client_approved && (
              <CheckCircle2 className="w-3 h-3 text-stevie-green" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Static overlay card (shown while dragging) ── */
function TaskCardOverlay({ task }: { task: TaskItem }) {
  return (
    <div className="bg-white rounded-lg border-2 border-foreground/20 p-3 shadow-lg w-[236px] rotate-2">
      <div className="flex items-start gap-2">
        <GripVertical className="w-3.5 h-3.5 text-gray-300 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight">{task.title}</p>
          <div className="flex items-center gap-2 mt-2">
            <Flag className={`w-3 h-3 ${PRIORITY_COLORS[task.priority] || "text-gray-400"}`} />
            {task.assignee_name && (
              <span className="text-[10px] text-muted-foreground">{task.assignee_name.split("@")[0]}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectBoardPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [tasksByStep, setTasksByStep] = useState<Record<number, TaskItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [addingTo, setAddingTo] = useState<number | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Presence: project board + currently-open task detail
  const boardPresence = useAdminPresence({ channel: `project:${projectId}` });
  const taskPresence = useAdminPresence({
    channel: selectedTask ? `task:${selectedTask.id}` : null,
  });

  const fetchBoard = useCallback(async () => {
    try {
      const [proj, boardSteps, tasks] = await Promise.all([
        apiFetch<Project>(`/api/projects/${projectId}`),
        apiFetch<WorkflowStep[]>(`/api/projects/${projectId}/board`),
        apiFetch<TaskItem[]>(`/api/projects/${projectId}/tasks`),
      ]);
      setProject(proj);
      setSteps(boardSteps);

      const grouped: Record<number, TaskItem[]> = {};
      for (const step of boardSteps) {
        grouped[step.step] = [];
      }
      for (const task of tasks) {
        if (!grouped[task.workflow_step]) grouped[task.workflow_step] = [];
        grouped[task.workflow_step].push(task);
      }
      for (const key of Object.keys(grouped)) {
        grouped[Number(key)].sort((a, b) => a.position - b.position);
      }
      setTasksByStep(grouped);
    } catch {
      router.push("/admin/projects");
    } finally {
      setLoading(false);
    }
  }, [projectId, router]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  async function handleAddTask(step: number) {
    if (!newTaskTitle.trim()) return;
    try {
      await apiFetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        body: JSON.stringify({ title: newTaskTitle, workflow_step: step }),
      });
      setNewTaskTitle("");
      setAddingTo(null);
      fetchBoard();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to add task");
    }
  }

  async function handleMoveTask(task: TaskItem, newStep: number, newPosition: number) {
    try {
      await apiFetch(`/api/projects/${projectId}/tasks/${task.id}/move`, {
        method: "POST",
        body: JSON.stringify({
          workflow_step: newStep,
          position: newPosition,
          version: task.version,
        }),
      });
      fetchBoard();
    } catch (err: unknown) {
      // A full merge dialog for a drag-and-drop move would be more
      // disruptive than the collision itself — the user's intent is
      // obvious (they dropped the card in column X). We just surface
      // the server's message and reload the board so they see who
      // moved what.
      if (err instanceof ConflictError) {
        alert(err.message);
      } else {
        alert(err instanceof Error ? err.message : "Conflict — please refresh");
      }
      fetchBoard();
    }
  }

  /* ── Drag handlers ── */
  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const task = active.data.current?.task as TaskItem | undefined;
    if (task) setActiveTask(task);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    const activeStep = activeData?.task?.workflow_step ?? activeData?.step;
    // over can be a task or a droppable column
    const overStep = overData?.task?.workflow_step ?? overData?.step;

    if (activeStep === undefined || overStep === undefined || activeStep === overStep) return;

    // Optimistic local move between columns
    setTasksByStep((prev) => {
      const next = { ...prev };
      const sourceList = [...(next[activeStep] || [])];
      const destList = [...(next[overStep] || [])];

      const taskIndex = sourceList.findIndex((t) => t.id === active.id);
      if (taskIndex === -1) return prev;

      const [movedTask] = sourceList.splice(taskIndex, 1);
      movedTask.workflow_step = overStep;
      destList.push(movedTask);

      next[activeStep] = sourceList;
      next[overStep] = destList;
      return next;
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const task = active.data.current?.task as TaskItem | undefined;
    if (!task) return;

    const overStep = over.data.current?.task?.workflow_step ?? over.data.current?.step ?? task.workflow_step;
    const destList = tasksByStep[overStep] || [];
    const posInList = destList.findIndex((t) => t.id === task.id);
    const newPosition = posInList >= 0 ? posInList + 1.0 : destList.length + 1.0;

    if (overStep !== task.workflow_step || Math.abs(newPosition - task.position) > 0.001) {
      handleMoveTask(task, overStep, newPosition);
    }
  }

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <Link href="/admin/projects" className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-gray-50 transition">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="heading-brand text-2xl">{project.name}</h1>
          <p className="text-sm text-muted-foreground">
            {project.client_name && `${project.client_name} · `}
            13-step workflow · {project.task_count} tasks
          </p>
        </div>
        <PresenceAvatarStack users={boardPresence.others} label="On this board:" />
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto pb-4">
          <div className="flex gap-3 h-full min-w-max">
            {steps.map((step) => {
              const tasks = tasksByStep[step.step] || [];
              return (
                <KanbanColumn
                  key={step.step}
                  step={step}
                  tasks={tasks}
                  addingTo={addingTo}
                  newTaskTitle={newTaskTitle}
                  setAddingTo={setAddingTo}
                  setNewTaskTitle={setNewTaskTitle}
                  handleAddTask={handleAddTask}
                  setSelectedTask={setSelectedTask}
                />
              );
            })}
          </div>
        </div>

        <DragOverlay>
          {activeTask ? <TaskCardOverlay task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Task detail drawer */}
      {selectedTask && (
        <TaskDrawer
          task={selectedTask}
          steps={steps}
          projectId={projectId}
          viewers={taskPresence.others}
          onClose={() => setSelectedTask(null)}
          onUpdate={fetchBoard}
        />
      )}
    </div>
  );
}

/* ── Kanban Column with droppable area ── */
function KanbanColumn({
  step,
  tasks,
  addingTo,
  newTaskTitle,
  setAddingTo,
  setNewTaskTitle,
  handleAddTask,
  setSelectedTask,
}: {
  step: WorkflowStep;
  tasks: TaskItem[];
  addingTo: number | null;
  newTaskTitle: string;
  setAddingTo: (v: number | null) => void;
  setNewTaskTitle: (v: string) => void;
  handleAddTask: (step: number) => void;
  setSelectedTask: (task: TaskItem) => void;
}) {
  // Make the column itself a droppable
  const { setNodeRef } = useSortable({
    id: `column-${step.step}`,
    data: { step: step.step },
    disabled: true, // column itself is not draggable
  });

  return (
    <div
      ref={setNodeRef}
      className={`w-[260px] shrink-0 bg-gray-50 rounded-xl border border-border flex flex-col border-t-4 ${STEP_COLORS[step.step] || "border-t-gray-300"}`}
    >
      {/* Column header */}
      <div className="px-3 py-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate" title={step.title}>
            {step.step}. {step.title}
          </h3>
          <span className="text-xs text-muted-foreground bg-white px-1.5 py-0.5 rounded-full border border-border">
            {tasks.length}
          </span>
        </div>
        {step.step === 9 && (
          <div className="flex items-center gap-1 mt-1">
            <Eye className="w-3 h-3 text-stevie-orange" />
            <span className="text-[10px] text-stevie-orange font-medium">Client visible</span>
          </div>
        )}
      </div>

      {/* Tasks */}
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[60px]">
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              onClick={() => setSelectedTask(task)}
            />
          ))}
        </div>
      </SortableContext>

      {/* Add task */}
      <div className="p-2 border-t border-border/50">
        {addingTo === step.step ? (
          <div className="space-y-2">
            <input
              autoFocus
              type="text"
              placeholder="Task title..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddTask(step.step)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-border text-xs focus:outline-none focus:ring-2 focus:ring-stevie-lavender/50"
            />
            <div className="flex gap-1">
              <button onClick={() => handleAddTask(step.step)} className="flex-1 py-1 rounded-lg bg-foreground text-white text-xs font-medium">Add</button>
              <button onClick={() => { setAddingTo(null); setNewTaskTitle(""); }} className="px-2 py-1 rounded-lg border border-border text-xs">Cancel</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingTo(step.step)}
            className="w-full py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-white rounded-lg transition flex items-center justify-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add task
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Task Detail Drawer ── */
function TaskDrawer({
  task,
  steps,
  projectId,
  viewers,
  onClose,
  onUpdate,
}: {
  task: TaskItem;
  steps: WorkflowStep[];
  projectId: string;
  viewers: import("@/lib/use-presence").PresenceUser[];
  onClose: () => void;
  onUpdate: () => void;
}) {
  const currentStep = steps.find((s) => s.step === task.workflow_step);

  async function handleDelete() {
    if (!confirm("Delete this task?")) return;
    try {
      await apiFetch(`/api/projects/${projectId}/tasks/${task.id}`, { method: "DELETE" });
      onUpdate();
      onClose();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function handleMove(newStep: number) {
    try {
      await apiFetch(`/api/projects/${projectId}/tasks/${task.id}/move`, {
        method: "POST",
        body: JSON.stringify({ workflow_step: newStep, position: 1.0, version: task.version }),
      });
      onUpdate();
      onClose();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Conflict — please refresh");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-xl overflow-y-auto">
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="heading-brand text-xl">Task Detail</h2>
              <PresenceAvatarStack users={viewers} />
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-gray-50"><X className="w-4 h-4" /></button>
          </div>

          <div>
            <h3 className="font-semibold text-lg">{task.title}</h3>
            {task.description && <p className="text-sm text-muted-foreground mt-1">{task.description}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Step</p>
              <p className="text-sm font-medium">{currentStep?.step}. {currentStep?.title}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Priority</p>
              <p className="text-sm font-medium capitalize flex items-center gap-1">
                <Flag className={`w-3.5 h-3.5 ${PRIORITY_COLORS[task.priority]}`} />
                {task.priority}
              </p>
            </div>
            {task.assignee_name && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Assignee</p>
                <p className="text-sm">{task.assignee_name}</p>
              </div>
            )}
            {task.due_date && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Due Date</p>
                <p className="text-sm">{formatDate(task.due_date)}</p>
              </div>
            )}
          </div>

          {task.tags.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Tags</p>
              <div className="flex gap-1 flex-wrap">
                {task.tags.map((tag, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full bg-gray-100 text-xs">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {task.client_visible && (
            <div className="bg-stevie-orange/5 border border-stevie-orange/20 rounded-xl p-3">
              <p className="text-xs font-medium text-stevie-orange flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" /> Client Visible (Step 9)
              </p>
              {task.client_approved && (
                <p className="text-xs text-stevie-green mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approved by client
                </p>
              )}
              {task.client_feedback && (
                <p className="text-xs text-muted-foreground mt-1">Feedback: {task.client_feedback}</p>
              )}
            </div>
          )}

          {/* Move to step */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Move to Step</p>
            <div className="grid grid-cols-4 gap-1">
              {steps.map((s) => (
                <button
                  key={s.step}
                  onClick={() => handleMove(s.step)}
                  disabled={s.step === task.workflow_step}
                  className={`py-1.5 rounded-lg text-[10px] font-medium transition ${
                    s.step === task.workflow_step
                      ? "bg-foreground text-white"
                      : "bg-gray-100 text-muted-foreground hover:bg-gray-200"
                  } disabled:opacity-50`}
                >
                  {s.step}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <button onClick={handleDelete} className="inline-flex items-center gap-1.5 text-sm text-stevie-orange hover:underline">
              <Trash2 className="w-3.5 h-3.5" /> Delete task
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
