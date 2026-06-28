"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  MessageSquare,
  Paperclip,
  ChevronDown,
  ChevronUp,
  Send,
  Loader2,
} from "lucide-react";
import {
  portalFetch,
  type PortalProject,
  type PortalTask,
  type PortalComment,
} from "@/lib/portal-api";
import { useAuthGuard } from "@/lib/use-auth-guard";

export default function PortalApprovalsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border p-6 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-4 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      }
    >
      <ApprovalsContent />
    </Suspense>
  );
}

function ApprovalsContent() {
  const { ready, requireAuth } = useAuthGuard();
  const searchParams = useSearchParams();
  const projectFilter = searchParams.get("project");

  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [tasks, setTasks] = useState<PortalTask[]>([]);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, PortalComment[]>>({});
  const [newComment, setNewComment] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    portalFetch<PortalProject[]>("/api/portal/projects")
      .then((p) => {
        setProjects(p);
        const initial = projectFilter || (p.length > 0 ? p[0].id : "");
        setSelectedProject(initial);
      })
      .catch(requireAuth)
      .finally(() => setLoading(false));
  }, [ready, requireAuth, projectFilter]);

  // Load tasks when project changes
  useEffect(() => {
    if (!selectedProject) return;
    portalFetch<PortalTask[]>(`/api/portal/projects/${selectedProject}/tasks`)
      .then(setTasks)
      .catch(() => setTasks([]));
  }, [selectedProject]);

  const loadComments = async (taskId: string) => {
    const c = await portalFetch<PortalComment[]>(`/api/portal/tasks/${taskId}/comments`);
    setComments((prev) => ({ ...prev, [taskId]: c }));
  };

  const handleToggleTask = (taskId: string) => {
    if (expandedTask === taskId) {
      setExpandedTask(null);
    } else {
      setExpandedTask(taskId);
      if (!comments[taskId]) loadComments(taskId);
    }
  };

  const handleApprove = async (taskId: string, approved: boolean) => {
    setSubmitting(taskId);
    try {
      const updated = await portalFetch<PortalTask>(`/api/portal/tasks/${taskId}/approve`, {
        method: "POST",
        body: JSON.stringify({
          approved,
          feedback: approved ? null : feedbackText || null,
        }),
      });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      setFeedbackText("");
    } catch (err) {
      console.error("Approval failed:", err);
    } finally {
      setSubmitting(null);
    }
  };

  const handleAddComment = async (taskId: string) => {
    if (!newComment.trim()) return;
    try {
      const comment = await portalFetch<PortalComment>(`/api/portal/tasks/${taskId}/comments`, {
        method: "POST",
        body: JSON.stringify({ content: newComment }),
      });
      setComments((prev) => ({
        ...prev,
        [taskId]: [...(prev[taskId] || []), comment],
      }));
      setNewComment("");
    } catch (err) {
      console.error("Comment failed:", err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl border p-6 animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
            <div className="h-4 bg-gray-100 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-brand text-3xl">Content Approvals</h1>
          <p className="text-muted-foreground mt-1">
            Review and approve deliverables from your agency team.
          </p>
        </div>

        {projects.length > 1 && (
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="rounded-full border border-border px-4 py-2 text-sm bg-white"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-8 text-center">
          <CheckCircle2 className="w-8 h-8 mx-auto text-stevie-green mb-3" />
          <p className="font-medium">All caught up!</p>
          <p className="text-sm text-muted-foreground mt-1">
            No deliverables awaiting your review right now.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const isExpanded = expandedTask === task.id;
            const taskComments = comments[task.id] || [];

            return (
              <div
                key={task.id}
                className="bg-white rounded-2xl border border-border overflow-hidden"
              >
                {/* Task header */}
                <button
                  onClick={() => handleToggleTask(task.id)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-3">
                    {task.client_approved ? (
                      <CheckCircle2 className="w-5 h-5 text-stevie-green flex-shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-stevie-orange flex-shrink-0" />
                    )}
                    <div>
                      <h3 className="font-medium">{task.title}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            task.client_approved
                              ? "bg-stevie-green/10 text-stevie-green"
                              : "bg-stevie-orange/10 text-stevie-orange"
                          }`}
                        >
                          {task.client_approved ? "Approved" : "Pending Review"}
                        </span>
                        {task.attachments.length > 0 && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Paperclip className="w-3 h-3" />
                            {task.attachments.length}
                          </span>
                        )}
                        {task.due_date && (
                          <span className="text-xs text-muted-foreground">
                            Due {new Date(task.due_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-6 pb-6 border-t border-border">
                    {/* Description */}
                    {task.description && (
                      <div className="mt-4 prose prose-sm max-w-none">
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {task.description}
                        </p>
                      </div>
                    )}

                    {/* Attachments */}
                    {task.attachments.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                          Attachments
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {task.attachments.map((att, i) => (
                            <a
                              key={i}
                              href={typeof att === "string" ? att : "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-50 text-xs hover:bg-gray-100 transition"
                            >
                              <Paperclip className="w-3 h-3" />
                              {typeof att === "string" ? att.split("/").pop() : `File ${i + 1}`}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Previous feedback */}
                    {task.client_feedback && (
                      <div className="mt-4 bg-stevie-orange/5 rounded-xl p-4">
                        <p className="text-xs text-muted-foreground mb-1">Your feedback:</p>
                        <p className="text-sm">{task.client_feedback}</p>
                      </div>
                    )}

                    {/* Approval buttons */}
                    {!task.client_approved && (
                      <div className="mt-4 space-y-3">
                        <textarea
                          value={feedbackText}
                          onChange={(e) => setFeedbackText(e.target.value)}
                          placeholder="Optional feedback or revision notes..."
                          rows={2}
                          className="w-full rounded-xl border border-border px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-stevie-sky/50"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(task.id, true)}
                            disabled={submitting === task.id}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-stevie-green text-white text-sm font-medium hover:bg-stevie-green/90 transition disabled:opacity-50"
                          >
                            {submitting === task.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4" />
                            )}
                            Approve
                          </button>
                          <button
                            onClick={() => handleApprove(task.id, false)}
                            disabled={submitting === task.id || !feedbackText.trim()}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-border text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            Request Revisions
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Comments */}
                    <div className="mt-6 pt-4 border-t border-border">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        Comments ({taskComments.length})
                      </p>

                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {taskComments.map((c) => (
                          <div
                            key={c.id}
                            className={`p-3 rounded-xl text-sm ${
                              c.is_client_comment
                                ? "bg-stevie-sky/10 ml-8"
                                : "bg-gray-50 mr-8"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-xs">
                                {c.author_name || "Team"}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(c.created_at).toLocaleString()}
                              </span>
                            </div>
                            <p>{c.content}</p>
                          </div>
                        ))}
                      </div>

                      {/* Add comment */}
                      <div className="mt-3 flex gap-2">
                        <input
                          type="text"
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAddComment(task.id)}
                          placeholder="Add a comment..."
                          className="flex-1 rounded-full border border-border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stevie-sky/50"
                        />
                        <button
                          onClick={() => handleAddComment(task.id)}
                          disabled={!newComment.trim()}
                          className="rounded-full bg-foreground text-white p-2.5 hover:bg-foreground/90 transition disabled:opacity-50"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
