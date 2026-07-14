#!/usr/bin/env node

import { readFileSync } from "node:fs";

import {
  publicEvalCorners,
  type AppWorldProjectionDiagnosticInput,
  type ArtifactLabelEnvelope,
  type BehavioralBatchInput,
  type FileSetVerificationRequest,
  type PublicEvalCornerId,
  type QualificationRequest,
} from "./index.js";

function options(name: string): readonly string[] {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1] !== undefined) {
      values.push(process.argv[index + 1] as string);
    }
  }
  return values;
}

function option(name: string): string | undefined {
  return options(name)[0];
}

function required(name: string): string {
  const value = option(name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function jsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function parseBindings(name: string): Readonly<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const binding of options(name)) {
    const separator = binding.indexOf("=");
    if (separator < 1 || separator === binding.length - 1) {
      throw new Error(`${name} must be key=value`);
    }
    result[binding.slice(0, separator)] = binding.slice(separator + 1);
  }
  return result;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function markFailed(valid: boolean): void {
  if (!valid) process.exitCode = 1;
}

function main(): void {
  const command = process.argv[2];
  if (command === "list") {
    print(publicEvalCorners.listManifests());
    return;
  }
  if (command === "manifest") {
    print(publicEvalCorners.getManifest(required("--corner") as PublicEvalCornerId));
    return;
  }
  if (command === "qualification-plan") {
    print(publicEvalCorners.getQualificationPlan(required("--corner") as PublicEvalCornerId));
    return;
  }
  if (command === "verify-files") {
    const result = publicEvalCorners.verifyFileSet(
      jsonFile(required("--spec")) as FileSetVerificationRequest,
    );
    print(result);
    markFailed(result.valid);
    return;
  }
  if (command === "verify-source") {
    const result = publicEvalCorners.verifyPinnedSource({
      cornerId: required("--corner") as PublicEvalCornerId,
      checkoutPath: required("--checkout"),
      externalFiles: parseBindings("--external"),
    });
    print(result);
    markFailed(result.valid);
    return;
  }
  if (command === "validate-label") {
    const result = publicEvalCorners.validateArtifactLabel(
      jsonFile(required("--input")) as ArtifactLabelEnvelope,
    );
    print(result);
    markFailed(result.valid);
    return;
  }
  if (command === "conformance") {
    const result = publicEvalCorners.evaluateSyntheticFixture(jsonFile(required("--input")));
    print(result);
    markFailed(result.passed);
    return;
  }
  if (command === "diagnose-appworld") {
    print(
      publicEvalCorners.diagnoseAppWorldDuplicateProjection(
        jsonFile(required("--input")) as AppWorldProjectionDiagnosticInput,
      ),
    );
    return;
  }
  if (command === "qualify") {
    const request: QualificationRequest = {
      cornerId: required("--corner") as PublicEvalCornerId,
      checkoutPath: required("--checkout"),
      outputDirectory: required("--output-dir"),
      externalFiles: parseBindings("--external"),
      runnerOptions: parseBindings("--runner-option"),
      allowProtectedLocal: hasFlag("--allow-protected-local"),
    };
    const result = publicEvalCorners.runQualification(request);
    print(result);
    markFailed(result.status === "qualified");
    return;
  }
  if (command === "behavioral-plan") {
    const result = publicEvalCorners.planBehavioralBatch(
      jsonFile(required("--input")) as BehavioralBatchInput,
    );
    print(result);
    markFailed(result.valid);
    return;
  }
  if (command === "run-behavioral-batch") {
    const result = publicEvalCorners.runBehavioralBatch(
      jsonFile(required("--input")) as BehavioralBatchInput,
    );
    print(result);
    return;
  }
  if (command === "verify-behavioral-batch") {
    const result = publicEvalCorners.verifyBehavioralBatch(
      jsonFile(required("--receipt")),
    );
    const allowIneligibleConformance = hasFlag("--allow-ineligible-conformance");
    const gatePassed = allowIneligibleConformance
      ? result.valid
      : result.valid && result.eligibleForIndependentAnalysis;
    print({
      ...result,
      cliEvidenceGate: {
        mode: allowIneligibleConformance
          ? "structural-conformance-only"
          : "independent-analysis-required",
        passed: gatePassed,
        explicitIneligibleOverride: allowIneligibleConformance,
      },
    });
    markFailed(gatePassed);
    return;
  }
  throw new Error(
    "usage: <list|manifest|qualification-plan|verify-files|verify-source|validate-label|conformance|diagnose-appworld|qualify|behavioral-plan|run-behavioral-batch|verify-behavioral-batch> [options]; verify-behavioral-batch is an evidence gate unless --allow-ineligible-conformance is explicit",
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
