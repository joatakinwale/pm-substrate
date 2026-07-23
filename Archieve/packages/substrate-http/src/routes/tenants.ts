import { Hono } from "hono";
import type { TenantDirectory } from "@pm/tenants";
import type { TenantId } from "@pm/types";
import { toHTTPException } from "../errors.js";

export const tenantRoutes = (tenants: TenantDirectory): Hono => {
  const app = new Hono();

  // POST /tenants
  app.post("/", async (c) => {
    let body: { id?: TenantId; displayName?: string; metadata?: Record<string, unknown> };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }
    if (!body.displayName) return c.json({ error: "displayName is required" }, 400);
    try {
      const input = {
        displayName: body.displayName,
        ...(body.id !== undefined ? { id: body.id } : {}),
        ...(body.metadata !== undefined ? { metadata: body.metadata } : {}),
      };
      const tenant = await tenants.create(input);
      return c.json({ tenant }, 201);
    } catch (err) {
      throw toHTTPException(err);
    }
  });

  // GET /tenants?includeArchived=true
  app.get("/", async (c) => {
    const includeArchived = c.req.query("includeArchived") === "true";
    const rows = await tenants.list({ includeArchived });
    return c.json({ tenants: rows });
  });

  // GET /tenants/:tenantId
  app.get("/:tenantId", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    const tenant = await tenants.get(tenantId);
    if (!tenant) return c.json({ error: "not found" }, 404);
    return c.json({ tenant });
  });

  // PATCH /tenants/:tenantId
  app.patch("/:tenantId", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    let body: { displayName?: string; metadata?: Record<string, unknown> };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }
    try {
      const tenant = await tenants.update(tenantId, body);
      return c.json({ tenant });
    } catch (err) {
      throw toHTTPException(err);
    }
  });

  // POST /tenants/:tenantId/archive
  app.post("/:tenantId/archive", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    try {
      const tenant = await tenants.archive(tenantId);
      return c.json({ tenant });
    } catch (err) {
      throw toHTTPException(err);
    }
  });

  // POST /tenants/:tenantId/restore
  app.post("/:tenantId/restore", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    try {
      const tenant = await tenants.restore(tenantId);
      return c.json({ tenant });
    } catch (err) {
      throw toHTTPException(err);
    }
  });

  return app;
};
