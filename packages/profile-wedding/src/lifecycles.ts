import type { LifecycleDef } from "@pm/types";

/**
 * Wedding-profile lifecycle state machines.
 *
 * Architecture rule (architecture.md, performance #2 / ADR-0003):
 *   Profiles declare states + legal transitions. The substrate enforces
 *   that a transition is legal — it does NOT decide which transition
 *   to take. That's a workflow / capability concern.
 *
 * Only entity types that have a meaningful lifecycle declare one here.
 * Counterparty (Couple/Guest/Vendor) and the Wedding itself do not have
 * substrate-enforced lifecycles in this profile; their state evolves
 * through edges and child events, not through formal state transitions.
 */

export const CONTRACT_LIFECYCLE: LifecycleDef = {
  states: ["draft", "sent", "signed", "in_progress", "completed", "cancelled"],
  initial: "draft",
  terminal: ["completed", "cancelled"],
  transitions: [
    { from: ["draft"], to: "sent", trigger: "contract.sent" },
    { from: ["sent"], to: "signed", trigger: "contract.signed" },
    { from: ["signed"], to: "in_progress", trigger: "contract.work_started" },
    { from: ["in_progress"], to: "completed", trigger: "contract.completed" },
    {
      from: ["draft", "sent", "signed", "in_progress"],
      to: "cancelled",
      trigger: "contract.cancelled",
    },
  ],
};

export const PAYMENT_LIFECYCLE: LifecycleDef = {
  states: ["scheduled", "sent", "settled", "failed", "refunded"],
  initial: "scheduled",
  terminal: ["settled", "refunded"],
  transitions: [
    { from: ["scheduled"], to: "sent", trigger: "payment.sent" },
    { from: ["sent"], to: "settled", trigger: "payment.settled" },
    { from: ["sent"], to: "failed", trigger: "payment.failed" },
    { from: ["settled"], to: "refunded", trigger: "payment.refunded" },
  ],
};

export const INVOICE_LIFECYCLE: LifecycleDef = {
  states: ["draft", "sent", "paid", "void", "uncollectible"],
  initial: "draft",
  terminal: ["paid", "void", "uncollectible"],
  transitions: [
    { from: ["draft"], to: "sent", trigger: "invoice.sent" },
    { from: ["sent"], to: "paid", trigger: "invoice.paid" },
    { from: ["draft", "sent"], to: "void", trigger: "invoice.voided" },
    { from: ["sent"], to: "uncollectible", trigger: "invoice.uncollectible" },
  ],
};
