"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup" | "magic_link" | "forgot";

export default function LoginForm() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const supabase = createClient();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        window.location.href = "/admin";
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        setMessage({
          type: "success",
          text: "Check your email to confirm your account.",
        });
      } else if (mode === "magic_link") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        setMessage({
          type: "success",
          text: "Check your email for the login link.",
        });
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
        });
        if (error) throw error;
        setMessage({
          type: "success",
          text: "Check your email for the password reset link.",
        });
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setMessage({ type: "error", text: error.message });
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-7">
      {/* Google OAuth */}
      <button
        onClick={handleGoogleLogin}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-border rounded-full text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-60"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Continue with Google
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "signup" && (
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium mb-1.5">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-stevie-green/30 focus:border-stevie-green transition-colors"
              placeholder="Jane Smith"
            />
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1.5">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-stevie-green/30 focus:border-stevie-green transition-colors"
            placeholder="you@company.com"
          />
        </div>

        {(mode === "signin" || mode === "signup") && (
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-stevie-green/30 focus:border-stevie-green transition-colors"
              placeholder="••••••••"
            />
          </div>
        )}

        {/* Message */}
        {message && (
          <div
            className={`p-3 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-stevie-green/5 border border-stevie-green/20 text-stevie-green"
                : "bg-stevie-orange/5 border border-stevie-orange/20 text-stevie-orange"
            }`}
          >
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-stevie-green text-white text-sm font-semibold rounded-full hover:bg-stevie-green-light transition-colors disabled:opacity-60"
        >
          {loading
            ? "Loading..."
            : mode === "signin"
            ? "Sign In"
            : mode === "signup"
            ? "Create Account"
            : mode === "magic_link"
            ? "Send Magic Link"
            : "Send Reset Link"}
        </button>
      </form>

      {/* Mode switches */}
      <div className="mt-4 space-y-2 text-center text-sm">
        {mode === "signin" && (
          <>
            <button
              onClick={() => { setMode("magic_link"); setMessage(null); }}
              className="block w-full text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in with magic link instead
            </button>
            <button
              onClick={() => { setMode("forgot"); setMessage(null); }}
              className="block w-full text-muted-foreground hover:text-foreground transition-colors"
            >
              Forgot password?
            </button>
            <div className="pt-2 border-t border-border mt-3">
              <span className="text-muted-foreground">No account? </span>
              <button
                onClick={() => { setMode("signup"); setMessage(null); }}
                className="text-stevie-green font-semibold hover:opacity-80 transition-opacity"
              >
                Sign up
              </button>
            </div>
          </>
        )}
        {mode === "signup" && (
          <div>
            <span className="text-muted-foreground">Already have an account? </span>
            <button
              onClick={() => { setMode("signin"); setMessage(null); }}
              className="text-stevie-green font-semibold hover:opacity-80 transition-opacity"
            >
              Sign in
            </button>
          </div>
        )}
        {(mode === "magic_link" || mode === "forgot") && (
          <button
            onClick={() => { setMode("signin"); setMessage(null); }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to sign in
          </button>
        )}
      </div>
    </div>
  );
}
