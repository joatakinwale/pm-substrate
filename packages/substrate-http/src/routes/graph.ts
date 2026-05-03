import { Hono } from "hono";
import type {
  CreateEdgeInput,
  CreateNodeInput,
  Graph,
  UpdateNodeInput,
} from "@pm/graph";
import type { EdgeId, EntityId, TenantId } from "@pm/types";
import { toHTTPException } from "../errors.js";

export const graphRoutes = (graph: Graph): Hono => {
  const app = new Hono();

  // POST /tenants/:tenantId/nodes
  app.post("/nodes", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    let body: Omit<CreateNodeInput, "tenantId">;
    try {
      body = (await c.req.json()) as Omit<CreateNodeInput, "tenantId">;
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }
    try {
      const node = await graph.createNode({ tenantId, ...body });
      return c.json(node);
    } catch (err) {
      throw toHTTPException(err);
    }
  });

  // GET /tenants/:tenantId/nodes/:id
  app.get("/nodes/:id", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    const id = c.req.param("id") as EntityId;
    const node = await graph.getNode(tenantId, id);
    if (!node) return c.json({ error: "not found" }, 404);
    return c.json(node);
  });

  // PATCH /tenants/:tenantId/nodes/:id
  app.patch("/nodes/:id", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    const id = c.req.param("id") as EntityId;
    let body: Omit<UpdateNodeInput, "tenantId" | "id">;
    try {
      body = (await c.req.json()) as Omit<UpdateNodeInput, "tenantId" | "id">;
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }
    try {
      const node = await graph.updateNode({ tenantId, id, ...body });
      return c.json(node);
    } catch (err) {
      throw toHTTPException(err);
    }
  });

  // POST /tenants/:tenantId/edges
  app.post("/edges", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    let body: Omit<CreateEdgeInput, "tenantId">;
    try {
      body = (await c.req.json()) as Omit<CreateEdgeInput, "tenantId">;
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }
    try {
      const edge = await graph.createEdge({ tenantId, ...body });
      return c.json(edge);
    } catch (err) {
      throw toHTTPException(err);
    }
  });

  // GET /tenants/:tenantId/nodes/:id/edges/out/:type
  app.get("/nodes/:id/edges/out/:type", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    const id = c.req.param("id") as EntityId;
    const type = c.req.param("type");
    const edges = await graph.outgoingEdges(tenantId, id, type);
    return c.json({ edges });
  });

  // GET /tenants/:tenantId/nodes/:id/edges/in/:type
  app.get("/nodes/:id/edges/in/:type", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    const id = c.req.param("id") as EntityId;
    const type = c.req.param("type");
    const edges = await graph.incomingEdges(tenantId, id, type);
    return c.json({ edges });
  });

  // DELETE /tenants/:tenantId/edges/:id
  app.delete("/edges/:id", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    const id = c.req.param("id") as EdgeId;
    try {
      await graph.deleteEdge(tenantId, id);
      return c.json({ id });
    } catch (err) {
      throw toHTTPException(err);
    }
  });

  return app;
};
