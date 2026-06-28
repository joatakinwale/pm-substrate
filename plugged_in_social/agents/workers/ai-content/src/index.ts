/**
 * stevie-ai-content — Cloudflare Worker (queue consumer)
 *
 * Replaces: backend/app/tasks/ai_tasks.py::generate_content
 *
 * Flow:
 *   1. Consume AIContentMessage from the stevie-ai-content queue.
 *   2. POST FastAPI /api/internal/ai/{request_id}/begin → returns the
 *      pre-built {system_prompt, user_prompt, model, max_tokens, temperature}.
 *      The backend keeps prompt-build logic Python-side (single source of
 *      truth for content_type / platform hint maps).
 *   3. Detect provider from model id (claude-* / gpt-* / @cf/* / gemini-*)
 *      and POST the matching native body to Cloudflare AI Gateway. See
 *      ``providers.ts`` for the routing table.
 *   4. Parse the provider-shaped response: text, token usage, latency.
 *   5. POST FastAPI /api/internal/ai/{request_id}/complete with the generated
 *      content + token usage + model + latency. The backend computes
 *      cost_cents from model + tokens via record_cost_sync and updates the
 *      AIContentRequest under RLS.
 *   6. ack() on success or after PermanentError-with-fail; retry on RetryableError.
 *
 * Retry taxonomy (mirrors the Python's _TRANSIENT_HTTP_STATUSES set —
 *   {408, 409, 425, 429, 500, 502, 503, 504, 529} — and its non-transient
 *   "fail fast" branch):
 *     401 / 403       → PermanentError + POST /fail (auth: retry won't fix it)
 *     400             → PermanentError + POST /fail (bad prompt: retry burns quota)
 *     other 4xx       → PermanentError + POST /fail (safety refusal etc.)
 *     408/409/425/429 → RetryableError (transient — gateway/upstream backoff)
 *     5xx (incl. 529) → RetryableError (provider-side incident, will recover)
 *     network / abort → RetryableError (default-safe fallback)
 *
 * On RetryableError CF Queues retries per the queue's max_retries=5 setting.
 * The DLQ catches anything still failing after that.
 */
import {
  assertEnv,
  type BaseEnv,
  handleConsumerError,
  PermanentError,
  RetryableError,
  validateMessage,
  type AIContentMessage,
} from "@stevie/shared";
import { BackendCallError, BackendClient } from "@stevie/backend-client";
import {
  buildRequest,
  buildUniversalRequest,
  filterModelsByConfiguredProviders,
  MissingProviderKeyError,
  parseResponse,
  parseResponseAuto,
  UnsupportedModelError,
  type ProviderEnv,
  type ProviderId,
} from "./providers.js";

interface Env extends BaseEnv, ProviderEnv {
  /**
   * Cloudflare AI Gateway base URL. Should NOT include a provider
   * suffix — the Worker appends ``/anthropic``, ``/openai``,
   * ``/workers-ai/{model}``, etc. itself based on the model id. Older
   * deployments that point at ``.../anthropic`` still work; the Worker
   * strips the trailing segment for backwards compat.
   */
  CF_AI_GATEWAY_URL: string;
}

export default {
  async queue(
    batch: MessageBatch<unknown>,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    // Note: per-provider API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY,
    // CF_WORKERS_AI_TOKEN, GOOGLE_AI_API_KEY) are NOT required up-front
    // — providers.ts validates them lazily based on the model in each
    // message, so an org running only Workers AI doesn't need an
    // Anthropic key on the Worker.
    assertEnv<Env>(env, [
      "WEBHOOK_SECRET",
      "BACKEND_BASE_URL",
      "ENVIRONMENT",
      "CF_AI_GATEWAY_URL",
    ]);

    const backend = new BackendClient({
      baseUrl: env.BACKEND_BASE_URL,
      webhookSecret: env.WEBHOOK_SECRET,
    });

    for (const msg of batch.messages) {
      try {
        const payload = validateMessage<AIContentMessage>(
          msg.body,
          "ai.content.generate"
        );
        await generateOne(payload, backend, env);
        msg.ack();
      } catch (err) {
        handleConsumerError(msg, err);
      }
    }
  },
} satisfies ExportedHandler<Env>;

async function generateOne(
  payload: AIContentMessage,
  backend: BackendClient,
  env: Env
): Promise<void> {
  // 1. Ask FastAPI for the pre-built prompt + model params. This also flips
  //    the AIContentRequest into a non-terminal state and 409s if the row
  //    has already been completed/failed — re-entry guard so a duplicate
  //    queue delivery doesn't double-charge the AI provider.
  let prompt: Awaited<ReturnType<BackendClient["beginAIContent"]>>;
  try {
    prompt = await backend.beginAIContent({
      request_id: payload.request_id,
      org_id: payload.org_id,
    });
  } catch (err) {
    if (err instanceof BackendCallError) {
      if (err.isRetryable) {
        throw new RetryableError(err.message, err);
      }
      throw new PermanentError(err.message, err);
    }
    throw new RetryableError(
      `backend begin failed: ${err instanceof Error ? err.message : String(err)}`,
      err
    );
  }

  // 2. Build the request. When the backend returns a model_chain with
  //    more than one entry we use the AI Gateway Universal Endpoint
  //    (which falls through on errors / rate limits to the next
  //    provider in the chain). Length-1 chains keep the cheaper
  //    per-provider path — Universal Endpoint adds latency we don't
  //    need when there's no fallback to consider.
  const requestedChain: string[] = prompt.model_chain ?? [prompt.model];
  let chain: string[] = [];

  let fetchUrl = "";
  let fetchHeaders: Record<string, string> = {};
  let fetchBody = "";
  let primaryProvider: ProviderId = "anthropic"; // overwritten below
  let chainHint: ProviderId[] = [];

  try {
    const filtered = filterModelsByConfiguredProviders(requestedChain, env);
    chain = filtered.models;
    if (filtered.skipped.length > 0) {
      console.warn(
        `[ai-content] skipped unconfigured provider fallback(s): ${filtered.skipped
          .map((entry) => `${entry.model} missing ${String(entry.envVar)}`)
          .join(", ")}`,
      );
    }
    if (chain.length === 0) {
      const required = filtered.skipped
        .map((entry) => `${entry.model} requires ${String(entry.envVar)}`)
        .join("; ");
      const message = `No configured AI provider credentials for this model chain. ${required}`;
      await markFailed(backend, payload, message);
      throw new PermanentError(message, undefined);
    }

    const useUniversal = chain.length > 1;
    const reqShape = {
      systemPrompt: prompt.system_prompt ?? null,
      userPrompt: prompt.user_prompt,
      model: chain[0]!,
      maxTokens: prompt.max_tokens,
      temperature: prompt.temperature,
    };

    if (useUniversal) {
      const u = buildUniversalRequest(
        env.CF_AI_GATEWAY_URL,
        reqShape,
        chain,
        env,
      );
      fetchUrl = u.url;
      fetchHeaders = { "content-type": "application/json" };
      fetchBody = u.body;
      primaryProvider = u.chain[0]!;
      chainHint = u.chain;
    } else {
      const single = buildRequest(env.CF_AI_GATEWAY_URL, reqShape, env);
      fetchUrl = single.built.url;
      fetchHeaders = single.built.headers;
      fetchBody = single.built.body;
      primaryProvider = single.provider;
      chainHint = [single.provider];
    }
  } catch (err) {
    // Bad model id or missing per-provider key — neither will fix
    // itself on retry. Mark failed so the operator sees it.
    if (
      err instanceof UnsupportedModelError ||
      err instanceof MissingProviderKeyError
    ) {
      await markFailed(backend, payload, err.message);
      throw new PermanentError(err.message, err);
    }
    throw err;
  }

  const start = Date.now();
  let res: Response;
  try {
    res = await fetch(fetchUrl, {
      method: "POST",
      headers: fetchHeaders,
      body: fetchBody,
    });
  } catch (err) {
    // Network / abort / DNS — no HTTP status to classify on. Default to
    // retryable so a transient blip doesn't burn the request.
    throw new RetryableError(
      `ai gateway fetch failed (${primaryProvider}): ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  }

  if (!res.ok) {
    // Universal Endpoint surfaces the LAST provider's error when every
    // fallback fails (per CF docs intent: pass-through). Single-provider
    // mode surfaces the only provider's error. Either way the existing
    // 4xx/5xx classification is correct.
    const bodyText = await res.text();
    await classifyAndThrow(res.status, bodyText, payload, backend);
    return; // classifyAndThrow always throws; this satisfies TS narrowing.
  }

  // 3. Parse the success response.
  //
  // For single-provider calls we know the exact response shape. For
  // Universal Endpoint the gateway passes through whichever upstream
  // succeeded — we detect by shape (each provider has unique top-level
  // keys; see parseResponseAuto). The pricing lookup downstream uses
  // ``parsed.model`` so cost is correct even when a fallback won.
  const result = (await res.json()) as unknown;
  const latencyMs = Date.now() - start;

  const parsed = chain.length > 1
    ? parseResponseAuto(result, chain[0]!, chainHint)
    : parseResponse(primaryProvider, result, chain[0]!);
  const generatedContent = parsed.generatedContent;
  const inputTokens = parsed.inputTokens;
  const outputTokens = parsed.outputTokens;

  // 4. Push results back to FastAPI. A POST failure here is unfortunate —
  //    we already paid Anthropic for the call. CF Queues will retry on
  //    5xx/429; the AI Gateway typically serves the cached response on the
  //    next attempt so we don't re-bill. 4xx (other than 429) means our
  //    body shape doesn't match the schema, which is a code bug — DLQ it.
  try {
    await backend.completeAIContent({
      request_id: payload.request_id,
      org_id: payload.org_id,
      generated_content: generatedContent,
      model: parsed.model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      latency_ms: latencyMs,
    });
  } catch (err) {
    if (err instanceof BackendCallError) {
      if (err.isRetryable) {
        throw new RetryableError(err.message, err);
      }
      throw new PermanentError(err.message, err);
    }
    throw new RetryableError(
      `backend complete failed: ${err instanceof Error ? err.message : String(err)}`,
      err
    );
  }
}

/**
 * Classify a provider / AI Gateway HTTP error and either:
 *   - throw RetryableError (transient — let CF Queues retry per max_retries),
 *   - or POST /fail and throw PermanentError (so CF Queues acks via
 *     handleConsumerError and the row shows the failure in the UI).
 *
 * Transient set: 408, 409, 425, 429, 5xx (incl. Anthropic-specific 529).
 * Everything else 4xx is permanent — auth errors, bad request, safety
 * refusal etc. won't fix on retry.
 */
async function classifyAndThrow(
  status: number,
  body: string,
  payload: AIContentMessage,
  backend: BackendClient
): Promise<never> {
  const snippet = body.slice(0, 300);

  if (isProviderBillingFailure(status, snippet)) {
    await markFailed(
      backend,
      payload,
      `Provider billing unavailable (HTTP ${status}): ${snippet}`,
    );
    throw new PermanentError(
      `provider billing unavailable HTTP ${status}: ${snippet}`,
      undefined,
    );
  }

  // Transient — let CF Queues retry. We intentionally do NOT POST /fail
  // here: leaving the row mid-flight lets the next attempt pick up cleanly.
  //   408 Request Timeout
  //   409 Conflict
  //   425 Too Early
  //   429 Too Many Requests
  //   529 Anthropic-specific overloaded
  //   5xx upstream errors
  if (
    status === 408 ||
    status === 409 ||
    status === 425 ||
    status === 429 ||
    status === 529 ||
    (status >= 500 && status < 600)
  ) {
    throw new RetryableError(
      `ai gateway transient HTTP ${status}: ${snippet}`,
      undefined
    );
  }

  // Permanent — auth error. No retry will fix a wrong API key. Mark failed
  // so an operator notices in the dashboard.
  //   401 Unauthorized
  //   403 Forbidden
  if (status === 401 || status === 403) {
    await markFailed(
      backend,
      payload,
      `Provider auth error (HTTP ${status}): ${snippet}`,
    );
    throw new PermanentError(
      `provider auth error HTTP ${status}: ${snippet}`,
      undefined,
    );
  }

  // Permanent — bad request. Usually a malformed model name or a body
  // shape the provider rejected. Retrying just burns quota.
  //   400 Bad Request
  if (status === 400) {
    await markFailed(
      backend,
      payload,
      `Provider bad request (HTTP 400): ${snippet}`,
    );
    throw new PermanentError(
      `provider bad request: ${snippet}`,
      undefined,
    );
  }

  // Anything else 4xx (safety refusal, unsupported feature, etc.). Treat as
  // permanent — if we discover one of these is actually transient we promote
  // it into the branch above.
  await markFailed(backend, payload, `Provider HTTP ${status}: ${snippet}`);
  throw new PermanentError(`provider HTTP ${status}: ${snippet}`, undefined);
}

function isProviderBillingFailure(status: number, snippet: string): boolean {
  if (status === 402) return true;
  const normalized = snippet.toLowerCase();
  return [
    "insufficient_quota",
    "payment required",
    "billing",
    "credit balance",
    "credits exhausted",
    "out of credits",
    "current quota",
    "spend limit",
  ].some((needle) => normalized.includes(needle));
}

/**
 * Best-effort: POST /fail so the user sees the error in the UI. If this
 * itself fails we swallow the error — the original Anthropic failure is
 * still about to be re-thrown and that's the one we want surfaced.
 */
async function markFailed(
  backend: BackendClient,
  payload: AIContentMessage,
  errorMessage: string
): Promise<void> {
  try {
    await backend.failAIContent({
      request_id: payload.request_id,
      org_id: payload.org_id,
      error_message: errorMessage.slice(0, 500),
    });
  } catch (e) {
    console.error(
      `[ai-content] failed to mark request ${payload.request_id} as failed:`,
      e instanceof Error ? e.message : String(e)
    );
  }
}
