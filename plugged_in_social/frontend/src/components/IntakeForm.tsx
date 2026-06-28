"use client";

import { useState, type FormEvent } from "react";

/**
 * Multi-step intake form replacing the Typeform at form.typeform.com/to/boBuNh98
 *
 * Collects lead qualification data for Stevie Social:
 *   Step 1: Contact info (name, email, company)
 *   Step 2: Brand details (website, revenue range, current challenges)
 *   Step 3: Goals & timeline
 *
 * Submits to /api/leads endpoint on the FastAPI backend.
 * In Phase 1, this is a pure client-side form. SurveyJS can be
 * added later for more complex conditional logic.
 */

const REVENUE_RANGES = [
  { value: "under_100k", label: "Under $100K" },
  { value: "100k_500k", label: "$100K – $500K" },
  { value: "500k_1m", label: "$500K – $1M" },
  { value: "1m_5m", label: "$1M – $5M" },
  { value: "5m_plus", label: "$5M+" },
];

const CHALLENGES = [
  "Inconsistent posting",
  "Low engagement",
  "No clear strategy",
  "Content quality",
  "Measuring ROI",
  "Growing audience",
  "Brand voice",
  "Other",
];

const GOALS = [
  "Increase brand awareness",
  "Generate leads",
  "Grow social following",
  "Improve engagement",
  "Launch new product/service",
  "Build thought leadership",
  "Other",
];

type FormData = {
  full_name: string;
  email: string;
  company: string;
  phone: string;
  website: string;
  revenue_range: string;
  challenges: string[];
  goals: string[];
  timeline: string;
  how_heard: string;
  additional_notes: string;
};

const initialData: FormData = {
  full_name: "",
  email: "",
  company: "",
  phone: "",
  website: "",
  revenue_range: "",
  challenges: [],
  goals: [],
  timeline: "",
  how_heard: "",
  additional_notes: "",
};

export default function IntakeForm() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<FormData>(initialData);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalSteps = 3;

  function updateField(field: keyof FormData, value: string | string[]) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function toggleArrayField(field: "challenges" | "goals", value: string) {
    setData((prev) => {
      const arr = prev[field];
      return {
        ...prev,
        [field]: arr.includes(value)
          ? arr.filter((v) => v !== value)
          : [...arr, value],
      };
    });
  }

  function canAdvance(): boolean {
    if (step === 1) {
      return !!(data.full_name && data.email && data.company);
    }
    if (step === 2) {
      return !!(data.revenue_range);
    }
    return true;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const orgSlug = process.env.NEXT_PUBLIC_ORG_SLUG || "stevie-social";

    // Get UTM params from URL
    const params = new URLSearchParams(window.location.search);

    const payload = {
      full_name: data.full_name,
      email: data.email,
      company: data.company,
      phone: data.phone || undefined,
      website: data.website || undefined,
      revenue_range: data.revenue_range,
      source: "website_intake",
      utm_source: params.get("utm_source") || undefined,
      utm_medium: params.get("utm_medium") || undefined,
      utm_campaign: params.get("utm_campaign") || undefined,
      form_responses: {
        challenges: data.challenges,
        goals: data.goals,
        timeline: data.timeline,
        how_heard: data.how_heard,
        additional_notes: data.additional_notes,
      },
    };

    try {
      // Use the public endpoint — no auth required, org identified by slug
      const res = await fetch(`${apiUrl}/api/leads/public?org_slug=${orgSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || "Failed to submit form");
      }

      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-stevie-green/10 mb-6">
          <svg className="w-8 h-8 text-stevie-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="heading-brand text-3xl mb-3">You&apos;re all set!</h2>
        <p className="text-muted-foreground max-w-md mx-auto mb-6">
          We&apos;ve received your info and will review it before your call.
          If you haven&apos;t booked a strategy call yet, do that next.
        </p>
        <a
          href="/book"
          className="inline-flex items-center gap-2 bg-stevie-green text-white px-6 py-3 rounded-full font-semibold hover:bg-stevie-green-light transition-colors"
        >
          Book a strategy call
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-8">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div key={i} className="flex-1 h-1.5 rounded-full overflow-hidden bg-gray-100">
            <div
              className="h-full bg-stevie-green rounded-full transition-all duration-300"
              style={{ width: step > i ? "100%" : "0%" }}
            />
          </div>
        ))}
        <span className="text-sm text-muted-foreground ml-2">
          {step}/{totalSteps}
        </span>
      </div>

      {/* Step 1: About you — FE-15: the page hero says "Tell us about your
          brand" but step 1 collects personal contact info. "About you" reads
          as an honest description of what we're asking in this step, and makes
          the brand-level questions in step 2 feel like a natural progression
          rather than a bait-and-switch after a brand-framed hero. */}
      {step === 1 && (
        <div className="space-y-5">
          <h2 className="heading-brand text-2xl mb-1">About you</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Where should we send call details and the follow-up?
          </p>

          <div>
            <label htmlFor="full_name" className="block text-sm font-medium mb-1.5">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              id="full_name"
              type="text"
              required
              value={data.full_name}
              onChange={(e) => updateField("full_name", e.target.value)}
              className="w-full px-4 py-2.5 border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stevie-green/30 focus:border-stevie-green transition-colors"
              placeholder="Jane Smith"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1.5">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              required
              value={data.email}
              onChange={(e) => updateField("email", e.target.value)}
              className="w-full px-4 py-2.5 border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stevie-green/30 focus:border-stevie-green transition-colors"
              placeholder="jane@company.com"
            />
          </div>

          <div>
            <label htmlFor="company" className="block text-sm font-medium mb-1.5">
              Company / Brand <span className="text-red-500">*</span>
            </label>
            <input
              id="company"
              type="text"
              required
              value={data.company}
              onChange={(e) => updateField("company", e.target.value)}
              className="w-full px-4 py-2.5 border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stevie-green/30 focus:border-stevie-green transition-colors"
              placeholder="Acme Corp"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium mb-1.5">
              Phone <span className="text-muted-foreground text-xs">(optional)</span>
            </label>
            <input
              id="phone"
              type="tel"
              value={data.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              className="w-full px-4 py-2.5 border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stevie-green/30 focus:border-stevie-green transition-colors"
              placeholder="(555) 123-4567"
            />
          </div>
        </div>
      )}

      {/* Step 2: Brand Details */}
      {step === 2 && (
        <div className="space-y-5">
          <h2 className="heading-brand text-2xl mb-1">About Your Brand</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Help us understand where you are today.
          </p>

          <div>
            <label htmlFor="website" className="block text-sm font-medium mb-1.5">
              Website
            </label>
            <input
              id="website"
              type="url"
              value={data.website}
              onChange={(e) => updateField("website", e.target.value)}
              className="w-full px-4 py-2.5 border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stevie-green/30 focus:border-stevie-green transition-colors"
              placeholder="https://yourcompany.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Annual Revenue <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {REVENUE_RANGES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => updateField("revenue_range", r.value)}
                  className={`px-3 py-2.5 text-sm rounded-lg border transition-colors ${
                    data.revenue_range === r.value
                      ? "border-stevie-green bg-stevie-green/5 text-stevie-green font-medium"
                      : "border-border hover:border-gray-300"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Current Challenges <span className="text-muted-foreground text-xs">(select all that apply)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {CHALLENGES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleArrayField("challenges", c)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    data.challenges.includes(c)
                      ? "border-stevie-green bg-stevie-green/5 text-stevie-green font-medium"
                      : "border-border hover:border-gray-300"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Goals & Timeline */}
      {step === 3 && (
        <div className="space-y-5">
          <h2 className="heading-brand text-2xl mb-1">Goals & Timeline</h2>
          <p className="text-sm text-muted-foreground mb-6">
            What does success look like for you?
          </p>

          <div>
            <label className="block text-sm font-medium mb-2">
              Primary Goals <span className="text-muted-foreground text-xs">(select all that apply)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleArrayField("goals", g)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    data.goals.includes(g)
                      ? "border-stevie-green bg-stevie-green/5 text-stevie-green font-medium"
                      : "border-border hover:border-gray-300"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              When are you looking to start?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {["ASAP", "Within 1 month", "1-3 months", "Just exploring"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => updateField("timeline", t)}
                  className={`px-3 py-2.5 text-sm rounded-lg border transition-colors ${
                    data.timeline === t
                      ? "border-stevie-green bg-stevie-green/5 text-stevie-green font-medium"
                      : "border-border hover:border-gray-300"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="how_heard" className="block text-sm font-medium mb-1.5">
              How did you hear about us?
            </label>
            <input
              id="how_heard"
              type="text"
              value={data.how_heard}
              onChange={(e) => updateField("how_heard", e.target.value)}
              className="w-full px-4 py-2.5 border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stevie-green/30 focus:border-stevie-green transition-colors"
              placeholder="Instagram, referral, Google..."
            />
          </div>

          <div>
            <label htmlFor="additional_notes" className="block text-sm font-medium mb-1.5">
              Anything else we should know?
            </label>
            <textarea
              id="additional_notes"
              rows={3}
              value={data.additional_notes}
              onChange={(e) => updateField("additional_notes", e.target.value)}
              className="w-full px-4 py-2.5 border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stevie-green/30 focus:border-stevie-green transition-colors resize-none"
              placeholder="Current tools, upcoming launches, specific pain points..."
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="inline-flex items-center min-h-[44px] px-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Back
          </button>
        ) : (
          <div />
        )}

        {step < totalSteps ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance()}
            className="px-6 py-3 bg-stevie-green text-white text-sm font-semibold rounded-full hover:bg-stevie-green-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        ) : (
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 bg-stevie-green text-white text-sm font-semibold rounded-full hover:bg-stevie-green-light transition-colors disabled:opacity-60"
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        )}
      </div>
    </form>
  );
}
