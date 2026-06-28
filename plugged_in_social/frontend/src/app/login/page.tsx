import type { Metadata } from "next";
import LoginForm from "@/components/LoginForm";

// FE-22: title drops the redundant " | Stevie Social" (root template adds
// it). robots: noindex because /login is also Disallow'd in robots.ts — the
// meta tag is defense-in-depth for crawlers that ignore robots.txt.
export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Stevie Social dashboard.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-foreground">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <a href="/" className="inline-block font-margo">
            <span className="text-3xl tracking-tight text-white">
              stevie<span className="text-stevie-green">social</span>
            </span>
          </a>
          <p className="text-sm text-white/50 mt-3">
            Sign in to your dashboard
          </p>
        </div>

        <LoginForm />

        <p className="text-center text-xs text-white/40 mt-8">
          <a href="/" className="hover:text-white transition-colors">
            &larr; Back to stevie.social
          </a>
        </p>
      </div>
    </div>
  );
}
