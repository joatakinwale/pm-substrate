/**
 * Same minimal glob grammar as @pm/events:
 *   "task.created" | "task.*" | "*.created" | "*"
 *   "agency.lead.qualified" | "agency.lead.*" | "agency.*.qualified"
 *
 * Supports arbitrary segment counts (segments separated by ".").
 * A `*` matches any single segment. A bare `*` matches anything.
 *
 * Duplicated here (vs imported from @pm/events) so registry doesn't depend
 * on events. The grammar is the substrate-wide standard; if it ever changes,
 * the change lands in both packages and is enforced by a shared test fixture.
 *
 * History: an earlier 2-segment-only implementation silently mismatched
 * 3-segment topics like "agency.lead.qualified" against
 * "agency.lead.*" (returning false). Surfaced by the G6 contract-
 * validation tests (ADR-0013). Fixed here to handle arbitrary segment counts.
 */
export const matchesPattern = (pattern: string, type: string): boolean => {
  if (pattern === "*") return true;
  if (pattern === type) return true;
  if (!pattern.includes("*")) return false;

  const pSegs = pattern.split(".");
  const tSegs = type.split(".");
  if (pSegs.length !== tSegs.length) return false;

  for (let i = 0; i < pSegs.length; i++) {
    const p = pSegs[i];
    if (p === "*") continue;
    if (p !== tSegs[i]) return false;
  }
  return true;
};
