/**
 * pm:objective — admit source-cited business-operability measurements.
 *
 *   pnpm pm:objective -- template plugged_in_social --out measurement.json
 *   pnpm pm:objective -- record measurement.json
 *   pnpm pm:objective -- list
 *
 * Measurements are evidence, never authority. pm:memo independently derives
 * read attachments and governed actions from the admitted event log.
 */

import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";

import {
  OBJECTIVE_LAB_MEASUREMENT_SCHEMA_VERSION,
  foldObjectiveLabMeasurements,
  parseObjectiveLabMeasurement,
  type ObjectiveLabMeasurement,
} from "../packages/evals/src/index.js";
import { PostgresEventStore } from "../packages/events/src/index.js";
import {
  entityId,
  tenantId,
  timestamp,
  type TenantId,
} from "../packages/types/src/index.js";

const TENANT = tenantId(process.env["PM_DEV_TENANT_ID"] ?? "tenant_dev");
const AGENT = process.env["PM_DEV_AGENT_ID"] ?? "joat-dev";

const template = (labId: string): ObjectiveLabMeasurement => ({
  schemaVersion: OBJECTIVE_LAB_MEASUREMENT_SCHEMA_VERSION,
  labId,
  observedAt: new Date().toISOString(),
  sourceRefs: ["replace-with:artifact-or-event-ref"],
  runProvenance: {
    runManifestRef: "replace-with:run-manifest-ref",
    boundaryConformanceRef: "replace-with:boundary-conformance-ref",
    appRevision: "replace-with:app-revision",
    substrateRevision: "replace-with:substrate-revision",
  },
  adoption: {
    substratePackageEdits: null,
    appRewriteRequired: null,
    timeToFirstValueMs: null,
    mappingCoverage: null,
  },
  operations: {
    pairedRuns: null,
    baselineAttempts: null,
    baselineCorrectOutcomes: null,
    substrateAttempts: null,
    substrateCorrectOutcomes: null,
    holdoutRuns: null,
  },
  governance: {
    totalWritePaths: null,
    governedWritePaths: null,
    expectedAllows: null,
    falsePositiveBlocks: null,
    expectedBlocks: null,
    falseNegativeAllows: null,
  },
  economics: {
    baselineCostUsd: null,
    substrateCostUsd: null,
    baselineOperatorMinutes: null,
    substrateOperatorMinutes: null,
  },
  externalValidity: {
    productionLikeRuns: null,
    ownerAccepted: null,
  },
});

async function main(): Promise<void> {
  const args = process.argv
    .slice(2)
    .filter((item) => item !== "--");
  const [command = "list", argument] = args;

  if (command === "template") {
    const output = `${JSON.stringify(template(argument ?? "lab_id"), null, 2)}\n`;
    const outIndex = args.indexOf("--out");
    const outPath = outIndex >= 0 ? args[outIndex + 1] : undefined;
    if (outIndex >= 0 && !outPath) {
      throw new Error("pm:objective template --out requires a file path");
    }
    if (outPath) {
      writeFileSync(outPath, output);
      console.log(`wrote ${outPath}`);
    } else {
      console.log(output.trimEnd());
    }
    return;
  }

  const databaseUrl = process.env["PM_DATABASE_URL"];
  if (!databaseUrl) {
    console.error("pm:objective: PM_DATABASE_URL is required.");
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const events = new PostgresEventStore(pool);
  try {
    if (command === "record") {
      if (!argument) {
        throw new Error("pm:objective record requires a measurement JSON file");
      }
      const measurement = parseObjectiveLabMeasurement(
        JSON.parse(readFileSync(argument, "utf8")),
      );
      const event = await events.publish({
        tenantId: TENANT,
        type: "pm.objective.lab-measured",
        entityId: entityId(`objective:${measurement.labId}`),
        emittedBy: "pm-objective",
        payloadSchema: OBJECTIVE_LAB_MEASUREMENT_SCHEMA_VERSION,
        payload: measurement as unknown as Readonly<Record<string, unknown>>,
        authority: `operator:${AGENT}`,
        occurredAt: timestamp(measurement.observedAt),
      });
      console.log(
        `admitted ${measurement.labId} measurement ${event.id} (${event.contentHash})`,
      );
      return;
    }

    if (command === "list") {
      const admitted = await events.read({
        tenantId: TENANT as TenantId,
        typePattern: "pm.objective.lab-measured",
        limit: 1000,
      });
      const folded = foldObjectiveLabMeasurements(
        admitted.map((event) => event.payload),
      );
      console.log(
        JSON.stringify(
          { latest: folded.latest, invalidMeasurementEvents: folded.invalid },
          null,
          2,
        ),
      );
      return;
    }

    throw new Error(
      `pm:objective: unknown command "${command}" (template | record | list)`,
    );
  } finally {
    await pool.end();
  }
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
