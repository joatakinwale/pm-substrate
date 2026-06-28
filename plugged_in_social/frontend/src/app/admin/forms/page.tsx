"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Search,
  ClipboardList,
  X,
  Copy,
  Inbox,
  Trash2,
  Archive,
} from "lucide-react";
import {
  apiFetch,
  type FormDefinition,
  type FormSubmissionItem,
  type PaginatedResponse,
} from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-50 text-gray-600",
  active: "bg-green-50 text-green-700",
  archived: "bg-orange-50 text-orange-700",
};

export default function FormsPage() {
  const [forms, setForms] = useState<FormDefinition[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FormDefinition | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    slug: "",
    description: "",
    success_message: "Thank you for your submission!",
    notify_emails: "",
    redirect_url: "",
  });
  const [creating, setCreating] = useState(false);
  const [submissions, setSubmissions] = useState<FormSubmissionItem[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

  const fetchForms = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<FormDefinition[]>("/api/forms");
      setForms(data);
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  const handleCreate = async () => {
    if (!createForm.name || !createForm.slug) return;
    setCreating(true);
    try {
      const notifyList = createForm.notify_emails
        .split(",")
        .map((e) => e.trim())
        .filter((e) => e.length > 0);

      await apiFetch("/api/forms", {
        method: "POST",
        body: JSON.stringify({
          name: createForm.name,
          slug: createForm.slug,
          description: createForm.description || null,
          success_message: createForm.success_message || null,
          redirect_url: createForm.redirect_url || null,
          notify_emails: notifyList.length > 0 ? notifyList : null,
          schema_json: {},
        }),
      });
      setShowCreate(false);
      setCreateForm({
        name: "",
        slug: "",
        description: "",
        success_message: "Thank you for your submission!",
        notify_emails: "",
        redirect_url: "",
      });
      fetchForms();
    } catch {
      /* empty */
    } finally {
      setCreating(false);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await apiFetch(`/api/forms/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "active" }),
      });
      fetchForms();
      setSelected(null);
    } catch {
      /* empty */
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm("Archive this form? It will stop accepting submissions.")) return;
    try {
      await apiFetch(`/api/forms/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "archived" }),
      });
      fetchForms();
      setSelected(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to archive");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Permanently delete this form? Submissions will be lost.")) return;
    try {
      await apiFetch(`/api/forms/${id}`, { method: "DELETE" });
      fetchForms();
      setSelected(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const fetchSubmissions = useCallback(async (formId: string) => {
    setLoadingSubs(true);
    try {
      const data = await apiFetch<PaginatedResponse<FormSubmissionItem>>(
        `/api/forms/${formId}/submissions?per_page=25`
      );
      setSubmissions(data.items);
    } catch {
      setSubmissions([]);
    } finally {
      setLoadingSubs(false);
    }
  }, []);

  useEffect(() => {
    if (selected) {
      fetchSubmissions(selected.id);
    } else {
      setSubmissions([]);
    }
  }, [selected, fetchSubmissions]);

  const filtered = forms.filter(
    (f) =>
      !search ||
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-brand text-2xl">Forms</h1>
          <p className="text-muted-foreground text-sm">{forms.length} form{forms.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 transition"
        >
          <Plus className="w-4 h-4" /> New Form
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search forms..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-full border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-border p-5 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-4 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center text-muted-foreground">
          <ClipboardList className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p>No forms found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((form) => (
            <div
              key={form.id}
              onClick={() => setSelected(form)}
              className="bg-white rounded-2xl border border-border p-5 hover:border-foreground/20 cursor-pointer transition"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-sm">{form.name}</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[form.status]}`}>{form.status}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">/{form.slug}</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Inbox className="w-3 h-3" /> {form.submission_count} submissions</span>
              </div>
            </div>
          ))}
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
                {selected.status === "draft" && (
                  <button onClick={() => handleActivate(selected.id)} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stevie-green text-white text-xs font-medium hover:bg-stevie-green/90">
                    Activate
                  </button>
                )}
                {selected.status === "active" && (
                  <button onClick={() => handleArchive(selected.id)} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-stevie-orange text-stevie-orange text-xs font-medium hover:bg-stevie-orange/5">
                    <Archive className="w-3 h-3" /> Archive
                  </button>
                )}
                <button onClick={() => handleDelete(selected.id)} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-red-300 text-red-600 text-xs font-medium hover:bg-red-50">
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div><p className="text-muted-foreground text-xs">Slug</p><p className="font-mono text-sm">/{selected.slug}</p></div>
                <div><p className="text-muted-foreground text-xs">Description</p><p>{selected.description || "—"}</p></div>
                <div><p className="text-muted-foreground text-xs">Submissions</p><p className="font-bold text-lg">{selected.submission_count}</p></div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Embed URL</h3>
                <div className="flex items-center gap-2">
                  <input readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/form/${selected.slug}`} className="flex-1 px-3 py-2 bg-gray-50 rounded-lg text-xs border border-border" />
                  <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/form/${selected.slug}`)} className="px-3 py-2 rounded-lg bg-gray-100 text-xs hover:bg-gray-200 transition">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {selected.notify_emails && selected.notify_emails.length > 0 && (
                <div>
                  <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Notify</h3>
                  <div className="flex flex-wrap gap-1">
                    {selected.notify_emails.map((em, i) => (
                      <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-stevie-sky/10 text-stevie-sky">{em}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Submissions viewer */}
              <div>
                <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2">
                  Recent Submissions ({submissions.length})
                </h3>
                {loadingSubs ? (
                  <div className="h-16 bg-gray-50 rounded-lg animate-pulse" />
                ) : submissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3">No submissions yet.</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {submissions.map((s) => (
                      <div key={s.id} className="rounded-lg border border-border p-3 text-xs space-y-1">
                        <p className="text-muted-foreground">
                          {new Date(s.created_at).toLocaleString()}
                          {s.ip_address && <span className="ml-2 font-mono text-[10px]">· {s.ip_address}</span>}
                        </p>
                        <pre className="whitespace-pre-wrap font-mono text-[11px] bg-gray-50 rounded px-2 py-1">
                          {JSON.stringify(s.data, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-xs text-muted-foreground pt-4 border-t border-border">
                <p>Created: {new Date(selected.created_at).toLocaleString()}</p>
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
              <h2 className="font-semibold text-lg">New Form</h2>
              <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-full hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Form Name *</label>
                <input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10" placeholder="Contact Form" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Slug *</label>
                <input value={createForm.slug} onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10" placeholder="contact-form" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Description</label>
                <textarea value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Success Message</label>
                <input value={createForm.success_message} onChange={(e) => setCreateForm({ ...createForm, success_message: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Redirect URL</label>
                <input value={createForm.redirect_url} onChange={(e) => setCreateForm({ ...createForm, redirect_url: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10" placeholder="https://stevie.social/thanks (optional)" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Notify Emails</label>
                <input value={createForm.notify_emails} onChange={(e) => setCreateForm({ ...createForm, notify_emails: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10" placeholder="team@stevie.social, ops@stevie.social" />
                <p className="text-[11px] text-muted-foreground mt-1">Comma-separated list of addresses to notify on new submissions.</p>
              </div>
              <button onClick={handleCreate} disabled={creating || !createForm.name || !createForm.slug} className="w-full py-2.5 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 disabled:opacity-50 transition">
                {creating ? "Creating..." : "Create Form"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
