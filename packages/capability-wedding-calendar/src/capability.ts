import type { Capability } from "@pm/registry";
import type { CapabilityId } from "@pm/types";

/**
 * Capability descriptor for wedding.calendar.
 *
 * Materializes a CalendarEvent for each new PlannerTask. Subscribes to
 * wedding.task.created; writes a CalendarEvent graph node and a
 * task_calendar_event edge linking the task to the new calendar event;
 * emits wedding.calendar.event_created.
 *
 * Architecture: this capability does NOT know about wedding.tasks (the
 * upstream emitter) or any downstream reminder/notification consumer.
 * It reads the task event, writes one entity, one edge, one event. The
 * substrate is the only coupling point.
 *
 * Provider-neutral: this capability writes only the canonical CalendarEvent
 * record + lifecycle. It does NOT attempt to sync to Google/Aurinko/Outlook;
 * that's a separate concern (provider-specific capability or out-of-band
 * sync worker reading the event log).
 */
export const WEDDING_CALENDAR_CAPABILITY = {
  id: "cap_wedding_calendar_v1" as CapabilityId,
  name: "wedding.calendar",
  version: 1,
  readsInterfaces: [
    "Engagement[title,state,priority,category]",
  ],
  writesInterfaces: [
    "Resource[title,kind,startAt,endAt,timezone,state]",
  ],
  readsEdges: [],
  writesEdges: ["wedding/task_calendar_event"],
  emits: ["wedding.calendar.event_created"],
  subscribesTo: ["wedding.task.created"],
  requiredPermissions: ["wedding.calendar.write"],
  description:
    "Materializes a CalendarEvent for each new PlannerTask. " +
    "Subscribes to wedding.task.created and writes a CalendarEvent + task_calendar_event edge.",
} as const satisfies Capability;
