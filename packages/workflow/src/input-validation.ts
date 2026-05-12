/**
 * Invocation-input validation gate (G12 / ADR-0026).
 *
 * Maps to discovery-engine SPEC Gate 1: "no kernel -> no retrieval".
 * Generalized to the substrate runtime: "no valid invocation input ->
 * no capability dispatch".
 *
 * Before ADR-0026, the workflow runtime resolved an InvokeNode's
 * `inputs` (dotted-path lookups against the trigger event payload and
 * prior node results) and handed the resolved object directly to the
 * dispatcher. Capabilities had to defensively re-validate every input
 * field, with no shared shape contract. This is the same failure class
 * the agent-side recall-guard targets: "I trust what's in the context
 * without re-checking." The substrate analog is "the dispatcher trusts
 * what was wired up at install without re-checking at call time."
 *
 * ADR-0026 adds an `InputValidator` injection on the runtime, mirroring
 * `PermissionAuthorizer` from G7. The default is permissive (legacy
 * behavior). Capabilities that opt in expose a JSON-Schema-shaped
 * `inputSchema` on their descriptor; the runtime calls the validator
 * BEFORE dispatch and treats any rejection as a non-retryable
 * `input_invalid` dead-letter (same class as `permission_denied`).
 *
 * Why JSON Schema (vs Zod / Ajv / etc.):
 *   - Substrate already uses JSON-Schema-shaped contract docs per
 *     ADR-0013 (EmitContract.schema, etc.). Keeping one shape means
 *     codegen can target a single dialect later.
 *   - This module is intentionally thin: it doesn't ship a validator
 *     implementation. Callers wire whichever validator they want
 *     (ajv, hyperjump, zod-from-json-schema). The substrate stays
 *     library-agnostic.
 *   - The default `acceptAllInputValidator()` is a no-op so existing
 *     workflows that never declared `inputSchema` are unaffected.
 */

/**
 * Context passed to the validator. The validator decides whether
 * `inputs` are acceptable for invoking `capability`.
 */
export interface InputValidationCheck {
  /** Capability name being invoked (matches `WorkflowNode.capability`). */
  readonly capability: string;
  /** Resolved inputs the runtime would hand to the dispatcher. */
  readonly inputs: Readonly<Record<string, unknown>>;
  /**
   * Optional JSON Schema declared by the capability descriptor.
   * Undefined means the capability did not declare one. Most validators
   * should short-circuit with `{ valid: true }` in that case to preserve
   * legacy behavior.
   */
  readonly inputSchema?: Readonly<Record<string, unknown>>;
  /** Tenant invoking the capability (for tenant-scoped validation rules). */
  readonly tenantId: string;
  /** Workflow + node identifying the call site, for error context. */
  readonly workflowId: string;
  readonly nodeId: string;
}

/**
 * Validator decision. `valid: false` produces a non-retryable
 * `input_invalid` failure. `reason` is surfaced into the dead-letter
 * record so operators can act.
 *
 * `issues` is optional structured detail for callers / dashboards.
 */
export type InputValidationDecision =
  | { readonly valid: true }
  | {
      readonly valid: false;
      readonly reason: string;
      readonly issues?: ReadonlyArray<{
        readonly path: string;
        readonly message: string;
      }>;
    };

export interface InputValidator {
  validate(ctx: InputValidationCheck): Promise<InputValidationDecision>;
}

/**
 * Default validator. Accepts every input regardless of whether
 * `inputSchema` is set. Use this during migration so existing workflows
 * keep working until each capability opts in.
 */
export const acceptAllInputValidator = (): InputValidator => ({
  async validate(): Promise<InputValidationDecision> {
    return { valid: true };
  },
});

/**
 * Reject-all validator. Useful in tests to prove the runtime denies
 * dispatch when validation fails (the "negative path" test).
 */
export const rejectAllInputValidator = (
  reason = "test-only: rejecting all inputs",
): InputValidator => ({
  async validate(): Promise<InputValidationDecision> {
    return { valid: false, reason };
  },
});

/**
 * Minimal-but-real validator. Enforces a SUBSET of JSON Schema sufficient
 * for capability input validation in the substrate:
 *
 *   - `type: "object"` with `required: string[]` and
 *     `properties: Record<string, { type }>`
 *   - Top-level required fields must be present and non-null.
 *   - Top-level field types ("string", "number", "boolean", "integer",
 *     "array", "object") are checked when declared.
 *   - `additionalProperties: false` rejects unknown top-level fields.
 *
 * Anything more elaborate (anyOf, oneOf, pattern, format, nested
 * required) is treated as accepted. Callers needing the full spec
 * should wire ajv or hyperjump-jsv instead.
 *
 * Rationale: dragging Ajv into @pm/workflow brings ~600KB of bundle
 * weight for a capability-author convenience. The substrate-owned
 * default needs to cover ~90% of capability input shapes (object with
 * required scalar fields) without a dependency.
 */
export const builtinInputValidator = (): InputValidator => ({
  async validate(
    ctx: InputValidationCheck,
  ): Promise<InputValidationDecision> {
    const schema = ctx.inputSchema;
    if (!schema) return { valid: true };

    const issues: Array<{ path: string; message: string }> = [];

    const schemaType = schema["type"];
    if (schemaType && schemaType !== "object") {
      issues.push({
        path: "",
        message: `builtinInputValidator only handles top-level type "object", got ${JSON.stringify(schemaType)}`,
      });
      return {
        valid: false,
        reason: "input schema is not a top-level object",
        issues,
      };
    }

    const required = Array.isArray(schema["required"])
      ? (schema["required"] as string[]).filter(
          (f): f is string => typeof f === "string",
        )
      : [];

    const properties =
      typeof schema["properties"] === "object" && schema["properties"] !== null
        ? (schema["properties"] as Record<string, Record<string, unknown>>)
        : {};

    for (const field of required) {
      const v = ctx.inputs[field];
      if (v === undefined || v === null) {
        issues.push({
          path: `/${field}`,
          message: "required field missing or null",
        });
      }
    }

    for (const [field, fieldSchema] of Object.entries(properties)) {
      if (!(field in ctx.inputs)) continue;
      const v = ctx.inputs[field];
      const expected = fieldSchema["type"];
      if (typeof expected !== "string") continue;
      if (v === null) continue; // null is permitted unless `required`
      const actual = Array.isArray(v) ? "array" : typeof v;
      const matches = expected === "integer"
        ? typeof v === "number" && Number.isInteger(v)
        : expected === actual;
      if (!matches) {
        issues.push({
          path: `/${field}`,
          message: `expected type ${expected}, got ${actual}`,
        });
      }
    }

    if (schema["additionalProperties"] === false) {
      const declared = new Set(Object.keys(properties));
      for (const key of Object.keys(ctx.inputs)) {
        if (!declared.has(key)) {
          issues.push({
            path: `/${key}`,
            message: "unknown field (additionalProperties: false)",
          });
        }
      }
    }

    if (issues.length === 0) return { valid: true };
    return {
      valid: false,
      reason: `input failed schema validation (${issues.length} issue${issues.length === 1 ? "" : "s"})`,
      issues,
    };
  },
});
