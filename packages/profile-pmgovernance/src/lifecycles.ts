import type { LifecycleDef } from "@pm/types";

/**
 * PM-governance stage-gate lifecycles (refactor plan §4.3).
 *
 * The substrate enforces transition LEGALITY only; deciding to move is the
 * capability/agent's job, gated by approvals and milestones.
 */

export const WORK_ITEM_LIFECYCLE: LifecycleDef = {
  states: [
    "todo",
    "in_progress",
    "in_review",
    "blocked",
    "done",
    "accepted",
    "cancelled",
  ],
  initial: "todo",
  transitions: [
    { from: ["todo"], to: "in_progress" },
    { from: ["in_progress"], to: "in_review" },
    { from: ["in_progress", "in_review"], to: "blocked" },
    { from: ["blocked"], to: "in_progress" },
    { from: ["in_review"], to: "done", trigger: "pm.approval.approved" },
    { from: ["in_review"], to: "in_progress" },
    { from: ["done"], to: "accepted", trigger: "pm.milestone.passed" },
    { from: ["todo", "in_progress", "in_review", "blocked"], to: "cancelled" },
  ],
  terminal: ["accepted", "cancelled"],
};

export const MILESTONE_LIFECYCLE: LifecycleDef = {
  states: ["pending", "passed", "failed"],
  initial: "pending",
  transitions: [
    { from: ["pending"], to: "passed" },
    { from: ["pending"], to: "failed" },
    { from: ["failed"], to: "pending" },
  ],
  terminal: ["passed"],
};

export const APPROVAL_REQUEST_LIFECYCLE: LifecycleDef = {
  states: ["requested", "approved", "rejected", "withdrawn"],
  initial: "requested",
  transitions: [
    { from: ["requested"], to: "approved" },
    { from: ["requested"], to: "rejected" },
    { from: ["requested"], to: "withdrawn" },
  ],
  terminal: ["approved", "rejected", "withdrawn"],
};

export const INITIATIVE_LIFECYCLE: LifecycleDef = {
  states: ["proposed", "active", "on_hold", "closed"],
  initial: "proposed",
  transitions: [
    { from: ["proposed"], to: "active" },
    { from: ["active"], to: "on_hold" },
    { from: ["on_hold"], to: "active" },
    { from: ["active", "on_hold"], to: "closed" },
  ],
  terminal: ["closed"],
};
