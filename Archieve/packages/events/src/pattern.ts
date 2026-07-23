/**
 * Glob → predicate for event-type matching.
 *
 * Supported syntax (intentionally minimal):
 *   "task.created"     — exact match
 *   "task.*"           — match anything in the `task` namespace
 *   "*.created"        — match any namespace's `created` event
 *   "*"                — match everything
 *
 * Multi-segment wildcards (e.g. "**") are NOT supported. Two-level dotted
 * topics keep the model and the SQL LIKE translation honest. If a profile
 * needs deeper nesting, that's a smell — flatten the type name instead.
 */
export const matchesPattern = (pattern: string, type: string): boolean => {
  if (pattern === "*" || pattern === "*.*") return true;
  if (pattern === type) return true;
  if (!pattern.includes("*")) return false;

  const [pHead, pTail, ...pRest] = pattern.split(".");
  const [tHead, tTail, ...tRest] = type.split(".");
  if (pRest.length || tRest.length) return false; // only 2-level topics
  if (pHead !== "*" && pHead !== tHead) return false;
  if (pTail !== "*" && pTail !== tTail) return false;
  return true;
};

/**
 * Translate a glob pattern into a SQL LIKE expression for the events table.
 * Only the same minimal syntax above is supported.
 */
export const patternToSqlLike = (pattern: string): string => {
  if (pattern === "*" || pattern === "*.*") return "%";
  if (!pattern.includes("*")) return pattern;
  return pattern.replace(/\*/g, "%");
};
