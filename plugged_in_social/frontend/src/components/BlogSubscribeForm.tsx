"use client";

import { useId, useState, type FormEvent } from "react";
import { Loader2, MailCheck, Send } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type SubmitState = "idle" | "submitting" | "success" | "error";

export default function BlogSubscribeForm({ orgSlug }: { orgSlug: string }) {
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setState("error");
      setError("Enter a valid email address.");
      return;
    }

    setState("submitting");
    try {
      const response = await fetch(`${API_URL}/api/blog/public/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_slug: orgSlug,
          email: normalizedEmail,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || `Signup failed (${response.status})`);
      }

      setState("success");
      setEmail("");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Could not join the list.");
    }
  }

  if (state === "success") {
    return (
      <div className="inline-flex min-h-[48px] items-center gap-2 rounded-full border border-stevie-green/25 bg-stevie-green/5 px-5 py-3 text-sm font-semibold text-stevie-green">
        <MailCheck className="h-4 w-4" />
        You&apos;re on the list.
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md"
      aria-describedby={error ? `${emailId}-error` : undefined}
    >
      <label htmlFor={emailId} className="sr-only">
        Email address
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={emailId}
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          maxLength={320}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          disabled={state === "submitting"}
          className="min-h-[48px] flex-1 rounded-full border border-border bg-white px-5 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-stevie-green focus:ring-2 focus:ring-stevie-green/20 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={state === "submitting"}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-stevie-green px-6 text-sm font-semibold text-white transition-colors hover:bg-stevie-green-light disabled:opacity-60"
        >
          {state === "submitting" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Notify me
        </button>
      </div>
      {error && (
        <p id={`${emailId}-error`} className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}
