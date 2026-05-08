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
    {
      interface: "Transaction",
      fields: ["state", "amountMinor", "currency"],
      cardinality: "exactly-one",
      required: true,
    },
  ],
  writesInterfaces: [
    {
      interface: "Engagement",
      fields: ["title", "state", "priority", "category"],
      ownership: "owner",
    },
  ],
  readsEdges: [],
  writesEdges: ["wedding/contract_task"],
  emits: [
    {
      schema: {
        type: "wedding.task.created",
        version: { major: 1, minor: 0, patch: 0 },
        schemaPath: "schemas/task-created.v1.json",
      },
      affectsEntities: ["Engagement"],
    },
  ],
  subscribesTo: [
    {
      pattern: "wedding.contract.signed",
      accepts: { minMajor: 1, maxMajor: 1 },
    },
  ],
  requiredPermissions: ["wedding.tasks.write"],
  description:
    "Owns PlannerTask creation in response to contract milestones. " +
    "Subscribes to wedding.contract.signed and writes a PlannerTask + contract_task edge.",
} as const satisfies Capability;
