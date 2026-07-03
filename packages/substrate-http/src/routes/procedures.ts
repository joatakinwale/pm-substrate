import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type {
  ProcedureAdmissionRuntime,
  ProcedureAdmissionRuntimeInput,
  ProcedureDefinitionInput,
  ProcedureEvidenceBinding,
} from "@pm/procedure-admission";
import type { TenantId } from "@pm/types";

import { toHTTPException } from "../errors.js";

export const procedureRoutes = (
  runtime: ProcedureAdmissionRuntime,
): Hono => {
  const app = new Hono();

  app.post("/definitions", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    try {
      const body = await readJsonRecord(c.req);
      const definition = await runtime.registerDefinition({
        tenantId,
        procedureId: requireString(body, "procedureId"),
        version: requirePositiveInteger(body, "version"),
        name: requireString(body, "name"),
        authorityScope: requireString(body, "authorityScope"),
        runnerKind: requireRunnerKind(body, "runnerKind"),
        inputContractHash: requireString(body, "inputContractHash"),
        outputContractHash: requireString(body, "outputContractHash"),
        allowedUse: requireStringArray(body, "allowedUse"),
        createdAt: requireString(body, "createdAt"),
      } satisfies ProcedureDefinitionInput);
      return c.json({ definition }, 201);
    } catch (err) {
      throw toHTTPException(err);
    }
  });

  app.get("/:procedureId/versions/:version/replay", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    try {
      const replay = await runtime.replay({
        tenantId,
        procedureId: c.req.param("procedureId"),
        version: parseVersion(c.req.param("version")),
        evaluatedAt:
          c.req.query("evaluatedAt") ?? new Date().toISOString(),
      });
      return c.json({ replay });
    } catch (err) {
      throw toHTTPException(err);
    }
  });

  app.post("/:procedureId/versions/:version/runs", async (c) => {
    const tenantId = c.req.param("tenantId") as TenantId;
    try {
      const body = await readJsonRecord(c.req);
      const executeInput = {
        tenantId,
        procedureId: c.req.param("procedureId"),
        version: parseVersion(c.req.param("version")),
        runId: requireString(body, "runId"),
        requestedBy: requireString(body, "requestedBy"),
        inputHash: requireString(body, "inputHash"),
        inputEvidence: requireEvidenceArray(body, "inputEvidence"),
        ...(typeof body["input"] !== "undefined"
          ? { input: body["input"] }
          : {}),
        ...(typeof body["startedAt"] === "string"
          ? { startedAt: body["startedAt"] }
          : {}),
        ...(typeof body["admittedBy"] === "string"
          ? { admittedBy: body["admittedBy"] }
          : {}),
        ...(typeof body["evaluatedAt"] === "string"
          ? { evaluatedAt: body["evaluatedAt"] }
          : {}),
      } satisfies ProcedureAdmissionRuntimeInput;
      const result = await runtime.execute(executeInput);
      return c.json(
        {
          run: result.run,
          record: result.record,
          replay: result.replay,
        },
        result.record.decision === "admitted" ? 201 : 202,
      );
    } catch (err) {
      throw toHTTPException(err);
    }
  });

  return app;
};

type JsonRecord = Record<string, unknown>;

const readJsonRecord = async (req: {
  json(): Promise<unknown>;
}): Promise<JsonRecord> => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HTTPException(400, { message: "invalid JSON body" });
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new HTTPException(400, { message: "JSON body must be an object" });
  }
  return body as JsonRecord;
};

const requireString = (body: JsonRecord, field: string): string => {
  const value = body[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new HTTPException(400, {
      message: `${field} must be a non-empty string`,
    });
  }
  return value;
};

const requirePositiveInteger = (body: JsonRecord, field: string): number => {
  const value = body[field];
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new HTTPException(400, {
      message: `${field} must be a positive integer`,
    });
  }
  return value as number;
};

const parseVersion = (value: string): number => {
  const version = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(version) || version <= 0) {
    throw new HTTPException(400, {
      message: "version must be a positive integer",
    });
  }
  return version;
};

const requireStringArray = (body: JsonRecord, field: string): readonly string[] => {
  const value = body[field];
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || item.length === 0)
  ) {
    throw new HTTPException(400, {
      message: `${field} must be an array of non-empty strings`,
    });
  }
  return value;
};

const requireEvidenceArray = (
  body: JsonRecord,
  field: string,
): readonly ProcedureEvidenceBinding[] => {
  const value = body[field];
  if (!Array.isArray(value)) {
    throw new HTTPException(400, {
      message: `${field} must be an array`,
    });
  }
  return value as readonly ProcedureEvidenceBinding[];
};

const requireRunnerKind = (
  body: JsonRecord,
  field: string,
): ProcedureDefinitionInput["runnerKind"] => {
  const value = requireString(body, field);
  if (
    value !== "pi_harness" &&
    value !== "browser_qa_harness" &&
    value !== "script" &&
    value !== "agent_harness" &&
    value !== "custom"
  ) {
    throw new HTTPException(400, {
      message: `${field} is not a supported procedure runner kind`,
    });
  }
  return value;
};
