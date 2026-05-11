/**
 * Read-staleness helpers (ADR-0025 / G12).
 *
 * Substrate reads already carry `createdAt` and `updatedAt`. What they don't
 * surface explicitly is **age** — how stale the read is at the moment it's
 * consumed. Callers compute it ad-hoc with `Date.now() - new Date(node.updatedAt).getTime()`
 * scattered across the codebase. This module centralizes it.
 *
 * Why this is its own module:
 *   - The discovery-engine pattern (research/discovery-engine/SPEC.md) requires
 *     evidence reads to know their own age so downstream gates can make
 *     age-aware decisions ("this hypothesis evidence is 47 days old; demote
 *     to speculative").
 *   - Capabilities watching the graph need a uniform way to ask "is this
 *     fact stale enough that I should re-resolve from upstream?" without
 *     each capability reinventing the math.
 *   - The recall-guard plugin (workspace `.openclaw/plugins/recall-guard/`)
 *     does the same thing for assistant context. This is its substrate
 *     analog at the graph-read boundary.
 *
 * No new external API surface. `GraphReader` is unchanged. Callers that
 * want staleness import these helpers explicitly.
 */

import type { Edge, NodeBase, Timestamp } from "@pm/types";

/**
 * A read snapshot, age-stamped. `readAt` is the clock at the moment the
 * helper was invoked; `ageMs` is `readAt - source.updatedAt` clamped to
 * non-negative.
 *
 * The shape mirrors the discovery-engine SPEC's Gate-5 / Gate-6
 * provenance discipline: every claim traces to a span, and every span
 * carries a timestamp.
 */
export interface ReadStaleness {
  /** ISO-8601 timestamp the staleness was computed at (process clock). */
  readonly readAt: Timestamp;
  /** When the underlying record was last modified. */
  readonly modifiedAt: Timestamp;
  /** Non-negative age in milliseconds. */
  readonly ageMs: number;
}

/**
 * Compute staleness for any record that exposes an `updatedAt` field.
 * Works for nodes, edges, and any future substrate record carrying the
 * same convention.
 *
 * Returns `null` for null/undefined inputs so callers don't need a
 * pre-check; this is idiomatic for the substrate's `getNode(...) | null`
 * pattern.
 */
export function readStalenessOf(
  source: { readonly updatedAt: Timestamp } | null | undefined,
  clock: () => Date = () => new Date(),
): ReadStaleness | null {
  if (!source) return null;
  const now = clock();
  const updated = new Date(source.updatedAt);
  // Defensive: clock skew / future-dated rows would otherwise produce
  // negative ageMs. Clamp at zero.
  const ageMs = Math.max(0, now.getTime() - updated.getTime());
  return {
    readAt: now.toISOString() as Timestamp,
    modifiedAt: source.updatedAt,
    ageMs,
  };
}

/**
 * Convenience: pair a node with its staleness. Returns null if input is null.
 *
 * Common usage in a capability handler:
 *
 *   const { node, staleness } = withNodeStaleness(await graph.getNode(t, id)) ?? {};
 *   if (staleness && staleness.ageMs > MAX_AGE_MS) {
 *     // re-resolve from upstream / mark hypothesis speculative
 *   }
 */
export function withNodeStaleness(
  node: NodeBase | null,
  clock: () => Date = () => new Date(),
): { node: NodeBase; staleness: ReadStaleness } | null {
  if (!node) return null;
  const staleness = readStalenessOf(node, clock);
  if (!staleness) return null;
  return { node, staleness };
}

/**
 * Same shape for edges.
 */
export function withEdgeStaleness(
  edge: Edge | null,
  clock: () => Date = () => new Date(),
): { edge: Edge; staleness: ReadStaleness } | null {
  if (!edge) return null;
  const staleness = readStalenessOf(edge, clock);
  if (!staleness) return null;
  return { edge, staleness };
}

/**
 * Annotate every edge in a list. Convenience for `outgoingEdges` /
 * `incomingEdges` result sets.
 */
export function withEdgeListStaleness(
  edges: readonly Edge[],
  clock: () => Date = () => new Date(),
): ReadonlyArray<{ edge: Edge; staleness: ReadStaleness }> {
  const now = clock();
  return edges.map((edge) => ({
    edge,
    staleness: {
      readAt: now.toISOString() as Timestamp,
      modifiedAt: edge.updatedAt,
      ageMs: Math.max(0, now.getTime() - new Date(edge.updatedAt).getTime()),
    },
  }));
}

/**
 * Threshold predicate. True if `staleness.ageMs > maxAgeMs`.
 * Capabilities can wire this into their resolution logic directly.
 */
export function isStale(
  staleness: ReadStaleness,
  maxAgeMs: number,
): boolean {
  return staleness.ageMs > maxAgeMs;
}
