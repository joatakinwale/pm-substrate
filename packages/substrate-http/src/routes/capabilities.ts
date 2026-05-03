import { Hono } from "hono";
import type { Capability, Registry } from "@pm/registry";
import type { TenantId } from "@pm/types";
import { toHTTPException } from "../errors.js";

export const capabilityRoutes = (registry: Registry): Hono => {
  const app = new Hono();

  // POST /tenants/:tenantId/capabilities
  app.post("/", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    let cap: Capability;
    try {
      cap = (await c.req.json()) as Capability;
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }
    try {
      await registry.register(tenantId, cap);
      return c.json({ name: cap.name, version: cap.version });
    } catch (err) {
      throw toHTTPException(err);
    }
  });

  // GET /tenants/:tenantId/capabilities
  app.get("/", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    const capabilities = await registry.list(tenantId);
    return c.json({ capabilities });
  });

  // GET /tenants/:tenantId/capabilities/:name
  app.get("/:name", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    const name = c.req.param("name");
    const cap = await registry.get(tenantId, name);
    if (!cap) return c.json({ error: "not found" }, 404);
    return c.json(cap);
  });

  // GET /tenants/:tenantId/capabilities/subscribers/:eventType
  app.get("/subscribers/:eventType", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    const eventType = c.req.param("eventType");
    const subs = await registry.subscribersOf(tenantId, eventType);
    return c.json({ subscribers: subs });
  });

  // DELETE /tenants/:tenantId/capabilities/:name
  app.delete("/:name", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    const name = c.req.param("name");
    await registry.unregister(tenantId, name);
    return c.json({ name });
  });

  return app;
};
