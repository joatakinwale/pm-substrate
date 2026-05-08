/**
 * Workflow-time contract validation (G6 / ADR-0013).
 *
 * Validates capability contracts at install time so producer/subscriber
 * mismatches are caught before any event flows. The substrate refuses to
 * enable a workflow whose capability set has incompatible contracts.
 *
 * Strict mode rejects untyped (V1) declarations entirely. Default mode
 * accepts V1 with conservative {1,0,0} defaults during the migration window.
 *
 * Pure function. No I/O. Caller (workflow installer) gathers the capabilities
 * from the registry and passes them in.
 */

import type {
  Capability,
  NormalizedCapability,
} from "@pm/registry";
import { matchesPattern, normalizeCapability } from "@pm/registry";
import { WorkflowValidationError } from "./errors.js";

export interface ContractValidationOptions {
  /**
   * If true, any V1/untyped capability triggers a validation error.
   * Default: false (migration window). Flip to true once all capabilities
   * are migrated (ADR-0013 step 4).
   */
  readonly strict?: boolean;
}

export interface ContractValidationContext {
  /** All capabilities relevant to the workflow being installed. */
  readonly capabilities: readonly Capability[];
  /** Workflow name + version for error messages. */
  readonly workflowName: string;
  readonly workflowVersion: number;
}

/**
 * Validate that the given set of capabilities can compose safely. Throws
 * `WorkflowValidationError` with a structured message on the first failure.
 */
export const validateCapabilityContracts = (
  ctx: ContractValidationContext,
  options: ContractValidationOptions = {},
): void => {
  const normalized = ctx.capabilities.map(normalizeCapability);

  // 1. Strict-mode: refuse untyped declarations.
  if (options.strict) {
    for (const cap of normalized) {
      if (cap.untyped) {
        throw new WorkflowValidationError(
          `workflow "${ctx.workflowName}" v${ctx.workflowVersion}: ` +
            `capability "${cap.name}" v${cap.version} has untyped (V1) ` +
            `contract declarations; --strict mode requires all capabilities ` +
            `to use typed contracts. See ADR-0013.`,
        );
      }
    }
  }

  // 2. Producer ↔ subscriber compatibility check.
  validateEmitSubscribeCompatibility(ctx.workflowName, ctx.workflowVersion, normalized);

  // 3. Ownership conflict check.
  validateWriteOwnership(ctx.workflowName, ctx.workflowVersion, normalized);
};

/**
 * For each subscriber, find producers in the same set whose emit type matches
 * the subscriber pattern. Verify the producer's schema major version is
 * within the subscriber's accepted range.
 *
 * If a subscriber has no matching producer in the workflow's capability set,
 * that's NOT an error — events can be produced by capabilities outside the
 * workflow (e.g., a different workflow's capabilities, or a webhook source).
 * The check is "if you connect, you must be compatible," not "you must connect."
 */
const validateEmitSubscribeCompatibility = (
  workflowName: string,
  workflowVersion: number,
  capabilities: readonly NormalizedCapability[],
): void => {
  for (const subscriber of capabilities) {
    for (const sub of subscriber.subscribesTo) {
      // Find all producers in the set that emit a type matching this pattern.
      const matches = capabilities.flatMap((producer) =>
        producer.emits
          .filter((e) => matchesPattern(sub.pattern, e.schema.type))
          .map((e) => ({ producer, emit: e })),
      );

      for (const m of matches) {
        const prodMajor = m.emit.schema.version.major;
        if (prodMajor < sub.accepts.minMajor || prodMajor > sub.accepts.maxMajor) {
          throw new WorkflowValidationError(
            `workflow "${workflowName}" v${workflowVersion}: ` +
              `capability "${subscriber.name}" v${subscriber.version} subscribes to ` +
              `"${sub.pattern}" with accepts={minMajor:${sub.accepts.minMajor}, ` +
              `maxMajor:${sub.accepts.maxMajor}}, but capability "${m.producer.name}" ` +
              `v${m.producer.version} emits "${m.emit.schema.type}" at major version ` +
              `${prodMajor}. Producer is outside subscriber's accepted range. ` +
              `Either widen accepts.maxMajor on the subscriber or downgrade the producer.`,
          );
        }
      }
    }
  }
};

/**
 * Refuse two `ownership: "owner"` claims for the same `(interface, field)` tuple.
 * Two contributors are fine; one owner + N contributors is fine; two owners
 * is the conflict the substrate refuses.
 */
const validateWriteOwnership = (
  workflowName: string,
  workflowVersion: number,
  capabilities: readonly NormalizedCapability[],
): void => {
  /** Map from "interface.field" -> capability that owns it. */
  const owners = new Map<string, NormalizedCapability>();

  for (const cap of capabilities) {
    for (const w of cap.writes) {
      if (w.ownership !== "owner") continue;
      // Field-empty owner claim covers the whole interface.
      const targets = w.fields.length > 0 ? w.fields : ["*"];
      for (const field of targets) {
        const key = `${w.interface}.${field}`;
        const existing = owners.get(key);
        if (existing && existing.name !== cap.name) {
          throw new WorkflowValidationError(
            `workflow "${workflowName}" v${workflowVersion}: ` +
              `capabilities "${existing.name}" and "${cap.name}" both claim ` +
              `ownership of write target "${key}". Only one capability may ` +
              `own a (interface, field) tuple. Change one to ownership="contributor" ` +
              `or split the field set so they don't overlap.`,
          );
        }
        owners.set(key, cap);
      }
    }
  }
};
