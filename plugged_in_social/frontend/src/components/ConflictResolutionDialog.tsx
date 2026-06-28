"use client";

/**
 * ConflictResolutionDialog — resolves 409 optimistic-locking collisions.
 *
 * Triggered by a ConflictError (from src/lib/api.ts) when a PATCH on a
 * versioned resource (pages, blog posts, kanban task moves) lost a race
 * against another editor. We show the user a side-by-side of the fields
 * that actually disagree and let them pick:
 *
 *   • Keep mine   — overwrite the server with the user's pending edit
 *                   (the caller re-sends the same payload with the
 *                   server's current_version). This wipes the other
 *                   editor's change, so it's labelled with a warning.
 *   • Keep theirs — discard the pending edit and accept the server
 *                   state. Best when the other editor's version is
 *                   authoritative.
 *   • Cancel      — close the dialog without saving.
 *
 * "Merge" is deliberately not offered here — a generic field-level
 * merge UI is either lossy (for rich-text fields) or a full CRDT, and
 * the latter belongs in CONCURRENT-3 (Supabase Realtime co-editing).
 * This dialog is the floor; the CRDT work raises it.
 */
import { AlertTriangle, ArrowRight, User, X } from "lucide-react";
import type { ReactNode } from "react";

export interface ConflictFieldView {
  /** Field key — e.g. "title", "body", "status". */
  key: string;
  /** Human-facing label — e.g. "Title", "Body copy". */
  label: string;
  /** Value the user was trying to save. */
  mine: unknown;
  /** Value currently on the server. */
  theirs: unknown;
  /**
   * Optional renderer for non-string values (JSON blocks, arrays, etc.).
   * Defaults to ``String(v)``. Falsy values render as an em-dash.
   */
  render?: (value: unknown) => ReactNode;
}

export interface ConflictResolutionDialogProps {
  /** Always true when the dialog is mounted; gates the backdrop. */
  open: boolean;
  /** Name of the resource in the server's voice — "page", "post", "task". */
  resource: string;
  /** Server's message — already phrased for end-users. */
  message: string;
  /** The field comparisons to display. Hide fields where mine === theirs. */
  fields: ConflictFieldView[];
  /** User chose to overwrite with their version. */
  onKeepMine: () => void;
  /** User chose to discard their edit and accept the server version. */
  onKeepTheirs: () => void;
  /** User dismissed the dialog. */
  onCancel: () => void;
  /** Disable the action buttons while the resolution is in flight. */
  busy?: boolean;
}

function defaultRender(value: unknown): ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground italic">empty</span>;
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    if (!value.length) {
      return <span className="text-muted-foreground italic">none</span>;
    }
    return value.map((v) => String(v)).join(", ");
  }
  if (typeof value === "object") {
    try {
      return (
        <pre className="text-xs bg-muted/40 rounded p-2 overflow-auto max-h-40 whitespace-pre-wrap">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export function ConflictResolutionDialog({
  open,
  resource,
  message,
  fields,
  onKeepMine,
  onKeepTheirs,
  onCancel,
  busy = false,
}: ConflictResolutionDialogProps) {
  if (!open) return null;

  // Only show fields that actually diverge. Keeps noise down when only
  // a single field changed on either side.
  const diverging = fields.filter(
    (f) => JSON.stringify(f.mine) !== JSON.stringify(f.theirs)
  );

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-title"
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col">
        <header className="flex items-start gap-3 p-6 border-b border-border">
          <div className="w-10 h-10 rounded-full bg-stevie-orange/10 text-stevie-orange flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2
              id="conflict-title"
              className="heading-brand text-lg leading-tight"
            >
              Someone else edited this {resource}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">{message}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="p-1 rounded-md hover:bg-muted/60 text-muted-foreground transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <section className="flex-1 overflow-y-auto p-6 space-y-5">
          {diverging.length === 0 && (
            <p className="text-sm text-muted-foreground">
              The server version is ahead of yours but the fields you
              edited match what&apos;s already saved. You can safely
              keep the server version.
            </p>
          )}
          {diverging.map((f) => {
            const render = f.render ?? defaultRender;
            return (
              <div key={f.key} className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {f.label}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-stevie-green/30 bg-stevie-green/5 p-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-stevie-green mb-1.5">
                      <User className="w-3.5 h-3.5" /> Your version
                    </div>
                    <div className="text-sm text-foreground break-words">
                      {render(f.mine)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-foreground mb-1.5">
                      <ArrowRight className="w-3.5 h-3.5" /> Server version
                    </div>
                    <div className="text-sm text-foreground break-words">
                      {render(f.theirs)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <footer className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 p-4 border-t border-border bg-muted/20 rounded-b-2xl">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-full text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onKeepTheirs}
            disabled={busy}
            className="px-4 py-2 rounded-full text-sm font-medium bg-white border border-border hover:border-foreground text-foreground transition-colors disabled:opacity-50"
          >
            Discard mine &amp; reload
          </button>
          <button
            type="button"
            onClick={onKeepMine}
            disabled={busy}
            className="px-4 py-2 rounded-full text-sm font-semibold bg-stevie-orange text-white hover:bg-stevie-orange/90 transition-colors disabled:opacity-50"
          >
            {busy ? "Saving…" : "Overwrite with mine"}
          </button>
        </footer>
      </div>
    </div>
  );
}
