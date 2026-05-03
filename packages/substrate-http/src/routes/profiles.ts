import { Hono } from "hono";
import type { ProfileRegistry } from "@pm/profile-registry";
import type { ProfileDefinition, TenantId } from "@pm/types";
import { toHTTPException } from "../errors.js";

export const profileRoutes = (registry: ProfileRegistry): Hono => {
  const app = new Hono();

  // POST /tenants/:tenantId/profiles
  // Body: ProfileDefinition
  app.post("/", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    let def: ProfileDefinition;
    try {
      def = (await c.req.json()) as ProfileDefinition;
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }
    try {
      await registry.install(tenantId, def);
      return c.json({ name: def.name, version: def.version });
    } catch (err) {
      throw toHTTPException(err);
    }
  });

  // GET /tenants/:tenantId/profiles
  app.get("/", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    const profiles = await registry.list(tenantId);
    return c.json({ profiles });
  });

  // GET /tenants/:tenantId/profiles/:name
  app.get("/:name", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    const name = c.req.param("name");
    const profile = await registry.get(tenantId, name);
    if (!profile) return c.json({ error: "not found" }, 404);
    return c.json(profile);
  });

  // DELETE /tenants/:tenantId/profiles/:name
  app.delete("/:name", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    const name = c.req.param("name");
    await registry.uninstall(tenantId, name);
    return c.json({ name });
  });

  return app;
};
