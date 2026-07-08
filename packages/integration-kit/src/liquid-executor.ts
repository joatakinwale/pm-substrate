/**
 * Liquid write transport (lane L4): the executor bridge's delivery leg for
 * backends without an HTTP endpoint — databases and anything else the
 * sidecar can reach. The bridge keeps ALL governance (accepted-only,
 * outcomeHash dedupe, refuse/fail lanes); this leg only carries the
 * admitted payload:
 *
 *   liquid_connect (idempotent) → liquid_execute {adapter_id, op, values, where}
 *
 * Defense in depth: the sidecar refuses writes unless started with
 * LIQUID_ALLOW_WRITES=1, `update`/`delete` require a non-empty `where`
 * upstream, and every value is parameterized — but the substrate's
 * write_gate never relies on that; a blocked envelope dies in the bridge
 * before this function is ever called.
 */

import { z } from "zod";

import type { ExecutorTransport } from "./executor-bridge.js";
import { LiquidSourceError, type LiquidMcpClient } from "./liquid-source.js";

const callToolResultSchema = z
  .object({
    isError: z.boolean().optional(),
    structuredContent: z.record(z.unknown()).optional(),
    content: z
      .array(z.object({ type: z.string(), text: z.string().optional() }).passthrough())
      .optional(),
  })
  .passthrough();

const connectSchema = z
  .object({ status: z.string(), adapter_id: z.string().min(1).optional() })
  .passthrough();

const executeSchema = z
  .object({
    success: z.boolean(),
    op: z.string().optional(),
    affected_rows: z.number().optional(),
  })
  .passthrough();

function unwrap(raw: unknown, tool: string): Record<string, unknown> {
  const result = callToolResultSchema.parse(raw);
  const text = result.content?.find((c) => c.type === "text")?.text;
  if (result.isError) {
    throw new LiquidSourceError(
      `${tool} failed: ${text ?? "(no error text)"}`,
      "tool_error",
    );
  }
  // Real sidecar errors can arrive as a successful MCP call carrying an error
  // payload. Keep those out of Zod parsers so the bridge records an ordinary
  // transport obstruction instead of surfacing a parser crash.
  if (
    result.structuredContent &&
    typeof result.structuredContent["error"] === "string"
  ) {
    throw new LiquidSourceError(
      `${tool} failed: ${result.structuredContent["error"]}`,
      "tool_error",
    );
  }
  if (result.structuredContent) return result.structuredContent;
  if (text !== undefined) {
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      /* fall through */
    }
  }
  throw new LiquidSourceError(`${tool} returned no structured payload`, "bad_response");
}

export interface LiquidWriteTransportOptions {
  /** Target DSN/URL the sidecar connects to (postgres://…, etc.). */
  readonly url: string;
  /** target_model for the idempotent connect (columns the write touches). */
  readonly targetModel: Readonly<Record<string, string>>;
  /** Table/endpoint path within the adapter. */
  readonly endpoint?: string;
  readonly op: "insert" | "update" | "delete";
  readonly credentials?: Readonly<Record<string, string>>;
}

/**
 * Build the delivery leg. The admitted payload's `body` supplies `values`
 * and (for update/delete) `where`; everything else about the envelope rides
 * along only in the bridge's own events, never into the target.
 */
export function buildLiquidWriteTransport(
  client: LiquidMcpClient,
  options: LiquidWriteTransportOptions,
): ExecutorTransport {
  return async (payload) => {
    const connected = connectSchema.parse(
      unwrap(
        await client.callTool({
          name: "liquid_connect",
          arguments: {
            url: options.url,
            target_model: options.targetModel,
            ...(options.credentials ? { credentials: options.credentials } : {}),
          },
        }),
        "liquid_connect",
      ),
    );
    if (connected.status !== "connected") {
      return {
        ok: false,
        detail: `liquid_connect status "${connected.status}" — interface map needs review (lane L3)`,
      };
    }
    if (connected.adapter_id === undefined) {
      return {
        ok: false,
        detail: `liquid_connect returned status "connected" without adapter_id for ${options.url}`,
      };
    }
    const body = (payload["body"] ?? {}) as {
      values?: Readonly<Record<string, unknown>>;
      where?: Readonly<Record<string, unknown>>;
    };
    const executed = executeSchema.parse(
      unwrap(
        await client.callTool({
          name: "liquid_execute",
          arguments: {
            adapter_id: connected.adapter_id,
            op: options.op,
            ...(options.endpoint ? { endpoint: options.endpoint } : {}),
            ...(body.values ? { values: body.values } : {}),
            ...(body.where ? { where: body.where } : {}),
          },
        }),
        "liquid_execute",
      ),
    );
    return executed.success
      ? { ok: true, detail: `affected_rows=${executed.affected_rows ?? "?"}` }
      : { ok: false, detail: "liquid_execute reported success=false" };
  };
}
