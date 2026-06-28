# stevie-sse-pubsub

Cloudflare Worker + Durable Object. Replaces the Redis pub/sub used by
`backend/app/services/realtime.py`.

## What it does

- `POST /publish/{org_id}` — FastAPI calls this from `broadcast_event()`
  with the event payload. Auth via shared `X-Webhook-Secret` header.
  Routed to a per-org Durable Object (`OrgChannel`) which fans out to
  every connected client.
- `GET /subscribe/{org_id}` — Browser opens an SSE stream
  (`Accept: text/event-stream`) or a WebSocket (`Upgrade: websocket`).
  Same DO is the backplane.

One Durable Object instance per `org_id`, keyed by
`env.ORG_CHANNEL.idFromName(org_id)`.

## Auth on /subscribe

The Bearer token (`Authorization: Bearer <jwt>` header or `?token=`
query param — EventSource can't set custom headers) is verified as a
Supabase JWT using [`jose`](https://github.com/panva/jose):

- **ES256 / RS256** (current Supabase default) — signature verified
  against the project's JWKS at
  `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`. JWKs are cached per
  Worker isolate for 1 hour, keyed by `kid` (matches FastAPI's
  `_JWKS_TTL_SECONDS` in `backend/app/auth/supabase.py`).
- **HS256** (legacy) — verified against `SUPABASE_JWT_SECRET` if set.

After signature verification, the Worker requires that
`payload.app_metadata.org_id` equals the `{org_id}` in the URL.
Mismatch or missing claim → 403. All other auth failures (no token,
unknown `kid`, bad signature, unsupported alg) → 401.

This mirrors the Python verifier in `backend/app/auth/supabase.py`:
same audience (`authenticated`), same JWKS-by-`kid` lookup, same HS256
fallback path.

## Required secrets

```bash
wrangler secret put WEBHOOK_SECRET       # must match backend WEBHOOK_SECRET
wrangler secret put BACKEND_BASE_URL     # e.g. https://api.stevie.social
wrangler secret put SUPABASE_URL         # e.g. https://<project>.supabase.co (no trailing slash)
wrangler secret put SUPABASE_JWT_SECRET  # OPTIONAL — only if the project still issues HS256 JWTs
wrangler secret put ALLOWED_ORIGINS      # OPTIONAL — comma-separated frontend origins for browser SSE
```

## Local dev

```bash
pnpm install
pnpm dev
```

Then publish a test event:

```bash
curl -X POST http://localhost:8787/publish/11111111-2222-3333-4444-555555555555 \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -H "content-type: application/json" \
  -d '{"event":"lead.created","payload":{"lead_id":"abc"}}'
```

…and subscribe from another shell:

```bash
curl -N \
  -H "Authorization: Bearer dev-token-anything" \
  http://localhost:8787/subscribe/11111111-2222-3333-4444-555555555555
```

You should see the published event appear as `data: {...}\n\n`.

## Tests

```bash
pnpm test
```

Unit tests cover route matching, webhook-secret rejection, and bad-body
handling. End-to-end DO behavior (fan-out across multiple clients,
hibernation, WS handshake) is integration-tested by
`scripts/test-sse-pubsub.sh` (out of scope for this commit).

## Deploy

```bash
pnpm deploy                       # default (development)
pnpm deploy -- --env=staging
pnpm deploy -- --env=production
```

After deploy, set the FastAPI side:

```bash
# backend/.env
SSE_PUBSUB_URL=https://stevie-sse-pubsub-production.<account>.workers.dev
```
