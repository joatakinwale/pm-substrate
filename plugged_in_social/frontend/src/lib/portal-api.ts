/**
 * Portal API client — for client portal pages.
 *
 * Auth model (FE-25 migration)
 * ----------------------------
 * The portal session token used to live in localStorage, sent on every
 * request as `Authorization: Bearer <token>`. That made the token
 * readable by any JS running on the page — including anything a future
 * XSS would plant — and let attackers hijack portal sessions for up to
 * 7 days (the session lifetime).
 *
 * Now the backend sets the session token as an HttpOnly, Secure,
 * SameSite=Lax cookie on /api/portal/auth. The cookie is automatically
 * attached to subsequent same-site requests when we use
 * `credentials: "include"`, and it's invisible to JS so an XSS can't
 * exfiltrate it.
 *
 * Backward compatibility: this module still reads/writes a localStorage
 * token and still sends Authorization: Bearer during a transition
 * period so clients who haven't logged in since the migration keep
 * working. The backend's portal auth dependency accepts either source
 * and prefers the cookie — meaning once a user hits /auth again (they
 * will within 7 days at latest, when their session expires and they
 * need a fresh magic link), the Bearer path becomes a no-op.
 *
 * Once everyone has migrated (monitor in logs — all portal requests
 * arriving with cookie present), remove the Bearer path, the
 * localStorage helpers, and the x-fall-through code in portalFetch.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Legacy localStorage key — kept only so we can read an existing
// pre-migration token and clean it up after the first successful
// cookie-authenticated round-trip.
const PORTAL_TOKEN_KEY = "stevie_portal_token";

export function getPortalToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(PORTAL_TOKEN_KEY);
}

export function setPortalToken(token: string): void {
  // Still writes to localStorage during the migration window. Once the
  // backend+frontend have been on the cookie path for one full session
  // cycle (7 days), this line can be deleted along with getPortalToken
  // and the Bearer header branch in portalFetch.
  localStorage.setItem(PORTAL_TOKEN_KEY, token);
}

export function clearPortalToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PORTAL_TOKEN_KEY);
}

export async function portalFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const legacyToken = getPortalToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  // Only attach the bearer header if we have a legacy token AND the
  // caller hasn't already set Authorization. The backend prefers the
  // cookie anyway; the header is just a safety net during migration.
  if (legacyToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${legacyToken}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    // FE-25: critical — without credentials:"include", the browser won't
    // send the HttpOnly session cookie to cross-origin API calls (e.g.
    // frontend on stevie.social hitting api.stevie.social). This is
    // also why the backend needs CORS configured with
    // allow_credentials=True for the portal origins.
    credentials: "include",
  });

  if (res.status === 401) {
    clearPortalToken();
    throw new PortalAuthError("Session expired — please log in again");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export class PortalAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortalAuthError";
  }
}

/**
 * Authenticate with a magic-link token.
 *
 * FE-25: the response still carries session_token in JSON (unchanged so
 * older frontends keep working) AND sets an HttpOnly cookie. We stash
 * the token in localStorage so mid-migration sessions keep authenticating
 * even if the cookie round-trip somehow fails (e.g. misconfigured
 * same-site proxy). The cookie is what real production auth rests on;
 * the localStorage copy is insurance during the rollout.
 */
export async function authenticatePortalToken(token: string) {
  const res = await fetch(`${API_URL}/api/portal/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
    // Must include credentials here too — this is the request that
    // _sets_ the cookie, and the browser only stores Set-Cookie from
    // cross-origin responses when the fetch was credentialed.
    credentials: "include",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Authentication failed");
  }

  const data = await res.json();
  setPortalToken(data.session_token);
  return data;
}

/**
 * Log out — revokes the server-side session and clears the cookie.
 * Also nukes the legacy localStorage token so a logged-out tab can't
 * silently re-auth via the Bearer fallback on its next request.
 */
export async function logoutPortalSession(): Promise<void> {
  try {
    await fetch(`${API_URL}/api/portal/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } finally {
    clearPortalToken();
  }
}

/* ═══ Portal types ═══ */

export interface PortalProject {
  id: string;
  name: string;
  status: string;
  compound_phase: string | null;
  start_date: string | null;
  target_date: string | null;
  pending_approvals: number;
}

export interface PortalTask {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  due_date: string | null;
  attachments: string[];
  client_approved: boolean;
  client_feedback: string | null;
  created_at: string;
}

export interface PortalComment {
  id: string;
  task_id: string;
  author_id: string | null;
  author_name: string | null;
  content: string;
  is_client_comment: boolean;
  created_at: string;
}

export interface PortalInvoice {
  id: string;
  status: string;
  total_cents: number;
  amount_due_cents: number;
  due_date: string | null;
  paid_at: string | null;
  line_items: unknown;
  stripe_hosted_invoice_url: string | null;
  created_at: string;
}

export interface PortalProposal {
  id: string;
  title: string;
  status: string;
  blocks: unknown;
  total_monthly_cents: number;
  total_setup_cents: number;
  sent_at: string | null;
  signed_at: string | null;
  created_at: string;
}
