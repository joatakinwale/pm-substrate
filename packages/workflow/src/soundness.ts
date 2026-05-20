import { WorkflowValidationError } from "./errors.js";
import type { WorkflowDoc, WorkflowEdge, WorkflowNode } from "./interfaces.js";

export interface WorkflowSoundnessReport {
  readonly workflowName: string;
  readonly workflowVersion: number;
  readonly triggerNodeIds: readonly string[];
  readonly terminalNodeIds: readonly string[];
  readonly unreachableNodeIds: readonly string[];
  readonly deadlockNodeIds: readonly string[];
  readonly nonTerminatingCycleNodeIds: readonly string[];
  readonly duplicateNodeIds: readonly string[];
  readonly invalidEdgeRefs: readonly WorkflowEdge[];
  readonly sound: boolean;
}

const unique = (xs: Iterable<string>): string[] => [...new Set(xs)].sort();

const nodeMapOf = (nodes: readonly WorkflowNode[]): { map: Map<string, WorkflowNode>; duplicates: string[] } => {
  const map = new Map<string, WorkflowNode>();
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const n of nodes) {
    if (seen.has(n.nodeId)) duplicates.push(n.nodeId);
    seen.add(n.nodeId);
    map.set(n.nodeId, n);
  }
  return { map, duplicates: unique(duplicates) };
};

export function analyzeWorkflowSoundness(doc: WorkflowDoc): WorkflowSoundnessReport {
  const { map: nodesById, duplicates } = nodeMapOf(doc.nodes);
  const triggerNodeIds = unique(doc.nodes.filter((n) => n.kind === "trigger").map((n) => n.nodeId));
  const invalidEdgeRefs = doc.edges.filter((e) => !nodesById.has(e.from) || !nodesById.has(e.to));

  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const n of doc.nodes) {
    outgoing.set(n.nodeId, []);
    incoming.set(n.nodeId, []);
  }
  for (const e of doc.edges) {
    if (!nodesById.has(e.from) || !nodesById.has(e.to)) continue;
    outgoing.get(e.from)!.push(e.to);
    incoming.get(e.to)!.push(e.from);
  }

  const reachable = new Set<string>();
  const stack = [...triggerNodeIds];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const next of outgoing.get(id) ?? []) stack.push(next);
  }

  const terminalNodeIds = unique(
    doc.nodes
      .filter((n) => reachable.has(n.nodeId) && n.kind === "invoke" && (outgoing.get(n.nodeId)?.length ?? 0) === 0)
      .map((n) => n.nodeId),
  );

  const canReachTerminal = new Set<string>();
  const reverseStack = [...terminalNodeIds];
  while (reverseStack.length > 0) {
    const id = reverseStack.pop()!;
    if (canReachTerminal.has(id)) continue;
    canReachTerminal.add(id);
    for (const prev of incoming.get(id) ?? []) reverseStack.push(prev);
  }

  const unreachableNodeIds = unique(doc.nodes.filter((n) => !reachable.has(n.nodeId)).map((n) => n.nodeId));
  const deadlockNodeIds = unique(
    doc.nodes
      .filter((n) => reachable.has(n.nodeId) && n.kind === "invoke" && !canReachTerminal.has(n.nodeId))
      .map((n) => n.nodeId),
  );
  const nonTerminatingCycleNodeIds = unique(findCycleNodes(doc.nodes, doc.edges).filter((id) => reachable.has(id) && !canReachTerminal.has(id)));

  return {
    workflowName: doc.name,
    workflowVersion: doc.version,
    triggerNodeIds,
    terminalNodeIds,
    unreachableNodeIds,
    deadlockNodeIds,
    nonTerminatingCycleNodeIds,
    duplicateNodeIds: duplicates,
    invalidEdgeRefs,
    sound:
      triggerNodeIds.length > 0 &&
      terminalNodeIds.length > 0 &&
      duplicates.length === 0 &&
      invalidEdgeRefs.length === 0 &&
      unreachableNodeIds.length === 0 &&
      deadlockNodeIds.length === 0 &&
      nonTerminatingCycleNodeIds.length === 0,
  };
}

export function assertWorkflowSound(doc: WorkflowDoc): void {
  const report = analyzeWorkflowSoundness(doc);
  if (report.sound) return;
  const reasons: string[] = [];
  if (report.triggerNodeIds.length === 0) reasons.push("no trigger node");
  if (report.terminalNodeIds.length === 0) reasons.push("no reachable terminal invoke node");
  if (report.duplicateNodeIds.length) reasons.push(`duplicate nodes: ${report.duplicateNodeIds.join(", ")}`);
  if (report.invalidEdgeRefs.length) reasons.push(`invalid edge refs: ${report.invalidEdgeRefs.map((e) => `${e.from}->${e.to}`).join(", ")}`);
  if (report.unreachableNodeIds.length) reasons.push(`unreachable nodes: ${report.unreachableNodeIds.join(", ")}`);
  if (report.deadlockNodeIds.length) reasons.push(`deadlock nodes: ${report.deadlockNodeIds.join(", ")}`);
  if (report.nonTerminatingCycleNodeIds.length) reasons.push(`non-terminating cycles include: ${report.nonTerminatingCycleNodeIds.join(", ")}`);
  throw new WorkflowValidationError(
    `workflow "${doc.name}" v${doc.version} is unsound: ${reasons.join("; ")}`,
  );
}

function findCycleNodes(nodes: readonly WorkflowNode[], edges: readonly WorkflowEdge[]): string[] {
  const nodeIds = new Set(nodes.map((n) => n.nodeId));
  const adjacency = new Map<string, string[]>();
  for (const id of nodeIds) adjacency.set(id, []);
  for (const e of edges) {
    if (nodeIds.has(e.from) && nodeIds.has(e.to)) adjacency.get(e.from)!.push(e.to);
  }

  const index = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const cycleNodes: string[] = [];
  let nextIndex = 0;

  const strongConnect = (v: string): void => {
    index.set(v, nextIndex);
    lowlink.set(v, nextIndex);
    nextIndex++;
    stack.push(v);
    onStack.add(v);

    for (const w of adjacency.get(v) ?? []) {
      if (!index.has(w)) {
        strongConnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, index.get(w)!));
      }
    }

    if (lowlink.get(v) === index.get(v)) {
      const component: string[] = [];
      while (true) {
        const w = stack.pop()!;
        onStack.delete(w);
        component.push(w);
        if (w === v) break;
      }
      if (component.length > 1 || (adjacency.get(v) ?? []).includes(v)) {
        cycleNodes.push(...component);
      }
    }
  };

  for (const id of nodeIds) {
    if (!index.has(id)) strongConnect(id);
  }
  return unique(cycleNodes);
}
