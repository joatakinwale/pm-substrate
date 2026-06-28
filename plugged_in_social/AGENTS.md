<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Repo Workflow

- Default to the root `Stevie Social` app unless the task explicitly targets `coldCallAutomated/`.
- The root local stack is driven by `docker compose` from the repo root:
  - `docker compose up -d`
  - `docker compose logs -f api`
  - `docker compose down`
- Root services are PostgreSQL, Redis, the FastAPI API, and the Next.js frontend.
  Background work runs on Cloudflare Workers + Queues — there is no in-repo
  task broker. Redis stays only for slowapi rate-limit counters and a
  transitional SSE pub/sub fallback.

## Root Commands

- Frontend (`/frontend`): `npm run dev`, `npm run build`, `npm run start`, `npm run lint`
- Backend (`/backend`): `pip install -r requirements.txt`, `alembic upgrade head`, `uvicorn app.main:app --reload`
- Useful backend utilities:
  - `python scripts/seed.py`
  - `WEBHOOK_SECRET=... python -m scripts.verify_resend_webhook_mapping`

## Scheduler Split

- Cloudflare Worker cron (`/workers/src/cron.ts`) owns the HTTP-triggered scheduled jobs under `/internal/cron/*`.
- Per-Worker `[triggers]` cron (in each Worker's `wrangler.toml`) own backend-only periodic jobs such as payment reminders, social publishing, social metric refreshes, and monthly reports.
- Deploy Workers from `/workers` with `wrangler deploy --config wrangler.toml --env <upload|cache|webhooks|cron|image-transform>`.
- Verify the webhook worker helper logic with `node test-webhook-svix.mjs`.

## Required Environment / Secrets

Missing values do not silently no-op anymore — most paths now surface a
clear error so the operator can spot the gap.

### Backend (`/backend/.env`)

- `QUEUE_PRODUCER_URL` — base URL of the queue-producer Worker. AI
  content generation, email sender, automations, etc. publish through
  this. When unset the API responds 503 on those paths instead of
  dropping the message; set `ALLOW_QUEUE_DROP=1` only for offline
  local dev.
- `AI_DEFAULT_MODEL` — model id new generations default to when the
  caller doesn't specify one AND no per-content-type chain is set
  AND no built-in chain matches the content type. Empty falls back to
  `@cf/meta/llama-3.1-8b-instruct`. Any string the configured AI Gateway provider
  accepts is valid (see the multi-provider section below).
- `AI_MODEL_CAPTION` / `AI_MODEL_BLOG_POST` / `AI_MODEL_EMAIL_COPY` /
  `AI_MODEL_HASHTAGS` / `AI_MODEL_SCRIPT` — comma-separated list of
  model ids per content type. The first entry is primary; entries 2+
  are fallbacks fed to Cloudflare AI Gateway's [Universal Endpoint][1]
  (first 2xx wins, errors fall through to the next provider). When
  unset, the built-in defaults route captions/hashtags to
  `@cf/meta/llama-3.1-8b-instruct → gemini-2.5-flash` and long-form
  to `@cf/meta/llama-3.3-70b-instruct-fp8-fast → gemini-2.5-flash`
  with Anthropic only as a last-resort quality fallback. Per-org overrides at
  `Organization.settings.ai.models.<content_type>` (string or list)
  win over env. Set just the primary (one entry) to disable fallback
  for that type.

  [1]: https://developers.cloudflare.com/ai-gateway/universal/

  Example for a cost-aware instance:
  ```
  AI_MODEL_CAPTION=@cf/meta/llama-3.1-8b-instruct,gpt-4o-mini
  AI_MODEL_HASHTAGS=@cf/meta/llama-3.1-8b-instruct
  AI_MODEL_BLOG_POST=@cf/meta/llama-3.3-70b-instruct-fp8-fast,gemini-2.5-flash,claude-sonnet-4-6
  ```
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO` —
  instance-wide email defaults. Per-org overrides live in
  `Organization.settings.email_from` / `email_reply_to`.
- `UMAMI_API_URL`, `UMAMI_API_KEY` (or `UMAMI_USERNAME` /
  `UMAMI_PASSWORD`) — instance-wide Umami fallback. Per-org overrides
  live in `Organization.settings.umami.{website_id, api_url, api_key}`.
- `CF_IMAGES_DELIVERY_URL` or `CF_IMAGES_ACCOUNT_HASH` — required for
  the logo / blog cover uploaders to surface a real https:// URL after
  upload. The settings page calls `GET /api/media/{id}` to resolve
  `delivery_url` and will show an upload error when neither is set.
- `R2_PUBLIC_URL` — fallback for image delivery when Cloudflare Images
  isn't configured.
- `AURINKO_CLIENT_ID`, `AURINKO_CLIENT_SECRET` — Aurinko application
  credentials (from the Aurinko portal). Required for the OAuth flow,
  booking-profile management, and app-level availability queries.
  When unset, all `/api/integrations/aurinko/*` and
  `/api/public/booking/*` paths return 503.
- `AURINKO_SIGNING_SECRET` — shared secret used to verify Aurinko
  webhook signatures. Must match the value configured on the Aurinko
  application AND the value the webhook Worker forwards as
  `X-Webhook-Secret`.
- `AURINKO_BASE_URL` — defaults to `https://api.aurinko.io/v1`.
  Override only for a regional Aurinko endpoint.

### ai-content Worker — multi-provider via Cloudflare AI Gateway

The Worker routes to whichever provider matches the model id prefix.
You only need to set the keys for providers you actually generate
against — every key is validated lazily per message.

| Model prefix       | Provider               | Env var on the Worker  | Gateway path                                            |
|--------------------|------------------------|------------------------|---------------------------------------------------------|
| `claude-*`         | Anthropic              | `ANTHROPIC_API_KEY`    | `/anthropic/v1/messages`                                |
| `gpt-*` / `o3-*`   | OpenAI                 | `OPENAI_API_KEY`       | `/openai/chat/completions`                              |
| `@cf/*`            | Cloudflare Workers AI  | `CF_WORKERS_AI_TOKEN`  | `/workers-ai/{model}`                                   |
| `gemini-*`         | Google AI Studio       | `GOOGLE_AI_API_KEY`    | `/google-ai-studio/v1/models/{model}:generateContent`     |

Always-required Worker secrets:

- `CF_AI_GATEWAY_URL` — gateway BASE URL **without** a provider suffix,
  e.g. `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}`.
  Older Anthropic-only deployments that pinned the URL to `.../anthropic`
  still work — `providers.ts` strips the trailing segment for backwards
  compat. New deployments should drop the suffix.
- `CF_AIG_TOKEN` — optional Cloudflare AI Gateway token. Required when the
  gateway has Authenticated Gateway enabled.
- `WEBHOOK_SECRET` (must match the backend's `WEBHOOK_SECRET`)
- `BACKEND_BASE_URL`

Set with `wrangler secret put NAME --env <env>` from
`agents/workers/ai-content/`. The frontend "Retry" button re-publishes
stuck rows, so once secrets are configured queued rows from before the
deploy can be recovered without losing the prompt.

Cheap-default tip: `@cf/meta/llama-3.1-8b-instruct` runs on Cloudflare's
GPU edge with no OpenAI/Anthropic API key (just `CF_WORKERS_AI_TOKEN`), and
costs roughly two orders of magnitude less than Sonnet for similar
quality on caption / hashtag tasks. It is now the codepath default when
no content-type chain applies.

#### Source-of-truth references (verify before relying on)

| Surface                       | Source                                                                                       | Verified |
|-------------------------------|----------------------------------------------------------------------------------------------|----------|
| Anthropic model IDs           | https://platform.claude.com/docs/en/about-claude/models/overview                             | ✅ 2026Q2 |
| Anthropic pricing             | https://platform.claude.com/docs/en/about-claude/pricing                                     | ✅ 2026Q2 |
| AI Gateway provider URLs      | https://developers.cloudflare.com/ai-gateway/usage/providers/                                | ✅       |
| Workers AI URL pattern        | https://developers.cloudflare.com/ai-gateway/usage/providers/workersai/                      | ✅       |
| Workers AI response wrap      | https://developers.cloudflare.com/workers-ai/get-started/rest-api/ → `{result, success, errors, messages}` | ✅       |
| Gemini `systemInstruction`    | https://ai.google.dev/api/generate-content                                                   | ✅       |
| OpenAI model IDs / pricing    | https://platform.openai.com/docs/models, https://openai.com/api/pricing                      | ⚠ approximate — verify before billing |
| Workers AI per-token rates    | https://developers.cloudflare.com/workers-ai/platform/pricing/                               | ⚠ approximate — billed per "neuron", numbers in code are conversions |
| Gemini pricing                | https://ai.google.dev/gemini-api/docs/pricing                                                | ⚠ approximate — varies by context-window tier on 2.5 Pro |

Anthropic IDs to know about:
- Current: `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5`
- Still accepted: `claude-opus-4-6`, `claude-sonnet-4-5`, `claude-opus-4-5`,
  `claude-opus-4-1`, plus their dated forms (`claude-sonnet-4-5-20250929`, etc.)
- **Deprecated, retiring 2026-06-15**: `claude-sonnet-4-20250514`,
  `claude-opus-4-20250514`. If a stuck row in your DB carries one of these,
  rewrite it to a current alias (Retry button does this for new rows;
  migration 017 rewrites the old hardcoded default for queued rows).

### Frontend (`/frontend/.env.local`)

- `NEXT_PUBLIC_API_URL` — backend base URL.
- `NEXT_PUBLIC_AURINKO_CLIENT_ID` — Aurinko application client id used
  to build the OAuth `authorize` URL client-side. Must match
  `AURINKO_CLIENT_ID` in the backend.
- Per-tenant booking pages render at `/book/{org_slug}/{profile_slug}`
  and pull profile metadata + branding from the unauthenticated
  `GET /api/public/branding/{slug}` endpoint. The legacy
  `NEXT_PUBLIC_CALCOM_*` env vars and `Organization.settings.cal.*`
  fields are removed — see `backend/app/integrations/aurinko/`.

## Legacy / Imported Areas

- `coldCallAutomated/` is a separate FlowDylo codebase with its own READMEs, package scripts, and Dockerfiles. Only use its commands when the task explicitly lives in that subtree.
- `.github/workflows/` is intentionally trimmed to the root Stevie Social frontend validation and backend image/deploy paths. Do not reintroduce Launchpad, FlowDylo/Vite, or old test-branch ARM build assumptions unless that subtree is restored.
