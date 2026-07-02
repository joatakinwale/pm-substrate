/**
 * Authenticated API client for Stevie Social backend.
 *
 * Uses the Supabase access token from the browser session
 * to make authorized requests to the FastAPI backend.
 */

import {
  createClient,
  hasSupabaseBrowserConfig,
} from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Make an authenticated fetch to the backend API.
 * Automatically attaches the Supabase JWT as a Bearer token.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  let accessToken: string | undefined;
  if (hasSupabaseBrowserConfig()) {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    accessToken = session?.access_token;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  } else if (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_LOCAL_API_BEARER_TOKEN
  ) {
    headers["Authorization"] =
      `Bearer ${process.env.NEXT_PUBLIC_LOCAL_API_BEARER_TOKEN}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail: unknown = body?.detail;

    // Structured optimistic-locking conflict — see backend
    // app/schemas/common.py::version_conflict(). We promote this to a
    // ConflictError so callers can open a merge UI instead of a toast.
    if (
      res.status === 409 &&
      detail &&
      typeof detail === "object" &&
      (detail as { code?: string }).code === "version_conflict"
    ) {
      const d = detail as {
        code: "version_conflict";
        resource: string;
        message: string;
        current_version: number;
        attempted_version: number;
        current: Record<string, unknown>;
      };
      throw new ConflictError({
        resource: d.resource,
        message: d.message,
        currentVersion: d.current_version,
        attemptedVersion: d.attempted_version,
        current: d.current,
      });
    }

    // Detail can legally be a string OR a plain object (FastAPI
    // serializes dict-valued details verbatim). Normalize to a string
    // for ApiError.message but keep the raw body on .body for callers
    // that want to inspect it.
    const message =
      typeof detail === "string"
        ? detail
        : detail && typeof detail === "object"
          ? (detail as { message?: string }).message ||
            JSON.stringify(detail)
          : `Request failed (${res.status})`;
    throw new ApiError(res.status, message, body);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json();
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Thrown on 409 responses with a `version_conflict` detail payload —
 * i.e. the server-side row is ahead of the version the client submitted
 * on an optimistic-locking PATCH. Consumers should catch this, show the
 * user the live server state, and let them choose how to resolve.
 */
export class ConflictError extends ApiError {
  resource: string;
  currentVersion: number;
  attemptedVersion: number;
  current: Record<string, unknown>;

  constructor(params: {
    resource: string;
    message: string;
    currentVersion: number;
    attemptedVersion: number;
    current: Record<string, unknown>;
  }) {
    super(409, params.message);
    this.name = "ConflictError";
    this.resource = params.resource;
    this.currentVersion = params.currentVersion;
    this.attemptedVersion = params.attemptedVersion;
    this.current = params.current;
  }
}

/* ═══ Blog + Pages types ═══ */

export interface BlogPost {
  id: string;
  org_id: string;
  slug: string;
  title: string;
  body: string | null;
  excerpt: string | null;
  category: string | null;
  tags: string[];
  cover_image_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  status: string;
  published_at: string | null;
  scheduled_for: string | null;
  author_id: string | null;
  version: number;
  is_deleted: boolean;
  reading_time_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export interface SitePage {
  id: string;
  org_id: string;
  slug: string;
  title: string;
  content: Record<string, unknown> | unknown[];
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  status: string;
  version: number;
  is_deleted: boolean;
  last_edited_by: string | null;
  created_at: string;
  updated_at: string;
}

/* ═══ Type definitions matching backend schemas ═══ */

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface Lead {
  id: string;
  org_id: string;
  email: string;
  full_name: string;
  company: string | null;
  phone: string | null;
  website: string | null;
  revenue_range: string | null;
  qualification_status: string;
  score: number | null;
  source: string | null;
  form_responses: Record<string, unknown>;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingLeadSummary {
  id: string;
  full_name: string | null;
  email: string | null;
  qualification_status: string | null;
}

export interface Booking {
  id: string;
  org_id: string;
  lead_id: string | null;
  /** Scheduling provider: 'aurinko' for new bookings; 'calcom' for legacy rows. */
  provider: string;
  external_event_id: string;
  external_booking_uid: string | null;
  /** Aurinko booking profile UUID (null for legacy Cal.com bookings). */
  aurinko_profile_id: number | null;
  /** Local IntegrationAccount UUID that owns this booking. */
  integration_account_id: string | null;
  /** Self-service reschedule/cancel token from Aurinko. */
  reschedule_token: string | null;
  event_type: string | null;
  status: string;
  scheduled_at: string;
  duration_minutes: number | null;
  timezone: string | null;
  attendee_name: string | null;
  attendee_email: string | null;
  meeting_url: string | null;
  notes: string | null;
  reminder_sent_at: string | null;
  created_at: string;
  updated_at: string;
  lead: BookingLeadSummary | null;
}

export interface Contact {
  id: string;
  org_id: string;
  email: string;
  full_name: string | null;
  tags: string[];
  engagement_score: number | null;
  subscribed: boolean;
  source: string | null;
  created_at: string;
  updated_at: string;
}

/* ═══ Phase 2 — Billing types ═══ */

export interface Invoice {
  id: string;
  org_id: string;
  stripe_invoice_id: string | null;
  stripe_customer_id: string | null;
  stripe_hosted_invoice_url: string | null;
  stripe_invoice_pdf: string | null;
  lead_id: string | null;
  contact_id: string | null;
  status: string;
  currency: string;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  amount_paid_cents: number;
  amount_due_cents: number;
  client_name: string | null;
  client_email: string | null;
  due_date: string | null;
  paid_at: string | null;
  period_start: string | null;
  period_end: string | null;
  compound_phase: string | null;
  line_items: Array<{ description: string; amount_cents: number; quantity: number }>;
  description: string | null;
  internal_notes: string | null;
  reminder_count: number;
  last_reminder_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  org_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  lead_id: string | null;
  contact_id: string | null;
  status: string;
  plan_name: string | null;
  amount_cents: number;
  currency: string;
  interval: string;
  interval_count: number;
  client_name: string | null;
  client_email: string | null;
  compound_phase: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at: string | null;
  canceled_at: string | null;
  trial_start: string | null;
  trial_end: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

/* ═══ Phase 3 — Proposals types ═══ */

export interface ProposalBlock {
  type: string;
  title: string;
  content: string;
  order: number;
}

export interface Proposal {
  id: string;
  org_id: string;
  lead_id: string | null;
  contact_id: string | null;
  title: string;
  status: string;
  version: number;
  client_name: string;
  client_email: string;
  client_company: string | null;
  compound_phase: string | null;
  total_cents: number;
  currency: string;
  billing_interval: string;
  blocks: ProposalBlock[];
  share_token: string;
  expires_at: string | null;
  viewed_at: string | null;
  view_count: number;
  sent_at: string | null;
  signed_at: string | null;
  signer_name: string | null;
  generated_invoice_id: string | null;
  generated_project_id: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientOnboarding {
  id: string;
  org_id: string;
  proposal_id: string;
  lead_id: string | null;
  client_name: string;
  client_email: string;
  status: string;
  intake_form_sent_at: string | null;
  intake_form_completed_at: string | null;
  brand_voice_sent_at: string | null;
  brand_voice_completed_at: string | null;
  strategy_call_scheduled_at: string | null;
  completed_at: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

/* ═══ Phase 4 — Project Management types ═══ */

export interface Project {
  id: string;
  org_id: string;
  proposal_id: string | null;
  lead_id: string | null;
  name: string;
  description: string | null;
  status: string;
  // PM-1: client vs internal partition. Present on every project row;
  // /admin/work filters on project_type === "internal" and /admin/projects
  // on === "client". The portal never sees "internal" rows (enforced
  // server-side in app/api/portal.py).
  project_type: string;
  // PM-1: team/admins_only gate for INTERNAL projects only. Ignored for
  // client projects (they route through the portal-session check). The
  // backend collapses admins_only + non-admin to 404 so this field is
  // purely informational on the client.
  visibility: string;
  // PM-1: optional custom step list. ``null`` means "use the canonical
  // 13-step Stevie workflow". Client projects always ignore this.
  workflow_steps: Array<{ step: number; key: string; title: string }> | null;
  client_name: string | null;
  client_email: string | null;
  compound_phase: string | null;
  start_date: string | null;
  target_date: string | null;
  completed_at: string | null;
  color: string | null;
  task_count: number;
  created_at: string;
  updated_at: string;
}

export interface TaskItem {
  id: string;
  org_id: string;
  project_id: string;
  workflow_step: number;
  position: number;
  title: string;
  description: string | null;
  priority: string;
  assignee_id: string | null;
  assignee_name: string | null;
  due_date: string | null;
  completed_at: string | null;
  tags: string[];
  attachments: Array<Record<string, unknown>>;
  client_visible: boolean;
  client_approved: boolean;
  client_feedback: string | null;
  version: number;
  // PM-2: estimation + sprint linkage. All three may be null — small
  // backlog tasks are often un-estimated and live outside any sprint.
  story_points: number | null;
  estimate_hours: number | null;
  sprint_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStep {
  step: number;
  key: string;
  title: string;
  task_count: number;
}

/* ═══ PM-2 — Sprints, dependencies, workload ═══ */

export interface Sprint {
  id: string;
  org_id: string;
  project_id: string;
  name: string;
  goal: string | null;
  // "draft" | "active" | "completed" — only one sprint per project may
  // be "active" at a time (enforced at the DB level; server returns 409
  // if violated).
  status: string;
  start_date: string | null;
  end_date: string | null;
  completed_at: string | null;
  task_count: number;
  completed_count: number;
  total_story_points: number;
  completed_story_points: number;
  created_at: string;
  updated_at: string;
}

export interface TaskDependency {
  task_id: string;
  depends_on_task_id: string;
  created_at: string;
}

// Per-assignee capacity rollup. ``assignee_id`` is null for the synthetic
// "Unassigned" bucket.
export interface WorkloadEntry {
  assignee_id: string | null;
  assignee_name: string | null;
  open_tasks: number;
  total_story_points: number;
  total_estimate_hours: number;
  overdue_count: number;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string | null;
  author_name: string | null;
  content: string;
  is_client_comment: boolean;
  created_at: string;
}

/* ═══ Phase 5 — Reporting types ═══ */

export interface ClientReport {
  id: string;
  org_id: string;
  project_id: string | null;
  lead_id: string | null;
  title: string;
  status: string;
  cadence: string;
  compound_phase: string | null;
  client_name: string | null;
  client_email: string | null;
  period_start: string;
  period_end: string;
  sections: Array<{ type: string; title: string; data: Record<string, unknown> }>;
  metrics_snapshot: Record<string, unknown>;
  internal_notes: string | null;
  pdf_url: string | null;
  share_token: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PhaseDashboard {
  phase: string;
  title: string;
  description: string;
  metrics_definition: Array<{ key: string; label: string; unit: string }>;
  monthly_data: Array<{
    month: string;
    invoice_count: number;
    revenue_cents: number;
    paid_count: number;
    outstanding_cents: number;
  }>;
}

export interface RevenueSummary {
  total_revenue_cents: number;
  total_outstanding_cents: number;
  total_invoices: number;
  paid_invoices: number;
  overdue_invoices: number;
  mrr_cents: number;
  active_subscriptions: number;
  by_phase: Array<{ phase: string; total_cents: number; invoice_count: number }>;
}

/* ═══ Phase 6 — Email Marketing + Forms + Automation ═══ */

export interface EmailTemplate {
  id: string;
  org_id: string;
  name: string;
  subject: string | null;
  category: string;
  html_body: string | null;
  compiled_html: string | null;
  design_json: Record<string, unknown> | null;
  variables: string[] | null;
  thumbnail_url: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailCampaign {
  id: string;
  org_id: string;
  name: string;
  subject: string | null;
  preview_text: string | null;
  from_name: string | null;
  from_email: string | null;
  reply_to: string | null;
  template_id: string | null;
  html_body: string | null;
  status: string;
  audience_filter: Record<string, unknown> | null;
  recipient_count: number;
  compound_phase: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  ab_test: Record<string, unknown> | null;
  total_sent: number;
  total_delivered: number;
  total_opened: number;
  total_clicked: number;
  total_bounced: number;
  total_unsubscribed: number;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FormDefinition {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  schema_json: Record<string, unknown>;
  theme_json: Record<string, unknown> | null;
  notify_emails: string[] | null;
  success_message: string | null;
  redirect_url: string | null;
  automation_id: string | null;
  submission_count: number;
  created_at: string;
  updated_at: string;
}

export interface FormSubmissionItem {
  id: string;
  form_id: string;
  contact_id: string | null;
  data: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export interface AutomationWorkflow {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  status: string;
  trigger_type: string;
  trigger_config: Record<string, unknown> | null;
  steps: Array<{ type: string; config: Record<string, unknown> }>;
  total_runs: number;
  last_run_at: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationRun {
  id: string;
  automation_id: string;
  contact_id: string | null;
  trigger_event: string | null;
  status: string;
  steps_completed: number;
  error_message: string | null;
  execution_log: unknown[] | null;
  completed_at: string | null;
  created_at: string;
}

/* ═══ Phase 7 — Video, Social Media & AI ═══ */

export interface SocialAccount {
  id: string;
  org_id: string;
  platform: string;
  account_name: string;
  account_id: string;
  profile_url: string | null;
  avatar_url: string | null;
  is_active: boolean;
  token_expires_at: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SocialPost {
  id: string;
  org_id: string;
  social_account_id: string;
  project_id: string | null;
  platform: string;
  status: string;
  caption: string | null;
  hashtags: string[] | null;
  media_urls: string[] | null;
  media_type: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  platform_post_id: string | null;
  platform_url: string | null;
  compound_phase: string | null;
  is_amplified: boolean;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  reach: number;
  engagement_rate: number | null;
  error_message: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrandVoiceProfile {
  id: string;
  org_id: string;
  name: string;
  client_name: string | null;
  lead_id: string | null;
  tone_descriptors: string[];
  vocabulary_preferences: Record<string, unknown> | null;
  example_pieces: string[];
  guardrails: string[];
  system_prompt: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface AIContentRequestItem {
  id: string;
  org_id: string;
  brand_voice_id: string | null;
  project_id: string | null;
  content_type: string;
  prompt: string;
  platform: string | null;
  context: Record<string, unknown> | null;
  model: string;
  status: string;
  generated_content: string | null;
  alternatives: string[] | null;
  input_tokens: number;
  output_tokens: number;
  cost_cents: number;
  latency_ms: number;
  rating: number | null;
  feedback_note: string | null;
  used_in_post_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIProviderChainStatus {
  models: string[];
  providers: string[];
  external_billing_dependent: boolean;
}

export interface AIProviderStatus {
  queue_configured: boolean;
  default_model: string;
  content_type_chains: Record<string, AIProviderChainStatus>;
  warnings: string[];
}

export interface VideoAssetItem {
  id: string;
  org_id: string;
  project_id: string | null;
  task_id: string | null;
  filename: string;
  file_size_bytes: number;
  mime_type: string;
  duration_seconds: number | null;
  resolution: string | null;
  r2_key: string;
  r2_url: string | null;
  thumbnail_url: string | null;
  mux_asset_id: string | null;
  mux_playback_id: string | null;
  mux_status: string | null;
  client_name: string | null;
  campaign: string | null;
  asset_type: string | null;
  tags: string[] | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PresignedUploadResponse {
  upload_url: string;
  asset_id: string;
  r2_key: string | null;
  cf_image_id: string | null;
  cf_stream_uid: string | null;
}

/* Autonomous Agency */

export interface ClientEngagement {
  id: string;
  org_id: string;
  lead_id: string | null;
  project_id: string | null;
  name: string;
  client_url: string | null;
  repo_url: string | null;
  client_name: string | null;
  client_email: string | null;
  status: string;
  goals: unknown[];
  constraints: unknown[];
  intake_payload: Record<string, unknown>;
  integration_state: Record<string, unknown>;
  created_by_agent: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketingRun {
  id: string;
  org_id: string;
  engagement_id: string;
  project_id: string | null;
  status: string;
  stage: string;
  objective: string;
  strategy_summary: Record<string, unknown>;
  current_blocker: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgencyArtifact {
  id: string;
  org_id: string;
  engagement_id: string;
  marketing_run_id: string | null;
  virtual_agency_task_id: string | null;
  artifact_type: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  payload_hash: string;
  version: number;
  evidence_refs: unknown[];
  lineage: Record<string, unknown>;
  author_role: string;
  created_at: string;
  updated_at: string;
}

export interface AgencyApprovalRequest {
  id: string;
  org_id: string;
  engagement_id: string;
  marketing_run_id: string | null;
  approval_type: string;
  status: string;
  subject_type: string;
  subject_id: string;
  reason: string;
  approval_version: number;
  approval_payload_hash: string;
  decided_at: string | null;
  decided_by_user_id: string | null;
  decision_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgencyAccessRequest {
  id: string;
  org_id: string;
  engagement_id: string;
  marketing_run_id: string | null;
  request_type: string;
  provider: string | null;
  status: string;
  scope: Record<string, unknown>;
  reason: string;
  instructions: Record<string, unknown>;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationRunEvent {
  resource_type: "virtual_agency_event";
  id: string;
  org_id: string;
  marketing_run_id: string;
  task_id: string;
  project_id: string | null;
  event_type: string;
  actor_role: string | null;
  actor_id: string | null;
  idempotency_key: string;
  task_version: number | null;
  approval_version: number | null;
  previous_event_hash: string | null;
  payload_hash: string;
  event_hash: string;
  payload: Record<string, unknown>;
  lineage: Record<string, unknown>;
  occurred_at: string;
  links: Array<{ rel: string; href: string }>;
}

export interface IntegrationTask {
  resource_type: "virtual_agency_task";
  id: string;
  org_id: string;
  project_id: string;
  source_task_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  reason: string;
  agent_role: string;
  task_type: string;
  status: string;
  task_version: number;
  approved_version: number | null;
  approval_active: boolean;
  approval_payload_hash: string | null;
  latest_event_hash: string | null;
  context: Record<string, unknown>;
  lineage: Record<string, unknown>;
  claimed_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  links: Array<{ rel: string; href: string }>;
}

export interface IntegrationEvidenceSummary {
  resource_type: "marketing_run_evidence_summary";
  run_id: string;
  org_id: string;
  status: string;
  stage: string;
  artifact_count: number;
  artifact_type_counts: Record<string, number>;
  task_count: number;
  task_status_counts: Record<string, number>;
  event_count: number;
  event_type_counts: Record<string, number>;
  approval_count: number;
  pending_approval_count: number;
  access_request_count: number;
  open_access_request_count: number;
  social_post_count: number;
  social_post_status_counts: Record<string, number>;
  evidence_hashes: Record<string, string[]>;
  links: Array<{ rel: string; href: string }>;
}

export interface IntegrationSocialPost {
  resource_type: "social_post";
  id: string;
  org_id: string;
  project_id: string | null;
  social_account_id: string;
  platform: string;
  status: string;
  caption: string | null;
  hashtags: unknown[] | null;
  media_urls: unknown[] | null;
  media_type: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  platform_post_id: string | null;
  platform_url: string | null;
  compound_phase: string | null;
  created_by_agent: string | null;
  version: number;
  current_content_hash: string;
  scheduled_content_hash: string | null;
  published_content_hash: string | null;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  reach: number;
  engagement_rate: number | null;
  lineage: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  links: Array<{ rel: string; href: string }>;
}

export interface IntegrationRunEvidenceSnapshot {
  resource_type: "marketing_run_evidence_snapshot";
  run: MarketingRun;
  summary: IntegrationEvidenceSummary;
  tasks: IntegrationTask[];
  events: IntegrationRunEvent[];
  artifacts: AgencyArtifact[];
  approvals: AgencyApprovalRequest[];
  access_requests: AgencyAccessRequest[];
  social_posts: IntegrationSocialPost[];
  links: Array<{ rel: string; href: string }>;
}

export interface ClientEngagementCreatePayload {
  name?: string;
  client_url?: string;
  repo_url?: string;
  client_name?: string;
  client_email?: string;
  goals?: string[];
  constraints?: string[];
  intake_payload?: Record<string, unknown>;
  integration_state?: Record<string, unknown>;
}

export interface AgencyArtifactCreatePayload {
  marketing_run_id?: string | null;
  artifact_type: string;
  title: string;
  body?: string | null;
  payload?: Record<string, unknown>;
  evidence_refs?: Array<{ kind: string; id: string; label: string }>;
  lineage?: Record<string, unknown>;
  author_role: string;
}

export interface AgencyApprovalCreatePayload {
  marketing_run_id?: string | null;
  approval_type: string;
  subject_type: string;
  subject_id: string;
  reason: string;
  approval_payload?: Record<string, unknown>;
}

export interface AgencyAccessRequestCreatePayload {
  marketing_run_id?: string | null;
  request_type: string;
  provider?: string | null;
  scope?: Record<string, unknown>;
  reason: string;
  instructions?: Record<string, unknown>;
}

export interface AgencyAccessRequestDecisionPayload {
  decision: "granted" | "blocked" | "revoked";
  decision_note?: string;
  resolution_payload?: Record<string, unknown>;
}

export async function listClientEngagements() {
  return apiFetch<PaginatedResponse<ClientEngagement>>(
    "/api/agency/engagements?per_page=50&page=1"
  );
}

export async function createClientEngagement(
  payload: ClientEngagementCreatePayload
) {
  return apiFetch<ClientEngagement>("/api/agency/engagements", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listMarketingRuns(engagementId: string) {
  return apiFetch<MarketingRun[]>(
    `/api/agency/engagements/${encodeURIComponent(engagementId)}/runs`
  );
}

export async function createMarketingRun(
  engagementId: string,
  payload: { objective: string; project_id?: string | null }
) {
  return apiFetch<MarketingRun>(
    `/api/agency/engagements/${encodeURIComponent(engagementId)}/runs`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function dispatchMarketingRun(
  engagementId: string,
  runId: string
) {
  return apiFetch<{
    ok: boolean;
    engagement_id: string;
    marketing_run_id: string;
    status: string;
    stage: string;
    approved_count: number;
    dispatched_count: number;
    dispatched_task_ids: string[];
  }>(
    `/api/agency/engagements/${encodeURIComponent(engagementId)}/runs/${encodeURIComponent(runId)}/dispatch`,
    { method: "POST" }
  );
}

export async function listAgencyArtifacts(engagementId: string) {
  return apiFetch<AgencyArtifact[]>(
    `/api/agency/engagements/${encodeURIComponent(engagementId)}/artifacts`
  );
}

export async function createAgencyArtifact(
  engagementId: string,
  payload: AgencyArtifactCreatePayload
) {
  return apiFetch<AgencyArtifact>(
    `/api/agency/engagements/${encodeURIComponent(engagementId)}/artifacts`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function listAgencyApprovals(engagementId: string) {
  return apiFetch<AgencyApprovalRequest[]>(
    `/api/agency/engagements/${encodeURIComponent(engagementId)}/approvals`
  );
}

export async function createAgencyApproval(
  engagementId: string,
  payload: AgencyApprovalCreatePayload
) {
  return apiFetch<AgencyApprovalRequest>(
    `/api/agency/engagements/${encodeURIComponent(engagementId)}/approvals`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function decideAgencyApproval(
  approvalId: string,
  payload: { decision: "approved" | "rejected" | "revoked"; decision_note?: string }
) {
  return apiFetch<AgencyApprovalRequest>(
    `/api/agency/approvals/${encodeURIComponent(approvalId)}/decision`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function listAgencyAccessRequests(engagementId: string) {
  return apiFetch<AgencyAccessRequest[]>(
    `/api/agency/engagements/${encodeURIComponent(engagementId)}/access-requests`
  );
}

export async function createAgencyAccessRequest(
  engagementId: string,
  payload: AgencyAccessRequestCreatePayload
) {
  return apiFetch<AgencyAccessRequest>(
    `/api/agency/engagements/${encodeURIComponent(engagementId)}/access-requests`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function decideAgencyAccessRequest(
  accessRequestId: string,
  payload: AgencyAccessRequestDecisionPayload
) {
  return apiFetch<AgencyAccessRequest>(
    `/api/agency/access-requests/${encodeURIComponent(accessRequestId)}/decision`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function listIntegrationRunEvents(runId: string) {
  return apiFetch<IntegrationRunEvent[]>(
    `/api/integration/v1/marketing-runs/${encodeURIComponent(runId)}/events`
  );
}

export async function listIntegrationRunTasks(runId: string) {
  return apiFetch<IntegrationTask[]>(
    `/api/integration/v1/marketing-runs/${encodeURIComponent(runId)}/tasks`
  );
}

export async function getIntegrationRunEvidenceSnapshot(runId: string) {
  return apiFetch<IntegrationRunEvidenceSnapshot>(
    `/api/integration/v1/marketing-runs/${encodeURIComponent(runId)}/evidence-snapshot`
  );
}

export async function getIntegrationEvidenceSummary(runId: string) {
  return apiFetch<IntegrationEvidenceSummary>(
    `/api/integration/v1/marketing-runs/${encodeURIComponent(runId)}/evidence-summary`
  );
}

export interface OrganizationSettings {
  org_id: string;
  name: string;
  slug: string;
  plan: string;
  domain: string | null;
  logo_url: string | null;
  is_active: boolean;
  settings: Record<string, unknown>;
  compound_method_defaults: Record<string, unknown>;
}
