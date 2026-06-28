/**
 * Multi-provider routing for Cloudflare AI Gateway.
 *
 * Detects the provider from the model id, builds the matching
 * gateway path + native request body, and parses the matching
 * response shape.
 *
 * Supported families:
 *   - Anthropic         (model: "claude-*")          → /anthropic/v1/messages
 *   - OpenAI            (model: "gpt-*", "o3-*")     → /openai/chat/completions
 *   - Cloudflare WorkersAI (model: "@cf/*")          → /workers-ai/{model}
 *   - Google AI Studio  (model: "gemini-*")          → /google-ai-studio/v1/models/{model}:generateContent
 *
 * Adding a provider is one ``case`` in ``providerFor`` plus one
 * ``case`` in ``buildRequest`` and one in ``parseResponse``.
 *
 * The gateway base URL ``CF_AI_GATEWAY_URL`` should be the gateway
 * root WITHOUT a provider suffix (e.g.
 * ``https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}``).
 * For backwards-compat with the previous Anthropic-only deployment,
 * ``stripLegacyAnthropicSuffix`` accepts URLs that end in
 * ``/anthropic`` and strips it.
 */

export type ProviderId =
  | "anthropic"
  | "openai"
  | "workers-ai"
  | "google-ai-studio";

export interface ProviderEnv {
  /**
   * Optional AI Gateway auth token. Required only when the gateway has
   * Authenticated Gateway enabled. The provider API keys below still
   * authenticate the upstream provider when using request-header auth.
   */
  CF_AIG_TOKEN?: string;
  /** Anthropic API key — required when routing to Anthropic. */
  ANTHROPIC_API_KEY?: string;
  /** OpenAI API key — required when routing to OpenAI. */
  OPENAI_API_KEY?: string;
  /** Google AI Studio API key — required when routing to Gemini. */
  GOOGLE_AI_API_KEY?: string;
  /**
   * Cloudflare API token with Workers AI Read scope — required when
   * routing to Workers AI. Reuse of ``ANTHROPIC_API_KEY`` is NOT valid
   * here; this is a CF-account-level token.
   */
  CF_WORKERS_AI_TOKEN?: string;
}

export interface ProviderRequest {
  /** Pre-resolved system prompt (or null). */
  systemPrompt: string | null;
  /** Pre-built user prompt with content_type/platform hints already wrapped. */
  userPrompt: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface ProviderResponse {
  generatedContent: string;
  /** Echo of the actual model the upstream served — may differ from request. */
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export class UnsupportedModelError extends Error {
  constructor(model: string) {
    super(
      `unsupported model id "${model}": expected prefix claude-* / gpt-* / o3-* / gemini-* / @cf/*`,
    );
    this.name = "UnsupportedModelError";
  }
}

export class MissingProviderKeyError extends Error {
  constructor(provider: ProviderId, varName: string) {
    super(
      `model routes to provider="${provider}" but env var ${varName} is empty`,
    );
    this.name = "MissingProviderKeyError";
  }
}

export function requiredEnvVarForProvider(provider: ProviderId): keyof ProviderEnv {
  switch (provider) {
    case "anthropic":
      return "ANTHROPIC_API_KEY";
    case "openai":
      return "OPENAI_API_KEY";
    case "workers-ai":
      return "CF_WORKERS_AI_TOKEN";
    case "google-ai-studio":
      return "GOOGLE_AI_API_KEY";
  }
}

export function hasProviderCredentials(
  provider: ProviderId,
  env: ProviderEnv,
): boolean {
  const varName = requiredEnvVarForProvider(provider);
  return Boolean(env[varName]);
}

export function filterModelsByConfiguredProviders(
  models: string[],
  env: ProviderEnv,
): { models: string[]; skipped: Array<{ model: string; provider: ProviderId; envVar: keyof ProviderEnv }> } {
  const configured: string[] = [];
  const skipped: Array<{ model: string; provider: ProviderId; envVar: keyof ProviderEnv }> = [];

  for (const model of models) {
    const provider = providerFor(model);
    const envVar = requiredEnvVarForProvider(provider);
    if (env[envVar]) {
      configured.push(model);
    } else {
      skipped.push({ model, provider, envVar });
    }
  }

  return { models: configured, skipped };
}

/**
 * Strip a trailing ``/anthropic`` (or other provider segment) from the
 * gateway URL so the Worker can append its own per-provider path.
 *
 * Existing deployments set ``CF_AI_GATEWAY_URL`` to the Anthropic-flavored
 * URL (the only flavor we used to support). We keep working with that
 * value so an operator can roll out multi-provider without re-saving
 * the secret first.
 */
export function stripLegacyAnthropicSuffix(rawUrl: string): string {
  const trimmed = rawUrl.replace(/\/+$/, "");
  return trimmed.replace(
    /\/(anthropic|openai|workers-ai|google-ai-studio)$/,
    "",
  );
}

export function providerFor(model: string): ProviderId {
  const m = model.toLowerCase();
  if (m.startsWith("@cf/")) return "workers-ai";
  if (m.startsWith("claude-") || m.startsWith("claude/")) return "anthropic";
  if (m.startsWith("gpt-") || m.startsWith("o1-") || m.startsWith("o3-")) {
    return "openai";
  }
  if (m.startsWith("gemini-") || m.startsWith("models/gemini-")) {
    return "google-ai-studio";
  }
  throw new UnsupportedModelError(model);
}

interface BuiltRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export function buildRequest(
  baseUrl: string,
  req: ProviderRequest,
  env: ProviderEnv,
): { provider: ProviderId; built: BuiltRequest } {
  const base = stripLegacyAnthropicSuffix(baseUrl);
  const provider = providerFor(req.model);

  switch (provider) {
    case "anthropic": {
      if (!env.ANTHROPIC_API_KEY) {
        throw new MissingProviderKeyError(provider, "ANTHROPIC_API_KEY");
      }
      const body: Record<string, unknown> = {
        model: req.model,
        max_tokens: req.maxTokens,
        temperature: req.temperature,
        messages: [{ role: "user", content: req.userPrompt }],
      };
      if (req.systemPrompt) body.system = req.systemPrompt;
      return {
        provider,
        built: {
          url: `${base}/anthropic/v1/messages`,
          headers: {
            "content-type": "application/json",
            "anthropic-version": "2023-06-01",
            "x-api-key": env.ANTHROPIC_API_KEY,
            ...gatewayAuthHeaders(env),
          },
          body: JSON.stringify(body),
        },
      };
    }

    case "openai": {
      if (!env.OPENAI_API_KEY) {
        throw new MissingProviderKeyError(provider, "OPENAI_API_KEY");
      }
      const messages: Array<{ role: string; content: string }> = [];
      if (req.systemPrompt) {
        messages.push({ role: "system", content: req.systemPrompt });
      }
      messages.push({ role: "user", content: req.userPrompt });
      return {
        provider,
        built: {
          url: `${base}/openai/chat/completions`,
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${env.OPENAI_API_KEY}`,
            ...gatewayAuthHeaders(env),
          },
          body: JSON.stringify({
            model: req.model,
            messages,
            max_tokens: req.maxTokens,
            temperature: req.temperature,
          }),
        },
      };
    }

    case "workers-ai": {
      if (!env.CF_WORKERS_AI_TOKEN) {
        throw new MissingProviderKeyError(provider, "CF_WORKERS_AI_TOKEN");
      }
      // Workers AI accepts both its native "prompt" body and an
      // OpenAI-compatible "messages" body. We use the messages form
      // because it preserves system prompts, which the native form
      // doesn't support cleanly. The model id stays in the URL path.
      const messages: Array<{ role: string; content: string }> = [];
      if (req.systemPrompt) {
        messages.push({ role: "system", content: req.systemPrompt });
      }
      messages.push({ role: "user", content: req.userPrompt });
      return {
        provider,
        built: {
          url: `${base}/workers-ai/${req.model}`,
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${env.CF_WORKERS_AI_TOKEN}`,
            ...gatewayAuthHeaders(env),
          },
          body: JSON.stringify({
            messages,
            max_tokens: req.maxTokens,
            temperature: req.temperature,
          }),
        },
      };
    }

    case "google-ai-studio": {
      if (!env.GOOGLE_AI_API_KEY) {
        throw new MissingProviderKeyError(provider, "GOOGLE_AI_API_KEY");
      }
      // Gemini exposes a top-level ``systemInstruction`` field — that's
      // the documented home for system prompts (verified at
      // https://ai.google.dev/api/generate-content). The earlier
      // workaround that synthesised a user/model primer exchange burned
      // tokens and degraded output; use the native field instead.
      const body: Record<string, unknown> = {
        contents: [
          {
            role: "user",
            parts: [{ text: req.userPrompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens: req.maxTokens,
          temperature: req.temperature,
        },
      };
      if (req.systemPrompt) {
        body.systemInstruction = { parts: [{ text: req.systemPrompt }] };
      }
      return {
        provider,
        built: {
          url: `${base}/google-ai-studio/v1/models/${req.model}:generateContent`,
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": env.GOOGLE_AI_API_KEY,
            ...gatewayAuthHeaders(env),
          },
          body: JSON.stringify(body),
        },
      };
    }
  }
}

export function parseResponse(
  provider: ProviderId,
  rawJson: unknown,
  fallbackModel: string,
): ProviderResponse {
  switch (provider) {
    case "anthropic": {
      const r = rawJson as {
        model?: string;
        content?: Array<{ type: string; text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      let text = "";
      for (const block of r.content ?? []) {
        if (block.type === "text" && block.text !== undefined) {
          text += block.text;
        }
      }
      return {
        generatedContent: text,
        model: r.model ?? fallbackModel,
        inputTokens: r.usage?.input_tokens ?? 0,
        outputTokens: r.usage?.output_tokens ?? 0,
      };
    }

    case "openai": {
      const r = rawJson as {
        model?: string;
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const text = r.choices?.[0]?.message?.content ?? "";
      return {
        generatedContent: text,
        model: r.model ?? fallbackModel,
        inputTokens: r.usage?.prompt_tokens ?? 0,
        outputTokens: r.usage?.completion_tokens ?? 0,
      };
    }

    case "workers-ai": {
      // Workers AI wraps the response in ``{result, success, errors,
      // messages}``. Within ``result`` for OpenAI-compat, the shape is
      // identical to OpenAI chat/completions.
      const wrap = rawJson as {
        result?: unknown;
        choices?: unknown;
      };
      // If the gateway returned an OpenAI-shaped body directly (which
      // happens on /v1/chat/completions), prefer that.
      const inner =
        wrap.result !== undefined ? wrap.result : (wrap as unknown);
      const r = inner as {
        choices?: Array<{ message?: { content?: string }; text?: string }>;
        response?: string;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          input_tokens?: number;
          output_tokens?: number;
        };
      };
      const text =
        r.choices?.[0]?.message?.content ??
        r.choices?.[0]?.text ??
        r.response ??
        "";
      return {
        generatedContent: text,
        model: fallbackModel,
        inputTokens: r.usage?.prompt_tokens ?? r.usage?.input_tokens ?? 0,
        outputTokens:
          r.usage?.completion_tokens ?? r.usage?.output_tokens ?? 0,
      };
    }

    case "google-ai-studio": {
      const r = rawJson as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
        };
      };
      const parts = r.candidates?.[0]?.content?.parts ?? [];
      const text = parts.map((p) => p.text ?? "").join("");
      return {
        generatedContent: text,
        model: fallbackModel,
        inputTokens: r.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: r.usageMetadata?.candidatesTokenCount ?? 0,
      };
    }
  }
}


// ── Universal Endpoint (Layer 2: quota-aware fallback) ──────────────
//
// Cloudflare AI Gateway's Universal Endpoint accepts an array of
// per-provider request specs and tries each in order — the first 2xx
// wins, errors fall through to the next entry. Documented at
// https://developers.cloudflare.com/ai-gateway/universal/.
//
// We use it whenever the resolved chain has more than one model. When
// the chain has exactly one entry we fall back to the per-provider
// path (cheaper — no Universal Endpoint overhead).

interface UniversalEndpointEntry {
  provider: ProviderId;
  endpoint: string;
  headers: Record<string, string>;
  query: unknown;
}

export interface UniversalBuilt {
  /** The bare gateway base URL (no provider suffix appended). */
  url: string;
  body: string;
  /**
   * Order of providers in the chain — used by ``parseResponseAuto`` as
   * a tie-breaker hint when shape detection alone is ambiguous.
   */
  chain: ProviderId[];
}

/**
 * Build the request body for the AI Gateway Universal Endpoint.
 *
 * Each chain entry maps to one ``providerFor()`` route + that
 * provider's native body shape. Headers are split out of the
 * per-provider body (Universal Endpoint expects them as a separate
 * ``headers`` field on the array entry).
 */
export function buildUniversalRequest(
  baseUrl: string,
  req: ProviderRequest,
  models: string[],
  env: ProviderEnv,
): UniversalBuilt {
  if (models.length < 2) {
    throw new Error(
      "buildUniversalRequest requires a chain of at least 2 models",
    );
  }
  const base = stripLegacyAnthropicSuffix(baseUrl);

  const entries: UniversalEndpointEntry[] = [];
  const chain: ProviderId[] = [];

  for (const model of models) {
    // Re-use the per-provider builder to get headers + body shape, then
    // split the URL back into ``endpoint`` (the path under the provider
    // segment that Universal Endpoint expects).
    const built = buildRequest(baseUrl, { ...req, model }, env);
    const endpoint = perProviderEndpoint(built.provider, model, built.built.url, base);
    entries.push({
      provider: built.provider,
      endpoint,
      headers: built.built.headers,
      query: JSON.parse(built.built.body),
    });
    chain.push(built.provider);
  }

  return {
    url: base, // Universal Endpoint = bare gateway base.
    body: JSON.stringify(entries),
    chain,
  };
}

/**
 * Strip ``${base}/${provider}/`` off the front of a per-provider URL so
 * the remainder can go in the Universal Endpoint's ``endpoint`` field.
 */
function perProviderEndpoint(
  provider: ProviderId,
  model: string,
  perProviderUrl: string,
  base: string,
): string {
  const prefix = `${base}/${provider}/`;
  if (perProviderUrl.startsWith(prefix)) {
    return perProviderUrl.slice(prefix.length);
  }
  // Fallback: derive from provider conventions (defensive — ``base`` is
  // already stripped, so this is just belt-and-braces).
  switch (provider) {
    case "anthropic":
      return "v1/messages";
    case "openai":
      return "chat/completions";
    case "workers-ai":
      return model;
    case "google-ai-studio":
      return `v1/models/${model}:generateContent`;
  }
}

function gatewayAuthHeaders(env: ProviderEnv): Record<string, string> {
  return env.CF_AIG_TOKEN
    ? { "cf-aig-authorization": `Bearer ${env.CF_AIG_TOKEN}` }
    : {};
}

/**
 * Parse a Universal Endpoint response by detecting which provider's
 * native shape the body matches.
 *
 * Each provider's response has a unique top-level key, so detection is
 * unambiguous:
 *   Anthropic   → has ``content`` array AND ``usage.input_tokens``
 *   OpenAI      → has ``choices`` array AND ``usage.prompt_tokens``
 *   Gemini      → has ``candidates`` array
 *   Workers AI  → has ``result`` AND ``success`` keys (CF wrapper)
 *
 * ``hint`` (the chain order from buildUniversalRequest) is used only
 * when detection is ambiguous — in practice it never is, but it
 * guarantees deterministic fallback behaviour.
 */
export function parseResponseAuto(
  rawJson: unknown,
  fallbackModel: string,
  hint: ProviderId[] = [],
): ProviderResponse & { provider: ProviderId } {
  const r = rawJson as Record<string, unknown> | null;
  if (!r || typeof r !== "object") {
    throw new Error("parseResponseAuto: response is not a JSON object");
  }

  const detected: ProviderId | null =
    "candidates" in r
      ? "google-ai-studio"
      : "result" in r && "success" in r
        ? "workers-ai"
        : Array.isArray((r as { content?: unknown }).content) &&
            "usage" in r &&
            (r as { usage?: { input_tokens?: unknown } }).usage?.input_tokens !==
              undefined
          ? "anthropic"
          : "choices" in r
            ? "openai"
            : null;

  const provider = detected ?? hint[0];
  if (!provider) {
    throw new Error(
      `parseResponseAuto: cannot detect provider from response shape (top-level keys: ${Object.keys(
        r,
      ).join(", ")})`,
    );
  }

  return { ...parseResponse(provider, rawJson, fallbackModel), provider };
}
