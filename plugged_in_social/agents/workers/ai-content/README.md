# stevie-ai-content

Cloudflare Worker that handles AI content generation through Cloudflare AI Gateway.

## What it does

Consumes `AIContentMessage` from the `stevie-ai-content` queue, asks FastAPI to
build the prompt (`POST /api/internal/ai/{request_id}/begin`), routes to the
matching AI provider via Cloudflare AI Gateway (Anthropic / OpenAI / Workers AI
/ Google AI Studio depending on the model id), then POSTs the generated
content + token usage + latency back to FastAPI
(`POST /api/internal/ai/{request_id}/complete`). The backend computes
`cost_cents` from model + tokens and updates the `AIContentRequest` row under
RLS.

Prompt-build logic stays Python-side (single source of truth for the
`content_type` and `platform` hint maps). The Worker is intentionally thin —
just an HTTP relay with provider routing + retry classification on top.

## Provider routing

The Worker auto-detects the provider from the model id prefix:

| Model prefix       | Provider               | Gateway path                                  |
|--------------------|------------------------|-----------------------------------------------|
| `claude-*`         | Anthropic              | `/anthropic/v1/messages`                      |
| `gpt-*` / `o3-*`   | OpenAI                 | `/openai/chat/completions`                    |
| `@cf/*`            | Cloudflare Workers AI  | `/workers-ai/{model}`                         |
| `gemini-*`         | Google AI Studio       | `/google-ai-studio/v1/models/{model}:...` |

When the backend returns `model_chain` with 2+ entries, the Worker uses the
[Universal Endpoint][1] for quota-aware fallback — first 2xx wins, errors
fall through to the next provider in the chain.

[1]: https://developers.cloudflare.com/ai-gateway/universal/

## Why AI Gateway (not direct provider URLs)

The gateway sits in front of every upstream and gives us caching, retries,
observability, and rate-limit handling for free. We hit it via raw `fetch`
rather than pulling in vendor SDKs (smaller bundle, simpler retry
classification, same observability).

Setup: <https://developers.cloudflare.com/ai-gateway/>

## Retry taxonomy

| Provider / gateway status | Disposition                            |
| ------------------------- | -------------------------------------- |
| 200                       | success → POST `/complete`, `ack()`    |
| 408 / 409 / 425 / 429     | `RetryableError` → CF Queues retries   |
| 5xx (incl. Anthropic 529) | `RetryableError` → CF Queues retries   |
| 401 / 403                 | `PermanentError` → POST `/fail`, ack   |
| 400                       | `PermanentError` → POST `/fail`, ack   |
| Other 4xx                 | `PermanentError` → POST `/fail`, ack   |
| Network / abort           | `RetryableError` → CF Queues retries   |

`max_retries=5` plus CF Queues' exponential backoff. The DLQ
(`stevie-ai-content-dlq`) catches anything still failing after that.

## Required secrets

```bash
wrangler secret put CF_AI_GATEWAY_URL  # gateway base, no provider suffix
wrangler secret put CF_AIG_TOKEN       # only if Authenticated Gateway is enabled
wrangler secret put WEBHOOK_SECRET     # must match backend WEBHOOK_SECRET
wrangler secret put BACKEND_BASE_URL   # e.g. https://api.stevie.social
```

Plus per-provider keys — only set the ones you'll actually use, validated
lazily per message:

```bash
wrangler secret put ANTHROPIC_API_KEY    # for claude-*
wrangler secret put OPENAI_API_KEY       # for gpt-* / o3-*
wrangler secret put CF_WORKERS_AI_TOKEN  # for @cf/* (CF API token, Workers AI Read scope)
wrangler secret put GOOGLE_AI_API_KEY    # for gemini-*
```

`CF_AI_GATEWAY_URL` is the gateway BASE URL **without** a provider suffix,
e.g. `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}`. Older
deployments that pin the URL to `.../anthropic` still work — `providers.ts`
strips the trailing segment for backwards compat.

If the Cloudflare AI Gateway is authenticated, set `CF_AIG_TOKEN` too; the
Worker will add `cf-aig-authorization: Bearer ...` to every provider request
and Universal Endpoint fallback entry.

## Required queue (run once)

```bash
wrangler queues create stevie-ai-content
wrangler queues create stevie-ai-content-dlq
```

For staging/production, suffix the queue names per `wrangler.toml`.

## Local dev

```bash
pnpm install
pnpm dev
```

## Tests

```bash
pnpm test
```

Tests cover provider routing (`providers.test.ts` — 38 tests), the queue
handler retry decision tree (`index.test.ts` — 10 tests with mocked `fetch`
and `BackendClient`), and the legacy prompt builder (`prompt.test.ts`).

## Deploy

```bash
pnpm deploy                       # default (development)
pnpm deploy -- --env=staging
pnpm deploy -- --env=production
```
