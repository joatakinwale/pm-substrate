import { Hono } from "hono";
import type { ProjectionRunner } from "@pm/projections";
import type { TenantId } from "@pm/types";
import { toHTTPException } from "../errors.js";

export const projectionRoutes = (runner: ProjectionRunner): Hono => {
  const app = new Hono();

  // POST /tenants/:tenantId/projections/:name/catch-up
  app.post("/:name/catch-up", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    const name = c.req.param("name");
    try {
      await runner.catchUp(tenantId, name);
      return c.json({ name, status: "caught-up" });
    } catch (err) {
      throw toHTTPException(err);
    }
  });

  // POST /tenants/:tenantId/projections/:name/rebuild
  app.post("/:name/rebuild", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    const name = c.req.param("name");
    try {
      await runner.rebuild(tenantId, name);
      return c.json({ name, status: "rebuilt" });
    } catch (err) {
      throw toHTTPException(err);
    }
  });

  // GET /tenants/:tenantId/projections/:name/state
  app.get("/:name/state", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    const name = c.req.param("name");
    const state = await runner.getState(tenantId, name);
    if (state === null) return c.json({ error: "not found" }, 404);
    return c.json({ state });
  });

  return app;
};
