"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Search,
  User,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";
import {
  ApiError,
  apiFetch,
  type Booking,
  type PaginatedResponse,
} from "@/lib/api";
import { useRealtime } from "@/lib/use-realtime";

// Status tabs match the real BookingStatus enum (backend/app/models/booking.py).
const STATUS_TABS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "no_show", label: "No-show" },
  { value: "cancelled", label: "Cancelled" },
  { value: "rescheduled", label: "Rescheduled" },
];

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-stevie-sky/10 text-stevie-sky",
  pending: "bg-stevie-chartreuse/20 text-yellow-800",
  completed: "bg-stevie-green/10 text-stevie-green",
  cancelled: "bg-stevie-orange/10 text-stevie-orange",
  rescheduled: "bg-stevie-lavender/20 text-purple-700",
  no_show: "bg-red-50 text-red-600",
};

const LEAD_STATUS_COLORS: Record<string, string> = {
  new: "bg-stevie-sky/10 text-stevie-sky",
  qualified: "bg-stevie-green/10 text-stevie-green",
  converted: "bg-stevie-lavender/20 text-purple-700",
  disqualified: "bg-gray-100 text-gray-500",
};

function formatDateTime(iso: string, tz?: string | null) {
  const d = new Date(iso);
  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
  };
  if (tz) {
    options.timeZone = tz;
    timeOptions.timeZone = tz;
  }
  return {
    date: d.toLocaleDateString("en-US", options),
    time: d.toLocaleTimeString("en-US", timeOptions),
    tzLabel: tz ?? undefined,
  };
}

function formatRelative(iso: string) {
  const d = new Date(iso).getTime();
  const delta = d - Date.now();
  const abs = Math.abs(delta);
  const mins = Math.round(abs / 60000);
  const hrs = Math.round(mins / 60);
  const days = Math.round(hrs / 24);
  const suffix = delta >= 0 ? "from now" : "ago";
  if (mins < 60) return `${mins}m ${suffix}`;
  if (hrs < 24) return `${hrs}h ${suffix}`;
  return `${days}d ${suffix}`;
}

type Toast = { id: number; kind: "success" | "error" | "info"; text: string };

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [leadFilter, setLeadFilter] = useState<"" | "with" | "without">("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: "20",
      });
      if (status) params.set("status", status);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (fromDate) params.set("from_date", new Date(fromDate).toISOString());
      if (toDate) {
        // Make toDate inclusive through end-of-day
        const d = new Date(toDate);
        d.setHours(23, 59, 59, 999);
        params.set("to_date", d.toISOString());
      }
      if (leadFilter === "with") params.set("has_lead", "true");
      if (leadFilter === "without") params.set("has_lead", "false");

      const data = await apiFetch<PaginatedResponse<Booking>>(
        `/api/bookings?${params.toString()}`
      );
      setBookings(data.items);
      setTotal(data.total);
      setPages(data.pages);
    } catch {
      setBookings([]);
      setTotal(0);
      setPages(0);
    } finally {
      setLoading(false);
    }
  }, [page, status, debouncedSearch, fromDate, toDate, leadFilter]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Realtime: refetch on any booking.* event
  const fetchRef = useRef(fetchBookings);
  fetchRef.current = fetchBookings;
  useRealtime({
    onAny: (evt) => {
      if (typeof evt.event === "string" && evt.event.startsWith("booking.")) {
        fetchRef.current();
        if (evt.event === "booking.created") {
          const p = evt.payload as Record<string, unknown> | undefined;
          const name =
            (p?.attendee_name as string | undefined) ??
            (p?.attendee_email as string | undefined) ??
            "new call";
          pushToast("info", `📞 New booking: ${name}`);
        }
      }
    },
  });

  const clearFilters = () => {
    setStatus("");
    setSearch("");
    setFromDate("");
    setToDate("");
    setLeadFilter("");
    setPage(1);
  };

  const filtersActive = useMemo(
    () =>
      !!(status || debouncedSearch || fromDate || toDate || leadFilter),
    [status, debouncedSearch, fromDate, toDate, leadFilter]
  );

  const updateBooking = async (id: string, patch: Partial<Booking>) => {
    try {
      const updated = await apiFetch<Booking>(`/api/bookings/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setBookings((list) =>
        list.map((b) => (b.id === id ? { ...b, ...updated } : b))
      );
      if (selected?.id === id) setSelected({ ...selected, ...updated });
      pushToast("success", "Booking updated");
      return updated;
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Could not update booking";
      pushToast("error", msg);
      throw err;
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="heading-brand text-3xl">Bookings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {total} total booking{total !== 1 ? "s" : ""} synced from Cal.com.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-border p-4 mb-4 space-y-3">
        <div className="flex gap-2 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setStatus(tab.value);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs rounded-full border whitespace-nowrap transition-colors ${
                status === tab.value
                  ? "border-stevie-green bg-stevie-green/5 text-stevie-green font-semibold"
                  : "border-border text-muted-foreground hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-2 lg:items-end">
          <div className="flex-1 min-w-0">
            <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              Attendee search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Name or email..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-stevie-green/30 focus:border-stevie-green"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              From
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-stevie-green/30"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              To
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-stevie-green/30"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              Lead linkage
            </label>
            <select
              value={leadFilter}
              onChange={(e) => {
                setLeadFilter(e.target.value as "" | "with" | "without");
                setPage(1);
              }}
              className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-stevie-green/30"
            >
              <option value="">Any</option>
              <option value="with">Linked to lead</option>
              <option value="without">No lead</option>
            </select>
          </div>
          {filtersActive && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-xs rounded-lg border border-border hover:bg-gray-50 text-muted-foreground"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Booking cards */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Loading bookings...
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center">
          <p className="text-muted-foreground text-sm">
            {filtersActive
              ? "No bookings match these filters."
              : "No bookings yet. They\u2019ll sync here automatically from Cal.com via webhook."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => {
            const { date, time, tzLabel } = formatDateTime(
              booking.scheduled_at,
              booking.timezone
            );
            const isFuture =
              new Date(booking.scheduled_at).getTime() > Date.now();
            return (
              <button
                key={booking.id}
                onClick={() => setSelected(booking)}
                className="w-full text-left bg-white rounded-2xl border border-border p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:shadow-sm hover:border-stevie-green/40 transition-shadow transition-colors"
              >
                {/* Date block */}
                <div className="flex items-center gap-3 sm:w-52 shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-stevie-green/10 flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-stevie-green" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{date}</p>
                    <p className="text-xs text-muted-foreground">
                      {time}
                      {tzLabel && (
                        <span className="ml-1 text-[10px] opacity-70">
                          {tzLabel}
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground opacity-70 mt-0.5">
                      {formatRelative(booking.scheduled_at)}
                    </p>
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 space-y-1 min-w-0">
                  {booking.attendee_name && (
                    <div className="flex items-center gap-2 text-sm min-w-0">
                      <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{booking.attendee_name}</span>
                      {booking.attendee_email && (
                        <span className="text-muted-foreground truncate">
                          ({booking.attendee_email})
                        </span>
                      )}
                    </div>
                  )}
                  {booking.event_type && (
                    <p className="text-xs text-muted-foreground">
                      {booking.event_type}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {booking.duration_minutes && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {booking.duration_minutes} min
                      </span>
                    )}
                    {booking.meeting_url && (
                      <span className="flex items-center gap-1 truncate max-w-[200px]">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">
                          {booking.meeting_url.startsWith("http")
                            ? new URL(booking.meeting_url).hostname
                            : booking.meeting_url}
                        </span>
                      </span>
                    )}
                    {booking.lead && (
                      <span className="flex items-center gap-1 text-stevie-green">
                        <UserCheck className="w-3 h-3" />
                        Lead linked
                      </span>
                    )}
                    {booking.reminder_sent_at && isFuture && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        Reminder sent
                      </span>
                    )}
                  </div>
                </div>

                {/* Status badge */}
                <span
                  className={`inline-block self-start sm:self-center px-2.5 py-1 rounded-full text-xs font-medium ${
                    STATUS_COLORS[booking.status] || "bg-gray-100 text-gray-600"
                  }`}
                >
                  {booking.status}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <span className="text-xs text-muted-foreground">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-border hover:bg-gray-100 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="p-1.5 rounded-lg border border-border hover:bg-gray-100 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <BookingDrawer
          booking={selected}
          onClose={() => setSelected(null)}
          onUpdate={updateBooking}
        />
      )}

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto text-sm px-3.5 py-2 rounded-xl shadow-lg border ${
              t.kind === "success"
                ? "bg-stevie-green/10 text-stevie-green border-stevie-green/30"
                : t.kind === "error"
                ? "bg-red-50 text-red-600 border-red-200"
                : "bg-stevie-sky/10 text-stevie-sky border-stevie-sky/30"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── Detail Drawer ───────────────────────── //

function BookingDrawer({
  booking,
  onClose,
  onUpdate,
}: {
  booking: Booking;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Booking>) => Promise<Booking>;
}) {
  const [notesDraft, setNotesDraft] = useState(booking.notes ?? "");
  const [saving, setSaving] = useState<string | null>(null);
  const dirty = notesDraft !== (booking.notes ?? "");

  useEffect(() => {
    setNotesDraft(booking.notes ?? "");
  }, [booking.id, booking.notes]);

  const { date, time, tzLabel } = formatDateTime(
    booking.scheduled_at,
    booking.timezone
  );
  const isFuture = new Date(booking.scheduled_at).getTime() > Date.now();

  const transition = async (status: string) => {
    setSaving(status);
    try {
      await onUpdate(booking.id, { status });
    } catch {
      // toast already shown
    } finally {
      setSaving(null);
    }
  };

  const saveNotes = async () => {
    setSaving("notes");
    try {
      await onUpdate(booking.id, { notes: notesDraft });
    } catch {
      /* noop */
    } finally {
      setSaving(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 bg-black/30 flex justify-end"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white h-full overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-border flex items-start justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-semibold">
              {booking.attendee_name || "Booking"}
            </h2>
            {booking.attendee_email && (
              <p className="text-xs text-muted-foreground">
                {booking.attendee_email}
              </p>
            )}
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Status + event */}
          <div className="flex items-center justify-between">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                STATUS_COLORS[booking.status] || "bg-gray-100 text-gray-600"
              }`}
            >
              {booking.status}
            </span>
            {booking.event_type && (
              <span className="text-xs text-muted-foreground">
                {booking.event_type}
              </span>
            )}
          </div>

          {/* Schedule */}
          <Field label="When">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span>
                {date} · {time}
                {tzLabel && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({tzLabel})
                  </span>
                )}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatRelative(booking.scheduled_at)}
            </p>
          </Field>

          {booking.duration_minutes && (
            <Field label="Duration">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                {booking.duration_minutes} minutes
              </div>
            </Field>
          )}

          {booking.meeting_url && (
            <Field label="Meeting link">
              {booking.meeting_url.startsWith("http") ? (
                <a
                  href={booking.meeting_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-stevie-sky hover:underline break-all"
                >
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  {booking.meeting_url}
                </a>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                  {booking.meeting_url}
                </div>
              )}
            </Field>
          )}

          {/* Lead linkage */}
          {booking.lead ? (
            <Field label="Linked lead">
              <a
                href={`/admin/leads?open=${booking.lead.id}`}
                className="block p-3 rounded-xl border border-stevie-green/40 bg-stevie-green/5 hover:bg-stevie-green/10 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {booking.lead.full_name || "Unnamed lead"}
                    </p>
                    {booking.lead.email && (
                      <p className="text-xs text-muted-foreground">
                        {booking.lead.email}
                      </p>
                    )}
                  </div>
                  {booking.lead.qualification_status && (
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase ${
                        LEAD_STATUS_COLORS[booking.lead.qualification_status] ||
                        "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {booking.lead.qualification_status}
                    </span>
                  )}
                </div>
              </a>
            </Field>
          ) : (
            <Field label="Lead linkage">
              <p className="text-xs text-muted-foreground italic">
                No lead linked (attendee email didn&#39;t match a known lead).
              </p>
            </Field>
          )}

          {/* Reminder status */}
          <Field label="Reminder email">
            {booking.reminder_sent_at ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Mail className="w-3 h-3 text-stevie-green" />
                Sent{" "}
                {new Date(booking.reminder_sent_at).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            ) : isFuture ? (
              <p className="text-xs text-muted-foreground italic">
                Not yet sent (fires 24h before scheduled time).
              </p>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                N/A — booking is in the past.
              </p>
            )}
          </Field>

          {/* Notes editor */}
          <Field label="Internal notes">
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={4}
              placeholder="Internal notes about this call..."
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-stevie-green/30 focus:border-stevie-green resize-y"
            />
            {dirty && (
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => setNotesDraft(booking.notes ?? "")}
                  className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-gray-50"
                >
                  Discard
                </button>
                <button
                  onClick={saveNotes}
                  disabled={saving === "notes"}
                  className="text-xs px-3 py-1.5 rounded-lg bg-stevie-green text-white hover:bg-stevie-green/90 disabled:opacity-60"
                >
                  {saving === "notes" ? "Saving..." : "Save notes"}
                </button>
              </div>
            )}
          </Field>

          {/* Actions */}
          <div className="border-t border-border pt-4 space-y-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
              Outcome
            </p>
            <div className="grid grid-cols-2 gap-2">
              <ActionButton
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                label="Mark complete"
                tone="green"
                disabled={
                  booking.status === "completed" || saving === "completed"
                }
                busy={saving === "completed"}
                onClick={() => transition("completed")}
              />
              <ActionButton
                icon={<XCircle className="w-3.5 h-3.5" />}
                label="Mark no-show"
                tone="amber"
                disabled={
                  booking.status === "no_show" || saving === "no_show"
                }
                busy={saving === "no_show"}
                onClick={() => transition("no_show")}
              />
              <ActionButton
                icon={<X className="w-3.5 h-3.5" />}
                label="Cancel booking"
                tone="red"
                disabled={
                  booking.status === "cancelled" || saving === "cancelled"
                }
                busy={saving === "cancelled"}
                onClick={() => {
                  if (
                    confirm(
                      "Cancel this booking? This only updates Stevie — it does not notify Cal.com."
                    )
                  )
                    transition("cancelled");
                }}
              />
              {(booking.status === "completed" ||
                booking.status === "no_show" ||
                booking.status === "cancelled") && (
                <ActionButton
                  icon={<Calendar className="w-3.5 h-3.5" />}
                  label="Reopen (confirmed)"
                  tone="sky"
                  disabled={saving === "confirmed"}
                  busy={saving === "confirmed"}
                  onClick={() => transition("confirmed")}
                />
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="text-[10px] text-muted-foreground space-y-0.5 border-t border-border pt-4">
            <p>
              Event ID ({booking.provider}):{" "}
              <span className="font-mono">{booking.external_event_id}</span>
            </p>
            <p>Created {new Date(booking.created_at).toLocaleString()}</p>
            <p>Updated {new Date(booking.updated_at).toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── Helpers ───────────────────────── //

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">
        {label}
      </p>
      {children}
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  tone,
  disabled,
  busy,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone: "green" | "amber" | "red" | "sky";
  disabled?: boolean;
  busy?: boolean;
}) {
  const colors = {
    green:
      "border-stevie-green/30 text-stevie-green hover:bg-stevie-green/5",
    amber:
      "border-stevie-chartreuse/50 text-yellow-800 hover:bg-stevie-chartreuse/10",
    red: "border-red-200 text-red-600 hover:bg-red-50",
    sky: "border-stevie-sky/30 text-stevie-sky hover:bg-stevie-sky/5",
  }[tone];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-xs px-3 py-2 rounded-lg border flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${colors}`}
    >
      {icon}
      {busy ? "..." : label}
    </button>
  );
}
