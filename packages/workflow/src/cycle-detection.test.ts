/**
 * Pure unit tests for the cycle detector. No DB required.
 */

import { describe, expect, it } from "vitest";
import { assertAcyclic, assertWorkflowAcyclic } from "./cycle-detection.js";
import { WorkflowValidationError } from "./errors.js";
import type { WorkflowDoc, WorkflowEdge, WorkflowNode } from "./interfaces.js";
import type { TenantId, WorkflowId } from "@pm/types";

function nodes(...ids: string[]): WorkflowNode[] {
  return ids.map((id, idx) =>
    idx === 0
      ? { nodeId: id, kind: "trigger", on: "x.created" }
      : { nodeId: id, kind: "invoke", capability: "test/cap", inputs: {} },
  );
}

function edge(from: string, to: string): WorkflowEdge {
  return { from, to };
}

describe("cycle-detection", () => {
  it("accepts a simple linear DAG", () => {
    expect(() =>
      assertAcyclic({
        nodes: nodes("a", "b", "c"),
        edges: [edge("a", "b"), edge("b", "c")],
        workflowName: "linear",
        workflowVersion: 1,
      }),
    ).not.toThrow();
  });

  it("accepts a diamond (multiple paths, no cycle)", () => {
    expect(() =>
      assertAcyclic({
        nodes: nodes("a", "b", "c", "d"),
        edges: [
          edge("a", "b"),
          edge("a", "c"),
          edge("b", "d"),
          edge("c", "d"),
        ],
        workflowName: "diamond",
        workflowVersion: 1,
      }),
    ).not.toThrow();
  });

  it("accepts disconnected DAG components", () => {
    expect(() =>
      assertAcyclic({
        nodes: nodes("a", "b", "c", "d"),
        edges: [edge("a", "b"), edge("c", "d")],
        workflowName: "split",
        workflowVersion: 1,
      }),
    ).not.toThrow();
  });

  it("rejects a self-loop", () => {
    expect(() =>
      assertAcyclic({
        nodes: nodes("a", "b"),
        edges: [edge("a", "b"), edge("b", "b")],
        workflowName: "self",
        workflowVersion: 1,
      }),
    ).toThrow(WorkflowValidationError);
  });

  it("rejects a 2-node cycle", () => {
    expect(() =>
      assertAcyclic({
        nodes: nodes("a", "b"),
        edges: [edge("a", "b"), edge("b", "a")],
        workflowName: "two",
        workflowVersion: 1,
      }),
    ).toThrow(WorkflowValidationError);
  });

  it("rejects a longer cycle and reports the cycle path in the message", () => {
    let caught: Error | undefined;
    try {
      assertAcyclic({
        nodes: nodes("a", "b", "c", "d"),
        edges: [
          edge("a", "b"),
          edge("b", "c"),
          edge("c", "d"),
          edge("d", "b"),
        ],
        workflowName: "long",
        workflowVersion: 3,
      });
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).toBeInstanceOf(WorkflowValidationError);
    expect(caught?.message).toContain("cycle");
    // The cycle is b -> c -> d -> b (a is upstream, not in the cycle).
    expect(caught?.message).toContain("b -> c -> d -> b");
    expect(caught?.message).toContain('"long" v3');
  });

  it("rejects a cycle hidden behind a long acyclic prefix", () => {
    // a -> b -> c -> d -> e -> c (back-edge into the middle)
    expect(() =>
      assertAcyclic({
        nodes: nodes("a", "b", "c", "d", "e"),
        edges: [
          edge("a", "b"),
          edge("b", "c"),
          edge("c", "d"),
          edge("d", "e"),
          edge("e", "c"),
        ],
        workflowName: "hidden",
        workflowVersion: 1,
      }),
    ).toThrow(WorkflowValidationError);
  });

  it("ignores edges from undeclared 'from' nodes (defensive)", () => {
    // install() catches this earlier; we should not crash here.
    expect(() =>
      assertAcyclic({
        nodes: nodes("a", "b"),
        edges: [edge("a", "b"), edge("ghost", "b")],
        workflowName: "ghost",
        workflowVersion: 1,
      }),
    ).not.toThrow();
  });

  it("survives wide graphs without recursion blowup", () => {
    // Long linear chain: a0 -> a1 -> ... -> a999. No cycle.
    const ids = Array.from({ length: 1000 }, (_, i) => `n${i}`);
    const ns = nodes(...ids);
    const es: WorkflowEdge[] = [];
    for (let i = 0; i < ids.length - 1; i++) {
      es.push(edge(ids[i]!, ids[i + 1]!));
    }
    expect(() =>
      assertAcyclic({
        nodes: ns,
        edges: es,
        workflowName: "long-chain",
        workflowVersion: 1,
      }),
    ).not.toThrow();
  });

  it("assertWorkflowAcyclic forwards to assertAcyclic with the doc fields", () => {
    const doc: WorkflowDoc = {
      id: "wf_test" as WorkflowId,
      tenantId: "tnt_test" as TenantId,
      name: "doc",
      version: 2,
      nodes: nodes("a", "b"),
      edges: [edge("a", "b"), edge("b", "a")],
    };
    let caught: Error | undefined;
    try {
      assertWorkflowAcyclic(doc);
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).toBeInstanceOf(WorkflowValidationError);
    expect(caught?.message).toContain('"doc" v2');
  });
});
