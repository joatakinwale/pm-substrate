# Supabase Integrations — Setup Guide

Companion doc to migration `016_supabase_integrations.py`. Covers the manual
steps that can't be put in a migration because they depend on secrets in
Supabase Vault or runtime decisions per-deployment.

## TL;DR — Scope Decisions (task #58)

Supabase offers three things under the "integrations" banner. We made a
deliberate choice about each:

| Integration                | Status        | Why                                                                                                                                             |
| -------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Cal.com Foreign Data Wrapper | **Not used** | Our Cal.com is self-hosted at `cal.stevie.social` and uses webhook-in (`backend/app/api/internal/webhooks.py::calcom_webhook`), not polling. No outbound API token to configure. |
| Stripe Foreign Data Wrapper  | **Scaffolded** | Requires a real Stripe API key (`.env` currently has a placeholder). Migration enables the `wrappers` extension; the FDW server + foreign tables are created manually in Studio after Vault is populated. |
| `pg_cron`                    | **Enabled for SQL-only jobs** | Already have a Cloudflare Worker → FastAPI `/internal/cron/*` cron for anything that calls app logic (see MED-6). `pg_cron` here is purely for in-DB maintenance (purge soft-deletes, trim `audit_log`) — it does **not** duplicate Worker jobs. |
| Database Webhooks            | **Already on** | Existing architecture. See `app/api/internal/webhooks.py`. |

The `integrations_config` table created by migration 016 is the single source
of truth for "is this integration connected?" — read by `/api/admin/health`
and toggled from the admin UI. Secrets never go in this table; they go in
Supabase Vault.

## 1. Apply the Migration

```bash
cd backend
alembic upgrade head
```

On Supabase Cloud both `pg_cron` and `wrappers` are available by default and
the migration will:

1. `CREATE EXTENSION IF NOT EXISTS pg_cron`
2. `CREATE EXTENSION IF NOT EXISTS wrappers WITH SCHEMA extensions`
3. Create the `integrations_config` table with RLS enabled.
4. Schedule two `pg_cron` jobs:
   - `purge_soft_deleted_90d` — nightly 03:15 UTC, deletes rows where
     `is_deleted = true AND updated_at < now() - interval '90 days'` across
     every public table that has an `is_deleted` column.
   - `purge_audit_log_1y` — Sunday 03:30 UTC, deletes `audit_log` rows older
     than one year.

On plain `postgres:16` (local docker-compose) both extensions are missing;
the `DO` blocks catch the error and emit `RAISE NOTICE` so `alembic upgrade`
still succeeds on dev. The `integrations_config` table is created either way.

## 2. Populate Supabase Vault

Only needed in production / staging. Skip on local dev.

Open **Supabase Studio → Project Settings → Vault → New Secret** and add:

| Secret Name              | Value                                          | Used by                                    |
| ------------------------ | ---------------------------------------------- | ------------------------------------------ |
| `stripe_api_key`         | Your live or restricted Stripe secret key      | Stripe FDW (below) + FastAPI `STRIPE_SECRET_KEY` |
| `calcom_webhook_secret`  | The HMAC secret configured in Cal.com webhook settings | `calcom_webhook` signature verify          |
| `resend_api_key`         | Resend API key                                 | FastAPI email sender                       |

Vault stores values encrypted (libsodium) and exposes them via
`vault.decrypted_secrets`. Never `SELECT` them from app code — read them in
an `EXECUTE` from a SECURITY DEFINER function, or in the FDW server options
as shown below.

## 3. Stripe Foreign Data Wrapper (optional — Stripe team only)

**Prerequisite:** `stripe_api_key` row exists in `vault.decrypted_secrets`.

Run this in Studio → SQL Editor. Not put in the migration because it
depends on Vault state.

```sql
-- Create FDW server pointing at Stripe's API, authenticated via Vault.
CREATE SERVER stripe_server
  FOREIGN DATA WRAPPER stripe_wrapper
  OPTIONS (
    api_key_id (SELECT id::text FROM vault.secrets WHERE name = 'stripe_api_key')
  );

-- Expose Stripe objects as read-only foreign tables under the `stripe` schema.
CREATE SCHEMA IF NOT EXISTS stripe;

CREATE FOREIGN TABLE stripe.customers (
  id text,
  email text,
  name text,
  description text,
  created timestamp,
  attrs jsonb
) SERVER stripe_server OPTIONS (object 'customers');

CREATE FOREIGN TABLE stripe.subscriptions (
  id text,
  customer text,
  status text,
  current_period_start timestamp,
  current_period_end timestamp,
  attrs jsonb
) SERVER stripe_server OPTIONS (object 'subscriptions');

CREATE FOREIGN TABLE stripe.invoices (
  id text,
  customer text,
  subscription text,
  status text,
  total bigint,
  currency text,
  created timestamp,
  attrs jsonb
) SERVER stripe_server OPTIONS (object 'invoices');

-- Restrict to service role — our app code uses the Python stripe SDK, not SQL.
REVOKE ALL ON ALL TABLES IN SCHEMA stripe FROM authenticated, anon;
GRANT  SELECT ON ALL TABLES IN SCHEMA stripe TO service_role;

-- Mark as connected.
INSERT INTO integrations_config (org_id, kind, enabled, config)
SELECT id, 'stripe', true, '{"mode": "fdw"}'::jsonb
FROM organizations
ON CONFLICT (org_id, kind) DO UPDATE
  SET enabled = EXCLUDED.enabled,
      config  = EXCLUDED.config,
      updated_at = now();
```

### When to use FDW vs the Stripe SDK

Use the **Python SDK** (`app/services/billing/stripe_client.py`) for:
- Anything that writes (create customer, create subscription, create refund).
- Anything that needs webhook signing or idempotency keys.
- Any customer-facing flow — the SDK gives us typed exceptions and retries.

Use the **FDW** only for:
- Read-only SQL analytics that join Stripe data with our own tables
  (e.g. "list accounts whose Stripe subscription is past-due AND who have
  no active posts in the last 14 days").
- One-off reconciliation queries in Studio.

The FDW is not a replacement for the SDK — it's a convenience for queries
that would otherwise need a reporting pipeline.

## 4. Registering Integrations per Org

`integrations_config` is per-org (matches the RLS model). Seed rows for a
newly-onboarded org happen in `app/services/orgs/provisioning.py::seed_integrations`:

```python
DEFAULT_INTEGRATIONS = [
    # Inbound webhook consumers — marked "enabled" as soon as the webhook URL
    # is live on the other side.
    ("calcom",      False, {"webhook_url": "/api/internal/webhooks/calcom"}),
    # Outbound API clients — need creds, start disabled.
    ("stripe",      False, {"mode": "sdk"}),
    ("resend",      False, {}),
    ("cloudflare_stream", False, {}),
    ("umami",       False, {}),
    # Social platforms — OAuth-gated, enabled per-account.
    ("social_instagram", False, {}),
    ("social_tiktok",    False, {}),
    ("social_youtube",   False, {}),
    ("social_linkedin",  False, {}),
    ("social_facebook",  False, {}),
    ("social_x",         False, {}),
]
```

The admin `/settings/integrations` page reads from this table; toggling an
integration flips `enabled` and (for OAuth-backed integrations) kicks off the
connection flow.

## 5. pg_cron Jobs — What's Installed and Why

The migration schedules two jobs, both pure-SQL, both safe to run against
the live database without app state:

| Job                          | Schedule (UTC)    | What it does                                                                          |
| ---------------------------- | ----------------- | ------------------------------------------------------------------------------------- |
| `purge_soft_deleted_90d`     | `15 3 * * *`      | `DELETE FROM <table> WHERE is_deleted = true AND updated_at < now() - interval '90 days'` for every public table with an `is_deleted` column. |
| `purge_audit_log_1y`         | `30 3 * * 0`      | Trim `audit_log` to a rolling 1-year window. |

Check the schedule:

```sql
SELECT jobname, schedule, command, active
FROM cron.job
ORDER BY jobname;
```

See run history:

```sql
SELECT jobid, runid, status, return_message, start_time, end_time
FROM cron.job_run_details
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE 'purge_%')
ORDER BY start_time DESC
LIMIT 20;
```

### Why these are NOT in the Cloudflare Worker cron

Per MED-6 resolution — the Worker cron (see
`cloudflare-workers/cron/src/index.ts`) calls FastAPI endpoints under
`/internal/cron/*`. Everything it runs either needs app-level logic (publish
scheduled posts, sync analytics, send booking reminders) or emits side
effects to external services. A nightly `DELETE` has no business going
through an HTTP round-trip just to run a SQL statement, and doing it in the
DB means we can't forget to re-schedule it when the Worker is redeployed.

### When to move a job OUT of pg_cron

If a SQL job ever needs to call out to an API, emit a Slack alert, or
publish an event, move it to FastAPI + the Worker cron. `pg_cron` is for
"pure data janitorial" jobs only.

## 6. Health Check Wiring

`/api/admin/health` reads `integrations_config` and, for enabled rows, pings
the upstream service. The result is stored in
`integrations_config.last_verified_at` + `last_error`. Admin UI polls every
60 seconds when the health page is open.

Verification cadence per integration:

- **Stripe (SDK):** `stripe.Balance.retrieve()` — cheapest call.
- **Stripe (FDW):** `SELECT 1 FROM stripe.customers LIMIT 1`.
- **Cal.com:** last successful webhook receipt from `bookings.updated_at`.
- **Resend:** `GET /ping` on the Resend API.
- **Cloudflare Stream:** `GET /accounts/{id}/stream/?per_page=1` on the Cloudflare API.
- **Umami:** `GET /api/websites` with the configured site ID.
- **Social platforms:** OAuth token refresh success in last 24h.

## 7. Rollback

Migration 016's `downgrade()` unschedules the two `pg_cron` jobs and drops
`integrations_config`. It does **not** drop the `pg_cron` or `wrappers`
extensions — other features may depend on them, and both are harmless to
leave enabled.

To remove the Stripe FDW objects (if you ran the SQL in §3), do so manually
BEFORE running `alembic downgrade -1`:

```sql
DROP FOREIGN TABLE IF EXISTS stripe.customers, stripe.subscriptions, stripe.invoices;
DROP SCHEMA IF EXISTS stripe CASCADE;
DROP SERVER IF EXISTS stripe_server CASCADE;
```
