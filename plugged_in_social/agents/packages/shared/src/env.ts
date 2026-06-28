/**
 * Common env-binding shape for Workers.
 *
 * Each Worker extends this with its own bindings (queues, KV, R2, Stripe key, etc.).
 * Validate at boot via `assertEnv()` so a misconfigured deploy fails loudly
 * instead of silently dropping messages.
 */

export interface BaseEnv {
  /** Shared header secret used by Workers when calling FastAPI internal endpoints. Must match backend WEBHOOK_SECRET. */
  WEBHOOK_SECRET: string;
  /** Public base URL of the FastAPI backend, e.g. https://api.stevie.social. No trailing slash. */
  BACKEND_BASE_URL: string;
  /** "production" | "staging" | "development". Drives logging verbosity and DLQ behavior. */
  ENVIRONMENT: "production" | "staging" | "development";
}

/**
 * Throws at startup if any required key is missing or empty. Call this from
 * the Worker's queue() / fetch() / scheduled() handler before doing anything
 * else; a misconfigured Worker should fail visibly, not silently 200.
 */
export function assertEnv<T extends BaseEnv>(env: unknown, required: (keyof T)[]): T {
  if (typeof env !== "object" || env === null) {
    throw new Error("env binding is not an object");
  }
  const e = env as Record<string, unknown>;
  const missing: string[] = [];
  for (const key of required) {
    const value = e[key as string];
    if (typeof value !== "string" || value.length === 0) {
      missing.push(String(key));
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Worker env missing required bindings: ${missing.join(", ")}`
    );
  }
  return env as T;
}
