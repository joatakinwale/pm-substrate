/**
 * Liquid as a sync source (Liquid lane L2 — docs/liquid-integration-plan.md).
 *
 * The substrate reaches an upstream it has no connector for by driving the
 * Liquid sidecar over MCP — the REAL `liquid-mcp` tool vocabulary
 * (`liquid_connect` → adapter_id, `liquid_fetch` → typed records), never a
 * Python import (process boundary; AGPL sidecar).
 *
 * Authority stays here: Liquid's `target_model` is DERIVED FROM the app's
 * EntityMapping entry, so the mapping document remains the single source of
 * truth — Liquid learns how to fill the shape the mapping already declares.
 * Records come back keyed by source-field names and enter the same
 * idempotent `runEntityMappingSync`; zero new trust is granted. A
 * `review_needed` connect (Liquid could not confidently map the interface)
 * is an obstruction, not a fallback — it throws, and lane L3 turns it into
 * a mapping proposal for the owner to admit.
 */

import { z } from "zod";

import type { EntityMapping } from "@pm/entity-mapping";

import type { SourceRecord } from "./sync-runner.js";

/**
 * Structural slice of an MCP client (`@modelcontextprotocol/sdk` Client
 * satisfies it). Tests substitute a scripted fake; the kit never depends on
 * the SDK itself.
 */
export interface LiquidMcpClient {
  callTool(params: {
    name: string;
    arguments: Record<string, unknown>;
  }): Promise<unknown>;
}

export class LiquidSourceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "tool_error"
      | "review_needed"
      | "bad_response"
      | "unknown_entity",
  ) {
    super(message);
    this.name = "LiquidSourceError";
  }
}

/**
 * Liquid's `target_model` for one mapping entry: every source-side field the
 * mapping reads (identityFields are already source names; fieldMap VALUES are
 * the source names behind profile aliases; optionalFields ride along). Types
 * default to "str" — the substrate's profile validation is the type authority,
 * not Liquid's coercion.
 */
export function deriveTargetModel(
  mapping: EntityMapping,
  sourceName: string,
): Record<string, string> {
  const entry = mapping.entities[sourceName];
  if (!entry) {
    throw new LiquidSourceError(
      `entity "${sourceName}" is not declared in mapping`,
      "unknown_entity",
    );
  }
  const fields = [
    ...entry.identityFields,
    ...Object.values(entry.fieldMap ?? {}),
    ...(entry.optionalFields ?? []),
  ];
  return Object.fromEntries([...new Set(fields)].map((f) => [f, "str"]));
}

const callToolResultSchema = z
  .object({
    isError: z.boolean().optional(),
    structuredContent: z.record(z.unknown()).optional(),
    content: z
      .array(z.object({ type: z.string(), text: z.string().optional() }).passthrough())
      .optional(),
  })
  .passthrough();

const connectResultSchema = z
  .object({
    status: z.string(),
    adapter_id: z.string().min(1).optional(),
  })
  .passthrough();

const fetchResultSchema = z
  .object({
    records: z.number().optional(),
    data: z.unknown(),
  })
  .passthrough();

/** Unwrap an MCP CallToolResult into its structured payload (or throw). */
function unwrap(raw: unknown, tool: string): Record<string, unknown> {
  const result = callToolResultSchema.parse(raw);
  const text = result.content?.find((c) => c.type === "text")?.text;
  if (result.isError) {
    throw new LiquidSourceError(
      `${tool} failed: ${text ?? "(no error text)"}`,
      "tool_error",
    );
  }
  // Real-sidecar behavior (found live 2026-07-06): failures can come back as
  // isError:false with an `error` string in structuredContent. Treat that as
  // the tool error it is — never let an error payload flow into a parser.
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
  throw new LiquidSourceError(
    `${tool} returned no structured payload`,
    "bad_response",
  );
}

export interface LiquidFetchOptions {
  /** Upstream the sidecar should learn/reuse (URL, GraphQL, DSN…). */
  readonly url: string;
  /** Mapping entity whose declared fields become the target_model. */
  readonly sourceName: string;
  readonly mapping: EntityMapping;
  /** Source field carrying the app's stable record id. */
  readonly externalIdField: string;
  /** Optional endpoint/path within the adapter for liquid_fetch. */
  readonly endpoint?: string;
  /** Passed through to liquid_connect (stored by the sidecar, not by us). */
  readonly credentials?: Readonly<Record<string, string>>;
}

export interface LiquidFetchResult {
  readonly records: readonly SourceRecord[];
  /** Rows Liquid returned without the externalIdField — excluded, counted. */
  readonly skippedMissingId: number;
  readonly adapterId: string;
}

/**
 * connect (idempotent on the sidecar) → fetch → SourceRecord[].
 * `review_needed` throws: an interface Liquid could not confidently map must
 * go through the mapping-proposal gate (L3), never silently into sync.
 */
export async function fetchLiquidRecords(
  client: LiquidMcpClient,
  options: LiquidFetchOptions,
): Promise<LiquidFetchResult> {
  // The external id MUST be part of the requested model — Liquid returns
  // exactly the target_model fields, and a record we cannot identify cannot
  // sync (found live 2026-07-06: all rows skipped for missing ids).
  const targetModel = {
    ...deriveTargetModel(options.mapping, options.sourceName),
    [options.externalIdField]: "str",
  };
  const connected = connectResultSchema.parse(
    unwrap(
      await client.callTool({
        name: "liquid_connect",
        arguments: {
          url: options.url,
          target_model: targetModel,
          ...(options.credentials ? { credentials: options.credentials } : {}),
        },
      }),
      "liquid_connect",
    ),
  );
  if (connected.status !== "connected") {
    throw new LiquidSourceError(
      `liquid_connect returned status "${connected.status}" for ${options.url} — the proposed interface map needs review before sync (lane L3).`,
      "review_needed",
    );
  }
  if (connected.adapter_id === undefined) {
    throw new LiquidSourceError(
      `liquid_connect returned status "connected" without adapter_id for ${options.url}`,
      "bad_response",
    );
  }

  const fetched = fetchResultSchema.parse(
    unwrap(
      await client.callTool({
        name: "liquid_fetch",
        arguments: {
          adapter_id: connected.adapter_id,
          ...(options.endpoint ? { endpoint: options.endpoint } : {}),
        },
      }),
      "liquid_fetch",
    ),
  );
  const rows = Array.isArray(fetched.data)
    ? (fetched.data as readonly Record<string, unknown>[])
    : fetched.data && typeof fetched.data === "object"
      ? [fetched.data as Record<string, unknown>]
      : [];

  let skippedMissingId = 0;
  const records: SourceRecord[] = [];
  for (const row of rows) {
    const id = row[options.externalIdField];
    if (id === undefined || id === null || String(id) === "") {
      skippedMissingId += 1;
      continue;
    }
    records.push({
      sourceName: options.sourceName,
      externalId: String(id),
      row,
    });
  }
  return { records, skippedMissingId, adapterId: connected.adapter_id };
}
