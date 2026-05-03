/**
 * Same minimal glob grammar as @pm/events:
 *   "task.created" | "task.*" | "*.created" | "*"
 *
 * Duplicated here (vs imported from @pm/events) so registry doesn't depend
 * on events. The grammar is the substrate-wide standard; if it ever changes,
 * the change lands in both packages and is enforced by a shared test fixture.
 */
export const matchesPattern = (pattern: string, type: string): boolean => {
  if (pattern === "*" || pattern === "*.*") return true;
  if (pattern === type) return true;
  if (!pattern.includes("*")) return false;

  const [pHead, pTail, ...pRest] = pattern.split(".");
  const [tHead, tTail, ...tRest] = type.split(".");
  if (pRest.length || tRest.length) return false;
  if (pHead !== "*" && pHead !== tHead) return false;
  if (pTail !== "*" && pTail !== tTail) return false;
  return true;
};
