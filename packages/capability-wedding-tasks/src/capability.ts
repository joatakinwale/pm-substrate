import type { Capability } from "@pm/registry";
import type { CapabilityId } from "@pm/types";

/**
 * Capability descriptor for wedding.tasks.
 *
 * Owns PlannerTask entity creation in response to contract milestones.
 * Subscribes to wedding.contract.signed; writes a PlannerTask graph node
 * and a contract_task edge linking the contract to the new task; emits
 * wedding.task.created so downstream capabilities (e.g., wedding.calendar,
 * wedding.reminders) can react.
 *
 * Architecture: this capability does NOT need to know about the calendar
 * capability or the reminder capability. It writes one entity, one edge,
 * one event. Whoever subscribes downstream is the substrate's concern,
 * not this capability's.
 */
export const WEDDING_TASKS_CAPABILITY = {
  id: "cap_wedding_tasks_v1" as CapabilityId,
  name: "wedding.tasks",
  version: 1,
  readsInterfaces: [
    "Transaction[state,amountMinor,currency]",
  ],
  writesInterfaces: [
    "Engagement[title,state,priority,category]",
  ],
  readsEdges: [],
  writesEdges: ["wedding/contract_task"],
  emits: ["wedding.task.created"],
  subscribesTo: ["wedding.contract.signed"],
  requiredPermissions: ["wedding.tasks.write"],
  description:
    "Owns PlannerTask creation in response to contract milestones. " +
    "Subscribes to wedding.contract.signed and writes a PlannerTask + contract_task edge.",
} as const satisfies Capability;
