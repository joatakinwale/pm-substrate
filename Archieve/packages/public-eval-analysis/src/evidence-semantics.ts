import { TextDecoder } from "node:util";

import {
  PUBLIC_EVAL_VERIFICATION_KINDS,
  type PublicEvalVerificationKind,
} from "./schema.js";

const SHA256 = /^[a-f0-9]{64}$/;

export const PUBLIC_EVAL_REQUIRED_CHECKS: Readonly<
  Record<PublicEvalVerificationKind, readonly string[]>
> = {
  attempt_set: [
    "raw_artifacts_resolved",
    "attempt_hashes_recomputed",
    "usage_recomputed",
    "execution_bindings_recomputed",
    "sham_overhead_equivalence_recomputed",
    "unique_attempts_recomputed",
  ],
  oracle_independence: [
    "upstream_oracle_recomputed",
    "oracle_does_not_import_substrate_gate",
  ],
  split_leakage: [
    "eligible_universe_bound",
    "qualification_disjoint",
    "heldout_selection_recomputed",
    "canonical_task_uniqueness_recomputed",
    "replication_schedule_matched",
  ],
  anti_degenerate_controls: [
    "allow_all_rejected",
    "block_all_rejected",
    "expected_allow_passed",
    "expected_block_passed",
    "irrelevant_mutation_passed",
  ],
  restart_dynamic_state: [
    "restart_case_exercised",
    "lost_response_retry_exercised",
    "dynamic_state_case_exercised",
    "collateral_state_checked",
    "aba_checked",
    "duplicate_out_of_order_checked",
    "authority_checked",
    "concurrent_write_checked",
  ],
  clean_checkout: [
    "fresh_checkout",
    "pinned_revisions_recomputed",
    "analysis_recomputed",
    "model_identities_resolved",
    "non_model_configs_recomputed",
  ],
};

const OBSERVATION_SCHEMA_VERSIONS: Readonly<
  Record<PublicEvalVerificationKind, string>
> = {
  attempt_set: "pm.public-eval.verification-observation.attempt-set.v1",
  oracle_independence:
    "pm.public-eval.verification-observation.oracle-independence.v1",
  split_leakage:
    "pm.public-eval.verification-observation.split-leakage.v1",
  anti_degenerate_controls:
    "pm.public-eval.verification-observation.anti-degenerate-controls.v1",
  restart_dynamic_state:
    "pm.public-eval.verification-observation.restart-dynamic-state.v1",
  clean_checkout:
    "pm.public-eval.verification-observation.clean-checkout.v1",
};

export interface ParsedPublicEvalSemanticObservation {
  readonly kind: PublicEvalVerificationKind;
  readonly checkName: string;
  readonly subjectHash: string;
  readonly procedure: string;
  readonly passed: boolean;
}

/**
 * Recomputes one verification result from canonical, procedure-versioned
 * facts. There is deliberately no observation-level `passed` input.
 */
export function parsePublicEvalSemanticObservation(
  bytes: Uint8Array,
  mediaType: string,
  expectedKind: PublicEvalVerificationKind,
  path: string,
): ParsedPublicEvalSemanticObservation {
  if (mediaType !== "application/json") {
    throw new Error(`${path}.mediaType must be application/json`);
  }
  let text: string;
  let decoded: unknown;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    decoded = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${path} semantic observation must be valid UTF-8 JSON`);
  }
  if (canonicalJsonString(decoded) !== text) {
    throw new Error(`${path} semantic observation must use canonical JSON encoding`);
  }
  const observation = record(decoded, `${path}.semanticObservation`);
  exactKeys(
    observation,
    ["schemaVersion", "kind", "checkName", "subjectHash", "procedure", "facts"],
    `${path}.semanticObservation`,
  );
  const kind = enumValue(
    observation["kind"],
    PUBLIC_EVAL_VERIFICATION_KINDS,
    `${path}.semanticObservation.kind`,
  );
  if (kind !== expectedKind) {
    throw new Error(`${path} semantic observation kind mismatch`);
  }
  if (observation["schemaVersion"] !== OBSERVATION_SCHEMA_VERSIONS[kind]) {
    throw new Error(`${path} semantic observation schema is unsupported`);
  }
  const checkName = nonEmpty(
    observation["checkName"],
    `${path}.semanticObservation.checkName`,
  );
  requireKnownCheck(kind, checkName);
  const procedure = nonEmpty(
    observation["procedure"],
    `${path}.semanticObservation.procedure`,
  );
  const expectedProcedure = verificationProcedure(kind, checkName);
  if (procedure !== expectedProcedure) {
    throw new Error(
      `${path} semantic observation procedure is unsupported for ${kind}/${checkName}`,
    );
  }
  const subjectHash = sha(
    observation["subjectHash"],
    `${path}.semanticObservation.subjectHash`,
  );
  const passed = recomputeResult(
    kind,
    checkName,
    record(observation["facts"], `${path}.semanticObservation.facts`),
    `${path}.semanticObservation.facts`,
  );
  return { kind, checkName, subjectHash, procedure, passed };
}

function verificationProcedure(
  kind: PublicEvalVerificationKind,
  checkName: string,
): string {
  requireKnownCheck(kind, checkName);
  return `pm.public-eval.verify.${kind.replaceAll("_", "-")}.${checkName.replaceAll("_", "-")}.v1`;
}

function recomputeResult(
  kind: PublicEvalVerificationKind,
  checkName: string,
  facts: Record<string, unknown>,
  path: string,
): boolean {
  if (kind === "attempt_set") {
    if (checkName === "raw_artifacts_resolved") {
      return countComparison(
        facts,
        path,
        "referencedArtifactCount",
        "resolvedArtifactCount",
        "missingArtifactHashes",
        "sha",
      );
    }
    if (checkName === "attempt_hashes_recomputed") {
      return countComparison(
        facts,
        path,
        "attemptCount",
        "matchingAttemptHashCount",
        "mismatchedAttemptIds",
      );
    }
    if (checkName === "usage_recomputed") {
      return countComparison(
        facts,
        path,
        "attemptCount",
        "matchingUsageCount",
        "mismatchedAttemptIds",
      );
    }
    if (checkName === "execution_bindings_recomputed") {
      return countComparison(
        facts,
        path,
        "attemptCount",
        "matchingExecutionBindingCount",
        "mismatchedAttemptIds",
      );
    }
    if (checkName === "sham_overhead_equivalence_recomputed") {
      return countComparison(
        facts,
        path,
        "comparisonCount",
        "equivalentComparisonCount",
        "mismatchedDimensions",
      );
    }
    if (checkName === "unique_attempts_recomputed") {
      return countComparison(
        facts,
        path,
        "attemptCount",
        "uniqueAttemptIdCount",
        "duplicateAttemptIds",
      );
    }
  }

  if (kind === "oracle_independence") {
    if (checkName === "upstream_oracle_recomputed") {
      return countComparison(
        facts,
        path,
        "attemptCount",
        "matchingOracleOutcomeCount",
        "mismatchedAttemptIds",
      );
    }
    if (checkName === "oracle_does_not_import_substrate_gate") {
      exactKeys(facts, ["sourceFileCount", "forbiddenImportMatches"], path);
      const sourceFileCount = integer(
        facts["sourceFileCount"],
        `${path}.sourceFileCount`,
        1,
      );
      const forbidden = stringArray(
        facts["forbiddenImportMatches"],
        `${path}.forbiddenImportMatches`,
        false,
      );
      return sourceFileCount > 0 && forbidden.length === 0;
    }
  }

  if (kind === "split_leakage") {
    if (checkName === "eligible_universe_bound") {
      exactKeys(
        facts,
        [
          "declaredUniverseCount",
          "observedUniverseCount",
          "expectedUniverseRootHash",
          "observedUniverseRootHash",
          "missingTaskContentHashes",
          "unexpectedTaskContentHashes",
        ],
        path,
      );
      const declaredCount = integer(
        facts["declaredUniverseCount"],
        `${path}.declaredUniverseCount`,
        1,
      );
      const observedCount = integer(
        facts["observedUniverseCount"],
        `${path}.observedUniverseCount`,
        0,
      );
      const expectedRoot = sha(
        facts["expectedUniverseRootHash"],
        `${path}.expectedUniverseRootHash`,
      );
      const observedRoot = sha(
        facts["observedUniverseRootHash"],
        `${path}.observedUniverseRootHash`,
      );
      const missing = shaArray(
        facts["missingTaskContentHashes"],
        `${path}.missingTaskContentHashes`,
        false,
      );
      const unexpected = shaArray(
        facts["unexpectedTaskContentHashes"],
        `${path}.unexpectedTaskContentHashes`,
        false,
      );
      return (
        declaredCount === observedCount &&
        expectedRoot === observedRoot &&
        missing.length === 0 &&
        unexpected.length === 0
      );
    }
    if (checkName === "qualification_disjoint") {
      exactKeys(
        facts,
        ["qualificationTaskContentHashes", "decisionTaskContentHashes"],
        path,
      );
      const qualification = shaArray(
        facts["qualificationTaskContentHashes"],
        `${path}.qualificationTaskContentHashes`,
        true,
      );
      const decision = new Set(
        shaArray(
          facts["decisionTaskContentHashes"],
          `${path}.decisionTaskContentHashes`,
          true,
        ),
      );
      return qualification.every((hash) => !decision.has(hash));
    }
    if (checkName === "heldout_selection_recomputed") {
      return hashSetComparison(
        facts,
        path,
        "expectedTaskContentHashes",
        "observedTaskContentHashes",
      );
    }
    if (checkName === "canonical_task_uniqueness_recomputed") {
      exactKeys(facts, ["canonicalTaskIds"], path);
      const identifiers = stringArray(
        facts["canonicalTaskIds"],
        `${path}.canonicalTaskIds`,
        true,
        false,
      );
      return new Set(identifiers).size === identifiers.length;
    }
    if (checkName === "replication_schedule_matched") {
      return hashSetComparison(
        facts,
        path,
        "confirmatoryScheduleHashes",
        "replicationScheduleHashes",
      );
    }
  }

  if (kind === "anti_degenerate_controls") {
    if (checkName === "allow_all_rejected" || checkName === "block_all_rejected") {
      exactKeys(facts, ["caseCount", "observedOutcome", "failingCaseIds"], path);
      const caseCount = integer(facts["caseCount"], `${path}.caseCount`, 1);
      const outcome = enumValue(
        facts["observedOutcome"],
        ["rejected", "accepted", "not_run"] as const,
        `${path}.observedOutcome`,
      );
      const failures = stringArray(
        facts["failingCaseIds"],
        `${path}.failingCaseIds`,
        false,
      );
      return caseCount > 0 && outcome === "rejected" && failures.length === 0;
    }
    if (
      checkName === "expected_allow_passed" ||
      checkName === "expected_block_passed" ||
      checkName === "irrelevant_mutation_passed"
    ) {
      return countComparison(
        facts,
        path,
        "caseCount",
        "passingCaseCount",
        "failedCaseIds",
      );
    }
  }

  if (kind === "restart_dynamic_state") {
    return countComparison(
      facts,
      path,
      "caseCount",
      "passingCaseCount",
      "failedCaseIds",
    );
  }

  if (kind === "clean_checkout") {
    if (checkName === "fresh_checkout") {
      exactKeys(
        facts,
        [
          "checkoutCreated",
          "dirtyPathCount",
          "untrackedPathCount",
          "expectedSourceTreeHash",
          "observedSourceTreeHash",
        ],
        path,
      );
      if (typeof facts["checkoutCreated"] !== "boolean") {
        throw new Error(`${path}.checkoutCreated must be boolean`);
      }
      const dirty = integer(facts["dirtyPathCount"], `${path}.dirtyPathCount`, 0);
      const untracked = integer(
        facts["untrackedPathCount"],
        `${path}.untrackedPathCount`,
        0,
      );
      const expectedTree = sha(
        facts["expectedSourceTreeHash"],
        `${path}.expectedSourceTreeHash`,
      );
      const observedTree = sha(
        facts["observedSourceTreeHash"],
        `${path}.observedSourceTreeHash`,
      );
      return (
        facts["checkoutCreated"] &&
        dirty === 0 &&
        untracked === 0 &&
        expectedTree === observedTree
      );
    }
    if (checkName === "pinned_revisions_recomputed") {
      return hashSetComparison(
        facts,
        path,
        "expectedRevisionHashes",
        "observedRevisionHashes",
      );
    }
    if (checkName === "analysis_recomputed") {
      exactKeys(
        facts,
        ["expectedAnalysisReportHash", "observedAnalysisReportHash"],
        path,
      );
      return (
        sha(
          facts["expectedAnalysisReportHash"],
          `${path}.expectedAnalysisReportHash`,
        ) ===
        sha(
          facts["observedAnalysisReportHash"],
          `${path}.observedAnalysisReportHash`,
        )
      );
    }
    if (checkName === "model_identities_resolved") {
      return countComparison(
        facts,
        path,
        "declaredModelCount",
        "resolvedModelCount",
        "unresolvedModelIds",
      );
    }
    if (checkName === "non_model_configs_recomputed") {
      return countComparison(
        facts,
        path,
        "declaredConfigCount",
        "recomputedConfigCount",
        "mismatchedConfigIds",
      );
    }
  }

  throw new Error(`no semantic observation verifier for ${kind}/${checkName}`);
}

function countComparison(
  facts: Record<string, unknown>,
  path: string,
  expectedCountKey: string,
  observedCountKey: string,
  failuresKey: string,
  failureType: "sha" | "string" = "string",
): boolean {
  exactKeys(facts, [expectedCountKey, observedCountKey, failuresKey], path);
  const expected = integer(
    facts[expectedCountKey],
    `${path}.${expectedCountKey}`,
    1,
  );
  const observed = integer(
    facts[observedCountKey],
    `${path}.${observedCountKey}`,
    0,
  );
  const failures =
    failureType === "sha"
      ? shaArray(facts[failuresKey], `${path}.${failuresKey}`, false)
      : stringArray(facts[failuresKey], `${path}.${failuresKey}`, false);
  return expected === observed && failures.length === 0;
}

function hashSetComparison(
  facts: Record<string, unknown>,
  path: string,
  expectedKey: string,
  observedKey: string,
): boolean {
  exactKeys(facts, [expectedKey, observedKey], path);
  const expected = shaArray(facts[expectedKey], `${path}.${expectedKey}`, true);
  const observed = shaArray(facts[observedKey], `${path}.${observedKey}`, true);
  const orderedObserved = [...observed].sort(codeUnitCompare);
  return (
    expected.length === observed.length &&
    [...expected]
      .sort(codeUnitCompare)
      .every((value, index) => value === orderedObserved[index])
  );
}

function requireKnownCheck(
  kind: PublicEvalVerificationKind,
  checkName: string,
): void {
  if (!PUBLIC_EVAL_REQUIRED_CHECKS[kind].includes(checkName)) {
    throw new Error(`${kind} has no required check ${checkName}`);
  }
}

function stringArray(
  value: unknown,
  path: string,
  requireEntries: boolean,
  requireUnique: boolean = true,
): readonly string[] {
  if (!Array.isArray(value) || (requireEntries && value.length === 0)) {
    throw new Error(
      `${path} must be ${requireEntries ? "a non-empty" : "an"} array`,
    );
  }
  const parsed = value.map((entry, index) =>
    nonEmpty(entry, `${path}/${index}`),
  );
  if (requireUnique && new Set(parsed).size !== parsed.length) {
    throw new Error(`${path} must contain unique values`);
  }
  return parsed;
}

function shaArray(
  value: unknown,
  path: string,
  requireEntries: boolean,
): readonly string[] {
  return stringArray(value, path, requireEntries).map((entry, index) =>
    sha(entry, `${path}/${index}`),
  );
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  path: string,
): void {
  const actual = Object.keys(value).sort(codeUnitCompare);
  const sorted = [...expected].sort(codeUnitCompare);
  if (JSON.stringify(actual) !== JSON.stringify(sorted)) {
    throw new Error(`${path} keys must be exactly ${sorted.join(", ")}`);
  }
}

function nonEmpty(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
}

function sha(value: unknown, path: string): string {
  const parsed = nonEmpty(value, path);
  if (!SHA256.test(parsed)) throw new Error(`${path} must be lowercase SHA-256`);
  return parsed;
}

function integer(value: unknown, path: string, minimum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new Error(`${path} must be a safe integer >= ${minimum}`);
  }
  return value as number;
}

function enumValue<T extends string>(
  value: unknown,
  values: readonly T[],
  path: string,
): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new Error(`${path} has unsupported value ${JSON.stringify(value)}`);
  }
  return value as T;
}

function canonicalJsonString(value: unknown): string {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("non-finite JSON number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJsonString).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => codeUnitCompare(left, right))
      .map(
        ([key, entry]) =>
          `${JSON.stringify(key)}:${canonicalJsonString(entry)}`,
      )
      .join(",")}}`;
  }
  throw new Error(`unsupported JSON value ${typeof value}`);
}

function codeUnitCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
