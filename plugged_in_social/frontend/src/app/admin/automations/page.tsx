"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Search,
  Workflow,
  Play,
  Pause,
  X,
  Zap,
  Mail,
  Tag,
  FileText,
  UserPlus,
  Trash2,
  History,
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import {
  apiFetch,
  ApiError,
  type AutomationWorkflow,
  type AutomationRun,
  type PaginatedResponse,
} from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-50 text-gray-600",
  active: "bg-green-50 text-green-700",
  paused: "bg-yellow-50 text-yellow-700",
  archived: "bg-red-50 text-red-700",
};

const TRIGGER_ICONS: Record<string, typeof Zap> = {
  form_submission: FileText,
  tag_added: Tag,
  contact_created: UserPlus,
  email_opened: Mail,
  email_clicked: Zap,
  invoice_paid: Zap,
  proposal_signed: FileText,
  manual: Play,
};

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<AutomationWorkflow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AutomationWorkflow | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    trigger_type: "manual",
  });
  const [creating, setCreating] = useState(false);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState("");

  const showError = useCallback((err: unknown, fallback: string) => {
    if (err instanceof ApiError) {
      setError(err.message);
      return;
    }
    setError(fallback);
  }, []);

  const fetchAutomations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<AutomationWorkflow[]>("/api/automations");
      setAutomations(data);
    } catch (err) {
      showError(err, "Failed to load automations.");
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchAutomations();
  }, [fetchAutomations]);

  const handleCreate = async () => {
    if (!createForm.name) return;
    setCreating(true);
    setError("");
    try {
      await apiFetch("/api/automations", {
        method: "POST",
        body: JSON.stringify(createForm),
      });
      setShowCreate(false);
      setCreateForm({ name: "", description: "", trigger_type: "manual" });
      fetchAutomations();
    } catch (err) {
      showError(err, "Failed to create automation.");
    } finally {
      setCreating(false);
    }
  };

  const handleActivate = async (automation: AutomationWorkflow) => {
    if (automation.steps.length === 0) {
      setError("Add at least one step before activating this automation.");
      return;
    }
    setError("");
    try {
      await apiFetch(`/api/automations/${automation.id}/activate`, { method: "POST" });
      fetchAutomations();
      setSelected(null);
    } catch (err) {
      showError(err, "Failed to activate automation.");
    }
  };

  const handlePause = async (id: string) => {
    setError("");
    try {
      await apiFetch(`/api/automations/${id}/pause`, { method: "POST" });
      fetchAutomations();
      setSelected(null);
    } catch (err) {
      showError(err, "Failed to pause automation.");
    }
  };

  const handleTrigger = async (id: string) => {
    if (!confirm("Trigger this automation now? This will run all configured steps.")) return;
    setTriggering(true);
    setError("");
    try {
      await apiFetch(`/api/automations/${id}/trigger`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      fetchRuns(id);
      fetchAutomations();
    } catch (err) {
      showError(err, "Failed to trigger automation.");
    } finally {
      setTriggering(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this automation? This cannot be undone.")) return;
    setError("");
    try {
      await apiFetch(`/api/automations/${id}`, { method: "DELETE" });
      setSelected(null);
      fetchAutomations();
    } catch (err) {
      showError(err, "Failed to delete automation.");
    }
  };

  const fetchRuns = useCallback(async (automationId: string) => {
    setLoadingRuns(true);
    try {
      const data = await apiFetch<PaginatedResponse<AutomationRun>>(
        `/api/automations/${automationId}/runs?per_page=20`
      );
      setRuns(data.items);
    } catch (err) {
      showError(err, "Failed to load automation runs.");
      setRuns([]);
    } finally {
      setLoadingRuns(false);
    }
  }, [showError]);

  useEffect(() => {
    if (selected) {
      fetchRuns(selected.id);
    } else {
      setRuns([]);
    }
  }, [selected, fetchRuns]);

  const filtered = automations.filter(
    (a) =>
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.trigger_type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-brand text-2xl">Automations</h1>
          <p className="text-muted-foreground text-sm">
            {automations.filter((a) => a.status === "active").length} active of {automations.length} workflow{automations.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 transition"
        >
          <Plus className="w-4 h-4" /> New Automation
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search automations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-full border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-border p-5 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-4 bg-gray-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center text-muted-foreground">
          <Workflow className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p>No automations found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((automation) => {
            const TriggerIcon = TRIGGER_ICONS[automation.trigger_type] || Zap;
            return (
              <div
                key={automation.id}
                onClick={() => setSelected(automation)}
                className="bg-white rounded-2xl border border-border p-5 hover:border-foreground/20 cursor-pointer transition flex items-center gap-4"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${automation.status === "active" ? "bg-green-50" : "bg-gray-50"}`}>
                  <TriggerIcon className={`w-5 h-5 ${automation.status === "active" ? "text-green-600" : "text-gray-400"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-semibold text-sm truncate">{automation.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${STATUS_COLORS[automation.status]}`}>{automation.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Trigger: {automation.trigger_type.replace(/_/g, " ")} · {automation.steps.length} step{automation.steps.length !== 1 ? "s" : ""} · {automation.total_runs} run{automation.total_runs !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {automation.status === "draft" || automation.status === "paused" ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleActivate(automation); }}
                      disabled={automation.steps.length === 0}
                      className="p-2 rounded-lg hover:bg-green-50 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition"
                      title={automation.steps.length === 0 ? "Add at least one step before activating" : "Activate"}
                    >
                      <Play className="w-4 h-4 text-green-600" />
                    </button>
                  ) : automation.status === "active" ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePause(automation.id); }}
                      className="p-2 rounded-lg hover:bg-yellow-50 transition"
                      title="Pause"
                    >
                      <Pause className="w-4 h-4 text-yellow-600" />
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-lg bg-white h-full overflow-y-auto shadow-xl animate-in slide-in-from-right">
            <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <h2 className="font-semibold text-lg truncate">{selected.name}</h2>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-full hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[selected.status]}`}>{selected.status}</span>
                {(selected.status === "draft" || selected.status === "paused") && (
                  <button
                    onClick={() => handleActivate(selected)}
                    disabled={selected.steps.length === 0}
                    title={selected.steps.length === 0 ? "Add at least one step before activating" : "Activate"}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <Play className="w-3 h-3" /> Activate
                  </button>
                )}
                {selected.status === "active" && (
                  <button onClick={() => handlePause(selected.id)} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500 text-white text-xs font-medium hover:bg-yellow-600 transition"><Pause className="w-3 h-3" /> Pause</button>
                )}
                {selected.status === "active" && (
                  <button
                    onClick={() => handleTrigger(selected.id)}
                    disabled={triggering}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stevie-sky text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 transition"
                  >
                    {triggering ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    {triggering ? "Triggering..." : "Trigger Now"}
                  </button>
                )}
                {selected.status !== "active" && (
                  <button
                    onClick={() => handleDelete(selected.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                )}
              </div>

              <div className="space-y-3 text-sm">
                <div><p className="text-muted-foreground text-xs">Trigger</p><p className="font-medium capitalize">{selected.trigger_type.replace(/_/g, " ")}</p></div>
                {selected.description && <div><p className="text-muted-foreground text-xs">Description</p><p>{selected.description}</p></div>}
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-muted-foreground text-xs">Total Runs</p><p className="font-bold text-lg">{selected.total_runs}</p></div>
                  <div><p className="text-muted-foreground text-xs">Steps</p><p className="font-bold text-lg">{selected.steps.length}</p></div>
                </div>
              </div>

              {selected.steps.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Steps</h3>
                  <div className="space-y-2">
                    {selected.steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg text-sm">
                        <span className="w-5 h-5 rounded-full bg-foreground text-white text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
                        <span className="capitalize">{step.type.replace(/_/g, " ")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1.5">
                  <History className="w-3 h-3" /> Run History
                </h3>
                {loadingRuns ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-12 bg-gray-50 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : runs.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No runs yet</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {runs.map((r) => (
                      <div key={r.id} className="rounded-lg border border-border p-3 text-xs space-y-1">
                        <div className="flex items-center gap-2">
                          {r.status === "completed" ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                          ) : r.status === "failed" ? (
                            <XCircle className="w-3.5 h-3.5 text-red-600" />
                          ) : (
                            <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                          )}
                          <span className="capitalize font-medium">{r.status}</span>
                          <span className="text-muted-foreground">· {r.steps_completed}/{selected.steps.length} steps</span>
                          {r.trigger_event && (
                            <span className="ml-auto px-1.5 py-0.5 rounded bg-gray-100 text-[10px] capitalize">
                              {r.trigger_event.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>
                        <p className="text-muted-foreground">
                          {new Date(r.created_at).toLocaleString()}
                          {r.completed_at && (
                            <span className="ml-2">· Finished {new Date(r.completed_at).toLocaleTimeString()}</span>
                          )}
                        </p>
                        {r.error_message && (
                          <p className="text-red-600 text-[11px] mt-1 font-mono bg-red-50 px-2 py-1 rounded">
                            {r.error_message}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-xs text-muted-foreground pt-4 border-t border-border">
                <p>Created: {new Date(selected.created_at).toLocaleString()}</p>
                {selected.last_run_at && <p>Last run: {new Date(selected.last_run_at).toLocaleString()}</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Drawer */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-lg bg-white h-full overflow-y-auto shadow-xl animate-in slide-in-from-right">
            <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <h2 className="font-semibold text-lg">New Automation</h2>
              <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-full hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Automation Name *</label>
                <input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10" placeholder="New Lead Welcome" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Description</label>
                <textarea value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Trigger</label>
                <select value={createForm.trigger_type} onChange={(e) => setCreateForm({ ...createForm, trigger_type: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10 bg-white">
                  <option value="manual">Manual</option>
                  <option value="form_submission">Form Submission</option>
                  <option value="tag_added">Tag Added</option>
                  <option value="contact_created">Contact Created</option>
                  <option value="email_opened">Email Opened</option>
                  <option value="email_clicked">Email Clicked</option>
                  <option value="invoice_paid">Invoice Paid</option>
                  <option value="proposal_signed">Proposal Signed</option>
                </select>
              </div>
              <button onClick={handleCreate} disabled={creating || !createForm.name} className="w-full py-2.5 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 disabled:opacity-50 transition">
                {creating ? "Creating..." : "Create Automation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
