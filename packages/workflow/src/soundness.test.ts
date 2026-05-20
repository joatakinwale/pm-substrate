import { describe, expect, it } from "vitest";
import type { TenantId, WorkflowId } from "@pm/types";
import type { WorkflowDoc } from "./interfaces.js";
import { analyzeWorkflowSoundness, assertWorkflowSound } from "./soundness.js";

const base = (overrides: Partial<WorkflowDoc> = {}): WorkflowDoc => ({
  id: "wf_sound" as WorkflowId,
  tenantId: "tenant_sound" as TenantId,
  name: "soundness",
  version: 1,
  nodes: [
    { nodeId: "trigger", kind: "trigger", on: "x.*" },
    { nodeId: "a", kind: "invoke", capability: "cap/a", inputs: {} },
    { nodeId: "b", kind: "invoke", capability: "cap/b", inputs: {} },
  ],
  edges: [
    { from: "trigger", to: "a" },
    { from: "a", to: "b" },
  ],
  ...overrides,
});

describe("workflow soundness", () => {
  it("accepts a reachable workflow with a terminal invoke node", () => {
    const report = analyzeWorkflowSoundness(base());
    expect(report.sound).toBe(true);
    expect(report.terminalNodeIds).toEqual(["b"]);
    expect(() => assertWorkflowSound(base())).not.toThrow();
  });

  it("rejects unreachable nodes", () => {
    const doc = base({
      nodes: [...base().nodes, { nodeId: "orphan", kind: "invoke", capability: "cap/orphan", inputs: {} }],
    });
    const report = analyzeWorkflowSoundness(doc);
    expect(report.sound).toBe(false);
    expect(report.unreachableNodeIds).toEqual(["orphan"]);
    expect(() => assertWorkflowSound(doc)).toThrow(/unreachable nodes: orphan/);
  });

  it("rejects workflows with no reachable terminal invoke node", () => {
    const doc = base({ edges: [{ from: "trigger", to: "a" }, { from: "a", to: "trigger" }] });
    const report = analyzeWorkflowSoundness(doc);
    expect(report.sound).toBe(false);
    expect(report.terminalNodeIds).toEqual([]);
    expect(report.deadlockNodeIds).toEqual(["a"]);
    expect(() => assertWorkflowSound(doc)).toThrow(/no reachable terminal invoke node/);
  });

  it("rejects invalid edge references and duplicate node ids", () => {
    const doc = base({
      nodes: [...base().nodes, { nodeId: "a", kind: "invoke", capability: "cap/dupe", inputs: {} }],
      edges: [...base().edges, { from: "missing", to: "b" }],
    });
    const report = analyzeWorkflowSoundness(doc);
    expect(report.sound).toBe(false);
    expect(report.duplicateNodeIds).toEqual(["a"]);
    expect(report.invalidEdgeRefs).toEqual([{ from: "missing", to: "b" }]);
  });
});
