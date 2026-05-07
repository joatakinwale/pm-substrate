/**
 * @pm/capability-wedding-calendar \u2014 materializes a CalendarEvent for each
 * new PlannerTask.
 *
 * Tier-2 capability: profile-bound to the wedding profile. Subscribes to
 * `wedding.task.created`. For each task, writes one CalendarEvent graph
 * node + one PlannerTask \u2192 CalendarEvent edge + emits
 * `wedding.calendar.event_created`. Atomic across all three writes.
 *
 * Idempotency: at most one CalendarEvent per task, enforced by the
 * task_calendar_event edge cardinality (at-most:1 from the task side).
 *
 * Provider-neutral. This capability writes the canonical CalendarEvent
 * record only; it does not sync to Google/Aurinko/Outlook \u2014 that is the
 * concern of a provider-specific syncer reading the event log.
 */

export { WEDDING_CALENDAR_CAPABILITY } from "./capability.js";
export {
  CalendarEventHandler,
  DEFAULT_TIME_POLICY,
} from "./handler.js";
export type {
  TaskCreatedPayload,
  CalendarRuntimeDeps,
  TimePolicy,
} from "./handler.js";
