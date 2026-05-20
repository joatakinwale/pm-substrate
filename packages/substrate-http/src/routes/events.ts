import { Hono } from "hono";
import type {
  EventPublisher,
  EventReader,
  EventChainVerifier,
  PublishInput,
  ReadQuery,
} from "@pm/events";
import type { EventId, TenantId } from "@pm/types";

export type DomainEventHandler = (input: PublishInput) => Promise<void>;
import { toHTTPException } from "../errors.js";

export const eventRoutes = (
  events: EventPublisher & EventReader & Partial<EventChainVerifier>,
  handlers: Readonly<Record<string, DomainEventHandler>> = {},
): Hono => {
  const app = new Hono();

  // POST /tenants/:tenantId/events
  app.post("/", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    let body: Omit<PublishInput, "tenantId">;
    try {
      body = (await c.req.json()) as Omit<PublishInput, "tenantId">;
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }
    try {
      const input: PublishInput = { tenantId, ...body };
      const event = await events.publish(input);

      const handler = handlers[input.type];
      if (handler) {
        await handler(input);
      }

      return c.json(event);
    } catch (err) {
      throw toHTTPException(err);
    }
  });

  // GET /tenants/:tenantId/events?typePattern=...&entityId=...&since=...&until=...&afterRecordedAt=...&limit=...
  app.get("/", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    const q = c.req.query();
    const typePattern = q["typePattern"] ?? "*";
    const query: Omit<ReadQuery, "typePattern"> & { typePattern: string } = {
      tenantId,
      typePattern,
    };
    if (q["entityId"]) (query as ReadQuery & { entityId: never }).entityId = q["entityId"] as never;
    if (q["since"]) (query as ReadQuery & { since: never }).since = q["since"] as never;
    if (q["until"]) (query as ReadQuery & { until: never }).until = q["until"] as never;
    if (q["afterRecordedAt"]) {
      (query as ReadQuery & { afterRecordedAt: string }).afterRecordedAt = q["afterRecordedAt"];
    }
    if (q["limit"]) (query as ReadQuery & { limit: number }).limit = Number(q["limit"]);
    const result = await events.read(query);
    return c.json({ events: result });
  });

  // GET /tenants/:tenantId/events/verify-chain
  app.get("/verify-chain", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    if (!events.verifyChain) return c.json({ error: "event chain verification unavailable" }, 501);
    const report = await events.verifyChain(tenantId);
    return c.json({ report });
  });

  // GET /tenants/:tenantId/events/:id
  app.get("/:id", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    const id = c.req.param("id") as EventId;
    const event = await events.getById(tenantId, id);
    if (!event) return c.json({ error: "not found" }, 404);
    return c.json(event);
  });

  return app;
};
