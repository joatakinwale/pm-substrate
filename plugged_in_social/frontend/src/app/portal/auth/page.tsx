"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { authenticatePortalToken } from "@/lib/portal-api";

function PortalAuthInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("No authentication token provided. Please use the link from your email.");
      return;
    }

    authenticatePortalToken(token)
      .then(() => {
        setStatus("success");
        setTimeout(() => router.push("/portal"), 1500);
      })
      .catch((err) => {
        setStatus("error");
        setError(err.message || "Authentication failed. The link may have expired.");
      });
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl border border-border p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <span className="font-[family-name:var(--font-margo)] text-2xl tracking-tight">
            Stevie Social
          </span>
          <p className="text-sm text-muted-foreground mt-1">Client Portal</p>
        </div>

        {status === "loading" && (
          <div className="space-y-4">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-stevie-sky" />
            <p className="text-sm text-muted-foreground">Verifying your access...</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <CheckCircle2 className="w-8 h-8 mx-auto text-stevie-green" />
            <p className="text-sm font-medium">You're in! Redirecting to your portal...</p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <AlertCircle className="w-8 h-8 mx-auto text-stevie-orange" />
            <p className="text-sm text-red-600">{error}</p>
            <p className="text-xs text-muted-foreground">
              If this keeps happening, contact your agency representative.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function PortalAuthFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl border border-border p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <span className="font-[family-name:var(--font-margo)] text-2xl tracking-tight">
            Stevie Social
          </span>
          <p className="text-sm text-muted-foreground mt-1">Client Portal</p>
        </div>
        <div className="space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-stevie-sky" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    </div>
  );
}

export default function PortalAuthPage() {
  return (
    <Suspense fallback={<PortalAuthFallback />}>
      <PortalAuthInner />
    </Suspense>
  );
}
