/**
 * stevie-queue-producer — Cloudflare Worker (HTTP → Queue bridge)
 *
 * FastAPI runs on DigitalOcean and cannot use Cloudflare Queue bindings
 * directly. This Worker exposes one HTTP endpoint per queue:
 *
 *   POST /enqueue/{queue_slug}
 *   Body: any JSON message (must satisfy the BaseMessage contract from
 *         @stevie/shared — type, org_id, idempotency_key, emitted_at)
 *
 * Auth: shared `X-Webhook-Secret` header, same as the existing FastAPI
 * internal endpoints. Mismatch → 401, no message published.
 *
 * Why a Worker and not direct Queues HTTP API: routing one endpoint per
 * queue keeps producer code in FastAPI cleanly typed and avoids handing
 * FastAPI a direct API token to all queues.
 */
import { assertEnv, type BaseEnv } from "@stevie/shared";

interface Env extends BaseEnv {
  /** Cloudflare Queue bindings — one per supported queue. */
  QUEUE_STRIPE_SYNC: Queue<unknown>;
  QUEUE_EMAIL_SENDER: Queue<unknown>;
  QUEUE_MUX_INGEST: Queue<unknown>;
  QUEUE_AI_CONTENT: Queue<unknown>;
  QUEUE_REPORT_BUILDER: Queue<unknown>;
  QUEUE_AUTOMATION_RUNNER: Queue<unknown>;
  QUEUE_SOCIAL_PUBLISHER: Queue<unknown>;
  QUEUE_VIRTUAL_AGENCY: Queue<unknown>;
  // Add more bindings here as queues ship. Each must also be declared
  // in wrangler.toml under [[queues.producers]] AND added to
  // QUEUE_BINDINGS below.
}

/** Map URL slug → binding name. Acts as the allow-list of producers. */
const QUEUE_BINDINGS: Record<string, keyof Env> = {
  "stevie-stripe-sync": "QUEUE_STRIPE_SYNC",
  "stevie-email-sender": "QUEUE_EMAIL_SENDER",
  "stevie-mux-ingest": "QUEUE_MUX_INGEST",
  "stevie-ai-content": "QUEUE_AI_CONTENT",
  "stevie-report-builder": "QUEUE_REPORT_BUILDER",
  "stevie-automation-runner": "QUEUE_AUTOMATION_RUNNER",
  "stevie-social-publisher": "QUEUE_SOCIAL_PUBLISHER",
  "stevie-virtual-agency": "QUEUE_VIRTUAL_AGENCY",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    assertEnv<Env>(env, ["WEBHOOK_SECRET", "ENVIRONMENT"]);

    if (request.method !== "POST") {
      return jsonError(405, "method not allowed");
    }

    const url = new URL(request.url);
    const match = url.pathname.match(/^\/enqueue\/([a-z0-9-]+)\/?$/);
    if (!match) {
      return jsonError(404, "unknown route — expected /enqueue/{queue}");
    }
    const queueSlug = match[1] as string;

    const got = request.headers.get("x-webhook-secret");
    if (!got || got !== env.WEBHOOK_SECRET) {
      return jsonError(401, "invalid webhook secret");
    }

    const bindingName = QUEUE_BINDINGS[queueSlug];
    if (!bindingName) {
      return jsonError(
        404,
        `queue ${queueSlug} is not configured on this producer`
      );
    }

    const queue = env[bindingName] as unknown as Queue<unknown> | undefined;
    if (!queue || typeof queue.send !== "function") {
      return jsonError(
        500,
        `binding ${String(bindingName)} is not a queue producer`
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError(400, "body is not valid JSON");
    }

    if (
      typeof body !== "object" ||
      body === null ||
      typeof (body as Record<string, unknown>)["type"] !== "string" ||
      typeof (body as Record<string, unknown>)["org_id"] !== "string" ||
      typeof (body as Record<string, unknown>)["idempotency_key"] !== "string"
    ) {
      return jsonError(
        400,
        "body must be a JSON object with type, org_id, idempotency_key"
      );
    }

    await queue.send(body);
    return new Response(null, { status: 202 });
  },
} satisfies ExportedHandler<Env>;

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
