/**
 * Hono app factory. Routes mounted under /tenants/:tenantId/{resource}.
 *
 * Dependency injection: the caller constructs the substrate adapters
 * (PostgresEventStore, PostgresGraph, etc.) and passes them in. The HTTP
 * layer holds no state of its own.
 */

import { Hono } from "hono";
import type { EventPublisher, EventReader } from "@pm/events";
import type { Graph } from "@pm/graph";
import type { ProfileRegistry } from "@pm/profile-registry";
import type { ProjectionRunner } from "@pm/projections";
import type { Registry } from "@pm/registry";
import type { TenantDirectory } from "@pm/tenants";
import { toHTTPException } from "./errors.js";
import { profileRoutes } from "./routes/profiles.js";
import { tenantRoutes } from "./routes/tenants.js";
import { capabilityRoutes } from "./routes/capabilities.js";
import { graphRoutes } from "./routes/graph.js";
import { eventRoutes } from "./routes/events.js";
import type { DomainEventHandler } from "./routes/events.js";
import { projectionRoutes } from "./routes/projections.js";

export interface SubstrateAppDeps {
  readonly tenants: TenantDirectory;
  readonly profileRegistry: ProfileRegistry;
  readonly capabilityRegistry: Registry;
  readonly graph: Graph;
  readonly events: EventPublisher & EventReader;
  readonly projections: ProjectionRunner;
  readonly domainEventHandlers?: Readonly<Record<string, DomainEventHandler>>;
  /**
   * Optional profile-specific sub-routers, mounted under
   * /tenants/:tenantId/<basePath>. The substrate core stays profile-agnostic:
   * profile-bound ingest surfaces (e.g. the ArrowHedgeLab finance bridge) are
   * built in a profile/demo package and injected here, never imported by the
   * substrate library itself.
   */
  readonly extraRoutes?: ReadonlyArray<{ readonly basePath: string; readonly router: Hono }>;
}

export const createSubstrateApp = (deps: SubstrateAppDeps): Hono => {
  const app = new Hono();

  app.get("/healthz", (c) => c.json({ status: "ok" }));

  app.route("/tenants", tenantRoutes(deps.tenants));
  app.route("/tenants/:tenantId/profiles", profileRoutes(deps.profileRegistry));
  app.route("/tenants/:tenantId/capabilities", capabilityRoutes(deps.capabilityRegistry));
  app.route("/tenants/:tenantId", graphRoutes(deps.graph));
  app.route("/tenants/:tenantId/events", eventRoutes(deps.events, deps.domainEventHandlers));
  app.route("/tenants/:tenantId/projections", projectionRoutes(deps.projections));
  for (const extra of deps.extraRoutes ?? []) {
    app.route(`/tenants/:tenantId/${extra.basePath}`, extra.router);
  }

  app.onError((err, c) => {
    const httpErr = toHTTPException(err);
    return c.json(
      {
        error: httpErr.message,
        cause: (httpErr as unknown as { cause?: unknown }).cause ?? null,
      },
      httpErr.status,
    );
  });

  return app;
};
