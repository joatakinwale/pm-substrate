/**
 * G8.1 — Workflow cycle detection at install time.
 *
 * Workflow docs are intended to be DAGs: a trigger fans out through invoke
 * nodes following directed edges, with optional `when` guards. Day-1 install
 * never enforced acyclicity, which meant a malformed doc with `a -> b -> a`
 * would pass validation, install, and only blow up at runtime — and even
 * then the bug would manifest as runaway recursion through the runtime's
 * depth-first walker.
 *
 * This module exposes a pure detector. Iterative DFS (no recursion, so it
 * survives pathological docs without exploding the JS stack). On the first
 * back-edge, throws a `WorkflowValidationError` whose message names the
 * cycle path so authors can find it.
 *
 * Why iterative: workflows can in principle be wide. A recursive walker is
 * fine for sane docs but is the wrong default for substrate validators.
 *
 * Algorithm: standard 3-color DFS — WHITE (unvisited), GRAY (on stack),
 * BLACK (done). Encountering a GRAY neighbor = back-edge = cycle. We carry
 * the current path so the error message can report
 *   "n1 -> n2 -> n3 -> n1"
 * rather than just "cycle present somewhere".
 *
 * NOTE: edges referencing undeclared nodes are caught upstream in
 * `install()` before this runs. We treat any unknown neighbor as already
 * BLACK (i.e. ignore it) to keep this function focused on cycles.
 */

import { WorkflowValidationError } from "./errors.js";
import type { WorkflowDoc, WorkflowEdge, WorkflowNode } from "./interfaces.js";

type Color = 0 | 1 | 2; // 0=WHITE, 1=GRAY, 2=BLACK

interface Frame {
  readonly nodeId: string;
  /** Index of the next outgoing edge to explore from this node. */
  cursor: number;
}

export interface CycleDetectionInput {
  readonly nodes: readonly WorkflowNode[];
  readonly edges: readonly WorkflowEdge[];
  readonly workflowName: string;
  readonly workflowVersion: number;
}

/**
 * Detects directed cycles in a workflow's edge set. Returns nothing on
 * success; throws `WorkflowValidationError` if a cycle is found.
 */
export function assertAcyclic(input: CycleDetectionInput): void {
  const { nodes, edges, workflowName, workflowVersion } = input;

  // Build adjacency list keyed by nodeId. Preserve declaration order so
  // error messages are deterministic across runs.
  const adjacency = new Map<string, string[]>();
  for (const n of nodes) adjacency.set(n.nodeId, []);
  for (const e of edges) {
    const list = adjacency.get(e.from);
    // Edges referencing undeclared `from` should have been caught earlier
    // in install(); be defensive and ignore here.
    if (!list) continue;
    if (adjacency.has(e.to)) list.push(e.to);
  }

  const color = new Map<string, Color>();
  for (const n of nodes) color.set(n.nodeId, 0);

  for (const start of nodes) {
    if (color.get(start.nodeId) !== 0) continue;

    // Iterative DFS. `stack` mirrors the recursion stack; `pathSet`
    // tracks GRAY nodes as a set for O(1) cycle lookup.
    const stack: Frame[] = [{ nodeId: start.nodeId, cursor: 0 }];
    const pathSet = new Set<string>([start.nodeId]);
    color.set(start.nodeId, 1);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      const neighbors = adjacency.get(frame.nodeId) ?? [];

      if (frame.cursor >= neighbors.length) {
        // Done exploring this node — pop and mark BLACK.
        color.set(frame.nodeId, 2);
        pathSet.delete(frame.nodeId);
        stack.pop();
        continue;
      }

      const next = neighbors[frame.cursor++]!;
      const c = color.get(next);

      if (c === 1) {
        // Back-edge: `next` is on the current DFS path. Reconstruct the
        // cycle by walking the stack until we see `next`.
        const cycleNodes: string[] = [];
        let recording = false;
        for (const f of stack) {
          if (!recording && f.nodeId === next) recording = true;
          if (recording) cycleNodes.push(f.nodeId);
        }
        cycleNodes.push(next); // close the loop visually
        throw new WorkflowValidationError(
          `workflow "${workflowName}" v${workflowVersion} contains a cycle: ${cycleNodes.join(" -> ")}`,
        );
      }

      if (c === 0) {
        color.set(next, 1);
        pathSet.add(next);
        stack.push({ nodeId: next, cursor: 0 });
      }
      // c === 2: already fully explored; skip.
    }
  }
}

/**
 * Convenience wrapper that takes a full WorkflowDoc.
 */
export function assertWorkflowAcyclic(doc: WorkflowDoc): void {
  assertAcyclic({
    nodes: doc.nodes,
    edges: doc.edges,
    workflowName: doc.name,
    workflowVersion: doc.version,
  });
}
