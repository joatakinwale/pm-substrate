"use client";

import { useState, useCallback } from "react";

const API_URL =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL || ""
    : "";

// ── Types ──────────────────────────────────────────────────

interface Slot {
  start: string;
  end: string;
}

type Step = "pick-date" | "pick-time" | "fill-form" | "confirmed";

interface BookingWidgetProps {
  orgSlug: string;
  profileSlug: string;
  durationMinutes: number;
  orgName: string;
  profileName: string;
}

// ── Helpers ────────────────────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

/** Return an array of the next N calendar days starting from today. */
function nextDays(n: number): Date[] {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// ── BookingWidget ──────────────────────────────────────────

export default function BookingWidget({
  orgSlug,
  profileSlug,
  durationMinutes,
  orgName,
  profileName,
}: BookingWidgetProps) {
  const [step, setStep] = useState<Step>("pick-date");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    rescheduleToken: string | null;
    meetingUrl: string | null;
  } | null>(null);

  const days = nextDays(14); // show a 2-week window

  const fetchSlots = useCallback(
    async (day: Date) => {
      setLoadingSlots(true);
      setSlotsError(null);
      setSlots([]);
      const start = new Date(day);
      start.setHours(0, 0, 0, 0);
      const end = new Date(day);
      end.setHours(23, 59, 59, 999);

      try {
        const res = await fetch(
          `${API_URL}/api/public/booking/${orgSlug}/${profileSlug}/slots` +
            `?start=${encodeURIComponent(start.toISOString())}` +
            `&end=${encodeURIComponent(end.toISOString())}`,
        );
        if (!res.ok) {
          throw new Error(`Slots fetch failed (${res.status})`);
        }
        const data = await res.json();
        // Aurinko returns { availableSlots: [{start, end}, ...] } or similar
        const available: Slot[] =
          Array.isArray(data.availableSlots)
            ? data.availableSlots
            : Array.isArray(data)
              ? data
              : [];
        setSlots(available);
      } catch (err) {
        setSlotsError(
          err instanceof Error ? err.message : "Could not load available times.",
        );
      } finally {
        setLoadingSlots(false);
      }
    },
    [orgSlug, profileSlug],
  );

  const handleDaySelect = useCallback(
    (day: Date) => {
      setSelectedDay(day);
      setSelectedSlot(null);
      setStep("pick-time");
      void fetchSlots(day);
    },
    [fetchSlots],
  );

  const handleSlotSelect = (slot: Slot) => {
    setSelectedSlot(slot);
    setStep("fill-form");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(
        `${API_URL}/api/public/booking/${orgSlug}/${profileSlug}/book`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            when_start: selectedSlot.start,
            when_end: selectedSlot.end,
            name,
            email,
            comments: comments || undefined,
          }),
        },
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          (errData as { detail?: string }).detail || `Booking failed (${res.status})`,
        );
      }
      const data = await res.json();
      setConfirmation({
        rescheduleToken: data.rescheduleToken ?? null,
        meetingUrl: data.meetingUrl ?? null,
      });
      setStep("confirmed");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Booking failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────

  if (step === "confirmed" && confirmation) {
    return (
      <div className="border border-border rounded-2xl bg-white shadow-sm p-10 text-center max-w-xl mx-auto">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-stevie-green/10 mb-6">
          <svg
            className="w-8 h-8 text-stevie-green"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2 className="font-margo text-2xl mb-3">You&apos;re booked!</h2>
        <p className="text-muted-foreground mb-2 max-w-md mx-auto">
          Your {durationMinutes}-minute call with {orgName} is confirmed.
          {selectedSlot && (
            <>
              {" "}
              <strong>
                {formatDate(new Date(selectedSlot.start))} at{" "}
                {formatTime(selectedSlot.start)}
              </strong>
            </>
          )}
          .
        </p>
        <p className="text-sm text-muted-foreground">
          A confirmation email is on its way to <strong>{email}</strong>.
        </p>
        {confirmation.meetingUrl && (
          <a
            href={confirmation.meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center justify-center px-6 py-3 rounded-full bg-stevie-green text-white text-sm font-semibold hover:bg-stevie-green-light transition-colors"
          >
            Join Meeting ↗
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="border border-border rounded-2xl bg-white shadow-sm overflow-hidden">
      {/* Step header */}
      <div className="bg-muted/30 border-b border-border px-6 py-4 flex items-center gap-3">
        {step !== "pick-date" && (
          <button
            onClick={() => {
              if (step === "pick-time") setStep("pick-date");
              if (step === "fill-form") setStep("pick-time");
            }}
            className="text-muted-foreground hover:text-foreground transition-colors text-sm"
            aria-label="Go back"
          >
            ← Back
          </button>
        )}
        <span className="text-sm font-medium text-muted-foreground">
          {step === "pick-date" && "Select a date"}
          {step === "pick-time" &&
            selectedDay &&
            `Available times — ${formatDate(selectedDay)}`}
          {step === "fill-form" &&
            selectedSlot &&
            `${formatDate(new Date(selectedSlot.start))} at ${formatTime(selectedSlot.start)}`}
        </span>
      </div>

      <div className="p-6">
        {/* Step 1: date grid */}
        {step === "pick-date" && (
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              {profileName} &mdash; {durationMinutes} min
            </p>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {days.map((day) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isPast = day < today;
                return (
                  <button
                    key={isoDate(day)}
                    disabled={isPast}
                    onClick={() => handleDaySelect(day)}
                    className={`flex flex-col items-center py-3 px-1 rounded-xl border text-sm font-medium transition-colors
                      ${isPast ? "opacity-30 cursor-not-allowed border-border" : "border-border hover:border-stevie-green hover:text-stevie-green cursor-pointer"}`}
                  >
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {day.toLocaleDateString([], { weekday: "short" })}
                    </span>
                    <span className="text-base mt-0.5">{day.getDate()}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {day.toLocaleDateString([], { month: "short" })}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: time slots */}
        {step === "pick-time" && (
          <div>
            {loadingSlots && (
              <p className="text-sm text-muted-foreground">
                Loading available times…
              </p>
            )}
            {slotsError && (
              <p className="text-sm text-destructive">{slotsError}</p>
            )}
            {!loadingSlots && !slotsError && slots.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  No availability on this day.
                </p>
                <button
                  onClick={() => setStep("pick-date")}
                  className="text-sm text-stevie-green hover:underline"
                >
                  Choose another date
                </button>
              </div>
            )}
            {!loadingSlots && slots.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.start}
                    onClick={() => handleSlotSelect(slot)}
                    className="py-3 px-4 rounded-xl border border-border text-sm font-medium hover:border-stevie-green hover:text-stevie-green transition-colors"
                  >
                    {formatTime(slot.start)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: contact form */}
        {step === "fill-form" && selectedSlot && (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Fill in your details to confirm the booking.
            </p>

            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="book-name">
                Your name
              </label>
              <input
                id="book-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="book-email">
                Email address
              </label>
              <input
                id="book-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="book-comments">
                Additional notes{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <textarea
                id="book-comments"
                rows={3}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Tell us a bit about your brand and goals…"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30 resize-none"
              />
            </div>

            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-full bg-stevie-green text-white text-sm font-semibold hover:bg-stevie-green-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Confirming…" : "Confirm booking"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
