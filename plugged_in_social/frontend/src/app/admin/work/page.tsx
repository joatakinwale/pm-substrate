"use client";

/**
 * PM-1: Admin → Work — internal-team project management surface.
 *
 * This page is the twin of /admin/projects but scoped to
 * ``project_type == "internal"``. Internal projects never surface through
 * the client portal (enforced server-side in app/api/portal.py) and have
 * no client_name/client_email. Visibility gate is team/admins_only.
 *
 * The Kanban board at /admin/projects/[id] is shared between both
 * surfaces — internal projects are allowed to override the canonical
 * 13-step workflow via the ``workflow_steps`` JSONB column on the
 * project row. The board API honors that override automatically.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  X,
  Calendar,
  Lock,
  Users2,
} from "lucide-react";
import { apiFetch, type Project, type PaginatedResponse } from "@/lib/api";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

const STATUS_COLORS: Record<string, string> = {
  active: "bg-stevie-green/10 text-stevie-green",
  paused: "bg-stevie-lavender/15 text-purple-700",
  completed: "bg-stevie-sky/10 text-stevie-sky",
  archived: "bg-gray-100 text-gray-500",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function WorkPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      // PM-1: ``type=internal`` tells the backend to return only internal
      // projects. The admins_only visibility filter is applied server-side
      // based on the caller's role — we don't need a role check here.
      const params = new URLSearchParams({
        page: String(page),
        per_page: "25",
        type: "internal",
      });
      if (status) params.set("status", status);
      if (search) params.set("search", search);
      const data = await apiFetch<PaginatedResponse<Project>>(`/api/projects?${params}`);
      setProjects(data.items);
      setTotal(data.total);
      setPages(data.pages);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [page, status, search]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-brand text-3xl">Work</h1>
          <p className="text-muted-foreground mt-1">
            Internal team projects · {total} project{total !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 transition"
        >
          <Plus className="w-4 h-4" /> New Internal Project
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search internal projects..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-full border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-lavender/50"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setStatus(opt.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                status === opt.value
                  ? "bg-foreground text-white"
                  : "bg-gray-100 text-muted-foreground hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Project cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-border p-6 animate-pulse"
              >
                <div className="h-4 bg-gray-200 rounded w-32 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            ))
          : projects.length === 0
          ? (
              <div className="col-span-full bg-white rounded-2xl border border-border p-12 text-center">
                <Briefcase className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  No internal projects yet. Create one for your team's work.
                </p>
              </div>
            )
          : projects.map((p) => (
              <Link
                key={p.id}
                href={`/admin/projects/${p.id}`}
                className="bg-white rounded-2xl border border-border p-6 hover:border-foreground/20 transition group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {p.color && (
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: p.color }}
                      />
                    )}
                    <h3 className="font-semibold truncate">{p.name}</h3>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${
                      STATUS_COLORS[p.status] || "bg-gray-100"
                    }`}
                  >
                    {p.status}
                  </span>
                </div>

                {p.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {p.description}
                  </p>
                )}

                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <span className="text-xs text-muted-foreground">
                    {p.task_count} task{p.task_count !== 1 ? "s" : ""}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.visibility === "admins_only"
                        ? "bg-stevie-lavender/15 text-purple-700"
                        : "bg-gray-100 text-muted-foreground"
                    }`}
                    title={
                      p.visibility === "admins_only"
                        ? "Only admins & owners can see this project"
                        : "Visible to the whole team"
                    }
                  >
                    {p.visibility === "admins_only" ? (
                      <>
                        <Lock className="w-3 h-3" /> Admins only
                      </>
                    ) : (
                      <>
                        <Users2 className="w-3 h-3" /> Team
                      </>
                    )}
                  </span>
                  {p.workflow_steps && (
                    <span className="text-xs text-muted-foreground">
                      Custom workflow ({p.workflow_steps.length} steps)
                    </span>
                  )}
                  {p.target_date && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
                      <Calendar className="w-3 h-3" /> {formatDate(p.target_date)}
                    </span>
                  )}
                </div>
              </Link>
            ))}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {pages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="w-9 h-9 rounded-full border border-border flex items-center justify-center disabled:opacity-30 hover:bg-gray-50 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(Math.min(pages, page + 1))}
              disabled={page >= pages}
              className="w-9 h-9 rounded-full border border-border flex items-center justify-center disabled:opacity-30 hover:bg-gray-50 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create drawer */}
      {showCreate && (
        <CreateInternalProjectDrawer
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            fetchProjects();
          }}
        />
      )}
    </div>
  );
}

/**
 * PM-1: create-drawer variant for internal projects. No client fields,
 * no compound-phase (that's a client-engagement concept). Includes a
 * visibility toggle and an optional custom workflow preset.
 */
const WORK_COLOR_SWATCHES = [
  "#7CC8A5", // stevie-green
  "#7BB6D9", // stevie-sky
  "#E8A87C", // stevie-orange
  "#B5A8D3", // stevie-lavender
  "#D0E17A", // stevie-chartreuse
  "#6B7280", // slate
];

function CreateInternalProjectDrawer({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"team" | "admins_only">("team");
  const [workflowPreset, setWorkflowPreset] = useState<"stevie" | "simple">("stevie");
  const [targetDate, setTargetDate] = useState("");
  const [color, setColor] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!name) return;
    setSaving(true);
    try {
      // PM-1: a small library of sensible presets. The canonical 13-step
      // Stevie workflow is selected by sending ``workflow_steps: null``,
      // which tells the server to fall back to the default list. The
      // "simple" preset is a generic 4-column engineering flow.
      const workflow_steps =
        workflowPreset === "simple"
          ? [
              { step: 1, key: "backlog", title: "Backlog" },
              { step: 2, key: "in_progress", title: "In Progress" },
              { step: 3, key: "review", title: "Review" },
              { step: 4, key: "done", title: "Done" },
            ]
          : null;

      await apiFetch("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: description || null,
          project_type: "internal",
          visibility,
          workflow_steps,
          target_date: targetDate ? new Date(targetDate).toISOString() : null,
          color: color || null,
        }),
      });
      onCreated();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-xl overflow-y-auto">
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="heading-brand text-xl">New Internal Project</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-gray-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Project Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Q3 Platform Initiatives"
                className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-lavender/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="What is this project for?"
                className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-lavender/50 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Visibility
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVisibility("team")}
                  className={`px-3 py-2 rounded-lg text-sm border transition text-left ${
                    visibility === "team"
                      ? "bg-stevie-green/10 border-stevie-green text-stevie-green"
                      : "border-border text-muted-foreground hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    <Users2 className="w-3.5 h-3.5" /> Team
                  </div>
                  <div className="text-xs mt-0.5 opacity-80">
                    All team members
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility("admins_only")}
                  className={`px-3 py-2 rounded-lg text-sm border transition text-left ${
                    visibility === "admins_only"
                      ? "bg-stevie-lavender/15 border-stevie-lavender text-purple-700"
                      : "border-border text-muted-foreground hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    <Lock className="w-3.5 h-3.5" /> Admins only
                  </div>
                  <div className="text-xs mt-0.5 opacity-80">
                    Admins & owners
                  </div>
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Workflow
              </label>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setWorkflowPreset("stevie")}
                  className={`w-full px-3 py-2 rounded-lg text-sm border transition text-left ${
                    workflowPreset === "stevie"
                      ? "bg-stevie-green/10 border-stevie-green"
                      : "border-border hover:bg-gray-50"
                  }`}
                >
                  <div className="font-medium">Stevie 13-step</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Strategy → Reporting. The full production flow.
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setWorkflowPreset("simple")}
                  className={`w-full px-3 py-2 rounded-lg text-sm border transition text-left ${
                    workflowPreset === "simple"
                      ? "bg-stevie-green/10 border-stevie-green"
                      : "border-border hover:bg-gray-50"
                  }`}
                >
                  <div className="font-medium">Simple 4-column</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Backlog · In Progress · Review · Done.
                  </div>
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Target Date
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-lavender/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Color
              </label>
              <div className="flex gap-2">
                {WORK_COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c === color ? "" : c)}
                    className={`w-7 h-7 rounded-full border-2 transition ${
                      color === c ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Pick color ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Internal projects never surface in the client portal.
          </p>
          <button
            onClick={handleCreate}
            disabled={saving || !name}
            className="w-full py-2.5 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 transition disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Project"}
          </button>
        </div>
      </div>
    </div>
  );
}
