"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  FolderKanban,
  ChevronLeft,
  ChevronRight,
  X,
  Calendar,
  Users,
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

const PHASE_PILLS: Record<string, string> = {
  protect: "bg-stevie-sky/15 text-stevie-sky",
  deepen: "bg-stevie-lavender/20 text-purple-700",
  amplify: "bg-stevie-chartreuse/20 text-foreground",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ProjectsPage() {
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
      // PM-1: scope to client projects. Internal projects live under /admin/work.
      // Omitting `type` would show both and blur the two surfaces.
      const params = new URLSearchParams({
        page: String(page),
        per_page: "25",
        type: "client",
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
          <h1 className="heading-brand text-3xl">Projects</h1>
          <p className="text-muted-foreground mt-1">{total} project{total !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 transition">
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search projects..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-full border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-lavender/50" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => { setStatus(opt.value); setPage(1); }} className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${status === opt.value ? "bg-foreground text-white" : "bg-gray-100 text-muted-foreground hover:bg-gray-200"}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Project cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-border p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-32 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            ))
          : projects.length === 0
          ? (
              <div className="col-span-full bg-white rounded-2xl border border-border p-12 text-center">
                <FolderKanban className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No projects yet. Create one to get started.</p>
              </div>
            )
          : projects.map((p) => (
              <Link
                key={p.id}
                href={`/admin/projects/${p.id}`}
                className="bg-white rounded-2xl border border-border p-6 hover:border-foreground/20 transition group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {p.color && (
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    )}
                    <h3 className="font-semibold truncate">{p.name}</h3>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${STATUS_COLORS[p.status] || "bg-gray-100"}`}>
                    {p.status}
                  </span>
                </div>

                {p.client_name && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
                    <Users className="w-3 h-3" /> {p.client_name}
                  </p>
                )}

                <div className="flex items-center gap-3 mt-3">
                  <span className="text-xs text-muted-foreground">
                    {p.task_count} task{p.task_count !== 1 ? "s" : ""}
                  </span>
                  {p.compound_phase && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${PHASE_PILLS[p.compound_phase] || "bg-gray-100"}`}>
                      {p.compound_phase}
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
          <p className="text-sm text-muted-foreground">Page {page} of {pages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="w-9 h-9 rounded-full border border-border flex items-center justify-center disabled:opacity-30 hover:bg-gray-50 transition"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setPage(Math.min(pages, page + 1))} disabled={page >= pages} className="w-9 h-9 rounded-full border border-border flex items-center justify-center disabled:opacity-30 hover:bg-gray-50 transition"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Create drawer */}
      {showCreate && <CreateProjectDrawer onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchProjects(); }} />}
    </div>
  );
}

const COLOR_SWATCHES = [
  "#7CC8A5", // stevie-green
  "#7BB6D9", // stevie-sky
  "#E8A87C", // stevie-orange
  "#B5A8D3", // stevie-lavender
  "#D0E17A", // stevie-chartreuse
  "#6B7280", // slate
];

function CreateProjectDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [phase, setPhase] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [color, setColor] = useState<string>("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!name) return;
    setSaving(true);
    try {
      await apiFetch("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: description || null,
          client_name: clientName || null,
          client_email: clientEmail || null,
          compound_phase: phase || null,
          target_date: targetDate ? new Date(targetDate).toISOString() : null,
          color: color || null,
          project_type: "client",
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
            <h2 className="heading-brand text-xl">New Project</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-gray-50"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Project Name *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-lavender/50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="What is this engagement about?"
                className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-lavender/50 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Client Name</label>
              <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-lavender/50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Client Email</label>
              <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-lavender/50" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Compound Phase</label>
                <select value={phase} onChange={(e) => setPhase(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-lavender/50">
                  <option value="">Select...</option>
                  <option value="protect">Protect</option>
                  <option value="deepen">Deepen</option>
                  <option value="amplify">Amplify</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Target Date</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-lavender/50"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Color</label>
              <div className="flex gap-2">
                {COLOR_SWATCHES.map((c) => (
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
          <p className="text-xs text-muted-foreground">The 13-step workflow Kanban board is auto-generated.</p>
          <button onClick={handleCreate} disabled={saving || !name} className="w-full py-2.5 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 transition disabled:opacity-50">
            {saving ? "Creating..." : "Create Project"}
          </button>
        </div>
      </div>
    </div>
  );
}
