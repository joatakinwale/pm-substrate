/**
 * stevie-mux-ingest — Cloudflare Worker (queue consumer)
 *
 * Replaces: backend/app/tasks/video_tasks.py::ingest_to_mux
 *
 * Flow:
 *   1. Consume MuxIngestMessage from the stevie-mux-ingest queue.
 *   2. Presign a 5-minute GET URL on R2 for the asset's r2_key.
 *   3. POST to https://api.mux.com/video/v1/assets with the signed URL,
 *      a public playback policy, and ``passthrough = asset_id`` so the
 *      downstream stevie-mux-webhook can correlate Mux's events back
 *      to our internal MediaAsset row.
 *   4. POST to FastAPI POST /api/internal/video/{asset_id}/mux-created
 *      with {org_id, mux_asset_id, mux_status} so the row is updated
 *      under RLS.
 *   5. ack() on success; retry() on Mux 5xx / network errors; permanent
 *      (-> ack so message goes to DLQ on next retry trip) on 4xx auth.
 *
 * Pattern mirrors stevie-stripe-sync. See workers/stripe-sync/src/index.ts
 * for the canonical reference.
 */
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  assertEnv,
  type BaseEnv,
  handleConsumerError,
  PermanentError,
  RetryableError,
  validateMessage,
  type MuxIngestMessage,
} from "@stevie/shared";
import { BackendCallError, BackendClient } from "@stevie/backend-client";

interface Env extends BaseEnv {
  MUX_TOKEN_ID: string;
  MUX_TOKEN_SECRET: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  /** R2 S3-compatible endpoint, e.g. https://<account-id>.r2.cloudflarestorage.com */
  R2_ENDPOINT: string;
  R2_BUCKET_NAME: string;
}

/** Presigned URL lifetime handed to Mux. Five minutes is plenty — Mux
 *  fetches the input immediately on asset creation, well before the URL
 *  goes stale. Keeping the window short limits replay surface area. */
const R2_PRESIGN_TTL_SECONDS = 300;

export default {
  async queue(
    batch: MessageBatch<unknown>,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    assertEnv<Env>(env, [
      "WEBHOOK_SECRET",
      "BACKEND_BASE_URL",
      "ENVIRONMENT",
      "MUX_TOKEN_ID",
      "MUX_TOKEN_SECRET",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_ENDPOINT",
      "R2_BUCKET_NAME",
    ]);

    // R2 speaks the S3 protocol verbatim. ``region: "auto"`` is what
    // Cloudflare's R2 docs prescribe for SigV4; the bucket itself is
    // global and the endpoint is the per-account R2 hostname.
    const s3 = new S3Client({
      region: "auto",
      endpoint: env.R2_ENDPOINT,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
    const backend = new BackendClient({
      baseUrl: env.BACKEND_BASE_URL,
      webhookSecret: env.WEBHOOK_SECRET,
    });

    for (const msg of batch.messages) {
      try {
        const payload = validateMessage<MuxIngestMessage>(
          msg.body,
          "mux.asset.ingest"
        );
        await ingestOne(payload, env, s3, backend);
        msg.ack();
      } catch (err) {
        handleConsumerError(msg, err);
      }
    }
  },
} satisfies ExportedHandler<Env>;

/**
 * Validate that the R2 key is shaped the way our upload pipeline produces
 * it. Defense-in-depth: even though `r2_key` comes from a row our backend
 * inserted, refusing pathological values here means a compromised or
 * mis-migrated row can't direct Mux to fetch from a sibling tenant's
 * prefix. The pipeline writes uploads under `uploads/<asset-uuid>/...`.
 */
const R2_KEY_PATTERN = /^uploads\/[0-9a-f-]{36}\/[\w./-]+$/;

async function ingestOne(
  payload: MuxIngestMessage,
  env: Env,
  s3: S3Client,
  backend: BackendClient
): Promise<void> {
  if (!R2_KEY_PATTERN.test(payload.r2_key)) {
    // Permanent — a malformed key won't get better on retry, and we
    // explicitly don't want to presign it. DLQ it for human triage.
    throw new PermanentError(
      `r2_key did not match the expected uploads/<uuid>/<file> shape: ${payload.r2_key}`
    );
  }

  // 1. Presign a GET URL on R2. SigV4 query-param presign — Mux fetches
  //    the URL anonymously, so the signature must travel in the URL itself.
  let signedUrl: string;
  try {
    const cmd = new GetObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: payload.r2_key,
    });
    signedUrl = await getSignedUrl(s3, cmd, {
      expiresIn: R2_PRESIGN_TTL_SECONDS,
    });
  } catch (err) {
    // A presign failure is almost certainly a config bug (bad endpoint,
    // wrong key). Treat as retryable so a transient DNS issue against R2
    // doesn't lose the message — but if it persists, max_retries trips it
    // to the DLQ for human triage.
    throw new RetryableError(
      `r2 presign failed: ${err instanceof Error ? err.message : String(err)}`,
      err
    );
  }

  // 2. Create the Mux asset.
  let muxAsset: MuxAsset;
  try {
    muxAsset = await createMuxAsset(env, signedUrl, payload.asset_id);
  } catch (err) {
    if (err instanceof MuxApiError) {
      // 4xx auth/validation → permanent. Retrying with the same payload
      // would just keep failing. 5xx / 429 / network → retryable.
      if (err.status === 401 || err.status === 403) {
        throw new PermanentError(
          `mux auth error ${err.status}: ${err.message}`,
          err
        );
      }
      if (err.status >= 400 && err.status < 500 && err.status !== 429) {
        throw new PermanentError(
          `mux client error ${err.status}: ${err.message}`,
          err
        );
      }
      throw new RetryableError(
        `mux server error ${err.status}: ${err.message}`,
        err
      );
    }
    throw new RetryableError(
      `mux call failed: ${err instanceof Error ? err.message : String(err)}`,
      err
    );
  }

  // 3. Record the new Mux ids on the MediaAsset row via FastAPI.
  try {
    await backend.markMuxAssetCreated({
      asset_id: payload.asset_id,
      org_id: payload.org_id,
      mux_asset_id: muxAsset.id,
      mux_status: muxAsset.status,
    });
  } catch (err) {
    if (err instanceof BackendCallError) {
      if (err.isRetryable) {
        throw new RetryableError(err.message, err);
      }
      throw new PermanentError(err.message, err);
    }
    throw new RetryableError(
      `backend call failed: ${err instanceof Error ? err.message : String(err)}`,
      err
    );
  }
}

// ── Mux API ─────────────────────────────────────────────────────────

interface MuxAsset {
  id: string;
  status: string;
}

class MuxApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "MuxApiError";
  }
}

/**
 * Create a Mux asset. Mux uses HTTP Basic auth on the access-token pair
 * (token_id:token_secret base64-encoded). We pin the request to the
 * documented endpoint and only return the id+status — anything else
 * (playback_ids, duration) shows up later on the ``video.asset.ready``
 * webhook, which is the source of truth.
 */
async function createMuxAsset(
  env: Env,
  inputUrl: string,
  passthrough: string
): Promise<MuxAsset> {
  const auth = btoa(`${env.MUX_TOKEN_ID}:${env.MUX_TOKEN_SECRET}`);
  const body = {
    input: inputUrl,
    playback_policy: ["public"],
    passthrough,
  };

  const res = await fetch("https://api.mux.com/video/v1/assets", {
    method: "POST",
    headers: {
      authorization: `Basic ${auth}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new MuxApiError(
      `${text.slice(0, 500) || "<empty body>"}`,
      res.status
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new MuxApiError(
      `unparseable JSON from Mux: ${text.slice(0, 200)}`,
      res.status
    );
  }
  const data = (parsed as { data?: { id?: unknown; status?: unknown } }).data;
  if (
    !data ||
    typeof data.id !== "string" ||
    typeof data.status !== "string"
  ) {
    throw new MuxApiError(
      `Mux response missing data.id/data.status: ${text.slice(0, 200)}`,
      res.status
    );
  }
  return { id: data.id, status: data.status };
}
