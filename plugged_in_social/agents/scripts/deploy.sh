#!/usr/bin/env bash
#
# Stevie agents deploy script — runs all the wrangler commands you need in
# order, with safety guards so a half-finished run can't leave you in a bad
# state. Run this from your machine where `wrangler login` has been done.
#
# Usage:
#   ./scripts/deploy.sh dev        # local-style dev deploy (default env)
#   ./scripts/deploy.sh staging
#   ./scripts/deploy.sh production
#
# What it does:
#   1. Confirms wrangler auth (asks you to login if not).
#   2. Creates the queues if they don't exist (idempotent).
#   3. Prompts you to set required secrets the first time.
#   4. Deploys queue-producer first (FastAPI depends on it).
#   5. Deploys each consumer Worker.
#   6. Prints the producer Worker URL for FastAPI's QUEUE_PRODUCER_URL env var.

set -euo pipefail

ENV="${1:-dev}"
case "$ENV" in
  dev)
    WRANGLER_ENV_FLAG=""
    QUEUE_SUFFIX=""
    ;;
  staging)
    WRANGLER_ENV_FLAG="--env=staging"
    QUEUE_SUFFIX="-staging"
    ;;
  production)
    WRANGLER_ENV_FLAG="--env=production"
    QUEUE_SUFFIX="-production"
    ;;
  *)
    echo "Usage: $0 {dev|staging|production}" >&2
    exit 1
    ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "═══════════════════════════════════════════════════════════"
echo "  Stevie agents deploy → $ENV"
echo "═══════════════════════════════════════════════════════════"
echo

# ── All queues we'll create + their DLQs ──────────────────────────────
QUEUES=(
  stevie-stripe-sync
  stevie-email-sender
  stevie-mux-ingest
  stevie-ai-content
  stevie-report-builder
  stevie-automation-runner
  stevie-social-publisher
)

# Workers that run scheduled handlers — they call the queue producer
# directly via fetch and need QUEUE_PRODUCER_URL after the producer's
# first deploy.
CRON_WORKERS=(billing-cron reports-cron social-cron)

# ── Workers to deploy in order. queue-producer first; SSE pubsub last
#    (it has a Durable Object migration that's easier to rollback in
#    isolation). Everything else order-agnostic but deterministic helps
#    log readability.
WORKERS=(
  queue-producer
  stripe-sync
  email-sender
  email-events
  mux-ingest
  mux-webhook
  ai-content
  report-builder
  billing-cron
  reports-cron
  automation-runner
  social-publisher
  social-cron
  sse-pubsub
)

# ── Step 1: confirm wrangler auth ─────────────────────────────────────
echo "▶ Confirming wrangler auth…"
if ! npx wrangler whoami 2>&1 | grep -q "associated with the email"; then
  echo "  Not logged in. Running wrangler login…"
  npx wrangler login
fi
npx wrangler whoami | sed 's/^/  /'
echo

# ── Step 2: create queues + DLQs (idempotent) ─────────────────────────
echo "▶ Ensuring queues exist…"
for base in "${QUEUES[@]}"; do
  for q in "${base}${QUEUE_SUFFIX}" "${base}${QUEUE_SUFFIX}-dlq"; do
    if npx wrangler queues create "$q" 2>&1 | tee /tmp/q.out | grep -q "already exists"; then
      echo "  $q: already exists ✓"
    elif grep -q "Created queue" /tmp/q.out; then
      echo "  $q: created ✓"
    else
      echo "  $q: queue create unexpected:"
      cat /tmp/q.out | sed 's/^/    /'
    fi
  done
done
echo

# ── Step 3: prompt for required secrets per Worker ────────────────────
echo "▶ Required secrets per Worker. Skip prompts that say already set."
echo

set_secret_if_missing() {
  local worker_dir="$1"
  local secret="$2"
  local description="$3"
  cd "$ROOT/workers/$worker_dir"
  if npx wrangler secret list $WRANGLER_ENV_FLAG 2>/dev/null | grep -q "\"name\": \"$secret\""; then
    echo "  [$worker_dir] $secret: already set ✓"
  else
    echo "  [$worker_dir] $secret missing — $description"
    npx wrangler secret put "$secret" $WRANGLER_ENV_FLAG
  fi
  cd "$ROOT"
}

# Shared secrets every Worker needs
for w in "${WORKERS[@]}"; do
  set_secret_if_missing "$w" WEBHOOK_SECRET "must match backend WEBHOOK_SECRET (32+ chars)"
done

# Workers that need BACKEND_BASE_URL (everything except queue-producer
# and sse-pubsub — neither calls FastAPI internal endpoints)
for w in stripe-sync email-sender email-events mux-ingest mux-webhook ai-content report-builder billing-cron reports-cron automation-runner social-publisher social-cron; do
  set_secret_if_missing "$w" BACKEND_BASE_URL "FastAPI public URL, no trailing slash, e.g. https://api.stevie.social"
done

# Workers that need QUEUE_PRODUCER_URL (the cron Workers fan out via the producer)
for w in billing-cron reports-cron social-cron; do
  set_secret_if_missing "$w" QUEUE_PRODUCER_URL "set this AFTER first queue-producer deploy; re-run this script then"
done

# Worker-specific secrets
set_secret_if_missing stripe-sync   STRIPE_SECRET_KEY "Stripe secret key (sk_test_… or sk_live_…)"
set_secret_if_missing email-sender  RESEND_API_KEY    "Resend API key"
set_secret_if_missing email-events  RESEND_WEBHOOK_SECRET "Resend webhook signing secret (Svix)"
set_secret_if_missing mux-ingest    MUX_TOKEN_ID      "Mux access token id"
set_secret_if_missing mux-ingest    MUX_TOKEN_SECRET  "Mux access token secret"
set_secret_if_missing mux-ingest    R2_ACCESS_KEY_ID  "R2 access key (for presigning)"
set_secret_if_missing mux-ingest    R2_SECRET_ACCESS_KEY "R2 secret"
set_secret_if_missing mux-ingest    R2_ENDPOINT       "R2 endpoint URL"
set_secret_if_missing mux-ingest    R2_BUCKET_NAME    "R2 bucket name (default stevie-social)"
set_secret_if_missing mux-webhook   MUX_WEBHOOK_SIGNING_SECRET "Mux webhook signing secret"
set_secret_if_missing ai-content    ANTHROPIC_API_KEY "Anthropic API key (proxied through AI Gateway)"
set_secret_if_missing ai-content    CF_AI_GATEWAY_URL "AI Gateway base URL, no provider suffix, e.g. https://gateway.ai.cloudflare.com/v1/<account>/<gateway>"
echo "  [ai-content] CF_AIG_TOKEN: optional — set manually if Authenticated Gateway is enabled"
set_secret_if_missing sse-pubsub    SUPABASE_URL      "Supabase project URL, e.g. https://abc.supabase.co (no trailing slash)"
# SUPABASE_JWT_SECRET is OPTIONAL — only needed if the project still issues
# legacy HS256 JWTs. The script doesn't prompt for it; set it manually with
# `wrangler secret put SUPABASE_JWT_SECRET --env=production` if needed.
echo

# ── Step 4: deploy queue-producer first ───────────────────────────────
echo "▶ Deploying queue-producer…"
cd "$ROOT/workers/queue-producer"
PRODUCER_OUTPUT=$(npx wrangler deploy $WRANGLER_ENV_FLAG 2>&1 | tee /dev/stderr)
PRODUCER_URL=$(echo "$PRODUCER_OUTPUT" | grep -oE 'https://[a-z0-9-]+\.workers\.dev' | head -1 || true)
cd "$ROOT"
echo

# ── Step 5: deploy consumer + cron + DO Workers ───────────────────────
for worker in stripe-sync email-sender email-events mux-ingest mux-webhook ai-content report-builder billing-cron reports-cron automation-runner social-publisher social-cron sse-pubsub; do
  if [ ! -f "$ROOT/workers/$worker/wrangler.toml" ]; then
    echo "  $worker: no wrangler.toml yet, skipping"
    continue
  fi
  echo "▶ Deploying $worker…"
  cd "$ROOT/workers/$worker"
  npx wrangler deploy $WRANGLER_ENV_FLAG
  cd "$ROOT"
  echo
done

# ── Step 6: print follow-up ───────────────────────────────────────────
echo "═══════════════════════════════════════════════════════════"
echo "  ✓ Deploy complete"
echo "═══════════════════════════════════════════════════════════"
if [ -n "$PRODUCER_URL" ]; then
  echo
  echo "  Set this on the FastAPI side (DO App Platform env var) for $ENV:"
  echo
  echo "    QUEUE_PRODUCER_URL=$PRODUCER_URL"
  echo "    SSE_PUBSUB_URL=https://stevie-sse-pubsub${QUEUE_SUFFIX:+-${ENV}}.<account>.workers.dev"
  echo
  echo "  Then restart the backend so the new URLs are picked up."
  echo
  echo "  IMPORTANT: re-run this script ONCE more after the first deploy"
  echo "  so the cron Workers can pick up QUEUE_PRODUCER_URL — they need"
  echo "  the producer URL but the producer doesn't exist on the first run."
fi
echo
echo "  Tail logs with:"
echo "    npx wrangler tail stevie-stripe-sync${QUEUE_SUFFIX:-} $WRANGLER_ENV_FLAG"
