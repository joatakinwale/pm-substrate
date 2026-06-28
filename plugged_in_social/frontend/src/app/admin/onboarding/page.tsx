"use client";

/**
 * First-time invitee onboarding — set password, confirm, land in admin.
 *
 * Reached via the /auth/callback?type=invite redirect after Supabase
 * exchanges the invite magic-link for a session. The user at this point:
 *   • has a Supabase session (so they're logged in)
 *   • has app_metadata.{org_id,role} set by the backend invite flow
 *   • has NOT yet set a password — their auth.users.encrypted_password
 *     is empty until updateUser() writes one here
 *
 * This page is deliberately minimal: one decision (password), one button,
 * no sidebar clutter. The parent admin/layout.tsx wraps it in the usual
 * chrome, which is fine — it means the moment they finish they're already
 * at home and the sidebar doesn't feel like a jumpscare.
 */

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function AdminOnboardingPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Pull the Supabase session so we can greet the invitee by name and
  // show which email they're setting a password for.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data.user) {
        // No session = the invite link either expired or this page was
        // opened directly. Kick back to login rather than showing a
        // password form that will silently fail.
        router.replace("/login?error=invite_expired");
        return;
      }
      setEmail(data.user.email ?? "");
      const meta = data.user.user_metadata ?? {};
      setFullName(meta.full_name ?? meta.name ?? "");
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateErr } = await supabase.auth.updateUser({
        password,
      });
      if (updateErr) throw updateErr;

      setDone(true);
      // Short celebration beat, then drop them in.
      setTimeout(() => {
        router.push("/admin");
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't set your password.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <div className="w-14 h-14 rounded-full bg-stevie-green/10 text-stevie-green flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <h1 className="heading-brand text-2xl mb-2">You&apos;re in.</h1>
        <p className="text-muted-foreground">
          Taking you to the dashboard&hellip;
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-stevie-green/10 text-stevie-green flex items-center justify-center">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h1 className="heading-brand text-2xl">
            Welcome{fullName ? `, ${fullName.split(" ")[0]}` : ""}.
          </h1>
          <p className="text-sm text-muted-foreground">
            One quick step and you&apos;re in.
          </p>
        </div>
      </div>

      <section className="bg-white rounded-2xl border border-border p-6">
        <h2 className="font-semibold text-lg mb-1">Set your password</h2>
        <p className="text-sm text-muted-foreground mb-5">
          You&apos;ll use this with{" "}
          <span className="font-medium text-foreground">{email || "your email"}</span>{" "}
          next time you sign in.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1.5"
            >
              New password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30 focus:border-stevie-green transition-colors"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label
              htmlFor="confirm"
              className="block text-sm font-medium mb-1.5"
            >
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30 focus:border-stevie-green transition-colors"
              placeholder="Retype to confirm"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg text-sm bg-stevie-orange/5 border border-stevie-orange/20 text-stevie-orange">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password || !confirm}
            className="w-full px-5 py-2.5 bg-stevie-green text-white text-sm font-semibold rounded-full hover:bg-stevie-green-light transition-colors disabled:opacity-60"
          >
            {loading ? "Setting password…" : "Finish setup"}
          </button>
        </form>
      </section>
    </div>
  );
}
