import { createHash } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { relative, resolve } from "node:path";

import type {
  BehavioralArm,
  BehavioralEvidenceClass,
} from "./behavioral.js";
import type { PublicEvalCornerId } from "./index.js";

export type BehavioralFailureStage =
  | "pre-execution-verification"
  | "attempt-preparation"
  | "runner-execution"
  | "runner-output-validation"
  | "oracle-execution"
  | "oracle-output-validation"
  | "attempt-artifact-sealing"
  | "post-execution-verification"
  | "completion-receipt-sealing";

export interface BehavioralFailureLocation {
  readonly trialId: string;
  readonly arm: BehavioralArm;
}

export interface BehavioralFailureInventoryEntry {
  readonly path: string;
  readonly byteLength: number;
  readonly sha256: string;
}

export interface BehavioralFailureReceipt {
  readonly schemaVersion: "pm.public-eval-corners.behavioral-failure-receipt.v1";
  readonly evidenceClass: BehavioralEvidenceClass;
  readonly efficacyClaimed: false;
  readonly decisionGating: false;
  readonly eligibleForIndependentAnalysis: false;
  readonly upstreamOutcomesInterpreted: false;
  readonly analysisDisposition: "ineligible-execution-failure";
  readonly batchId: string;
  readonly cornerId: PublicEvalCornerId;
  readonly manifestSha256: string;
  readonly outputRoot: string;
  readonly planPath: "predeclared-plan.json";
  readonly planHash: string;
  readonly planFileSha256: string;
  readonly failureStage: BehavioralFailureStage;
  readonly activeAttempt: BehavioralFailureLocation | null;
  /** The raw error message is deliberately absent from the receipt. */
  readonly errorMessageSha256: string;
  readonly retainedFileInventory: {
    readonly root: ".";
    readonly capturedBeforeFailureReceiptWrite: true;
    readonly receiptSelfExcludedToAvoidRecursiveHash: true;
    readonly files: readonly BehavioralFailureInventoryEntry[];
  };
  readonly receiptHash: string;
}

export interface WriteBehavioralFailureReceiptInput {
  readonly evidenceClass: BehavioralEvidenceClass;
  readonly batchId: string;
  readonly cornerId: PublicEvalCornerId;
  readonly manifestSha256: string;
  readonly outputRoot: string;
  readonly planHash: string;
  readonly planBytes: Uint8Array;
  readonly failureStage: BehavioralFailureStage;
  readonly activeAttempt: BehavioralFailureLocation | null;
  readonly error: unknown;
}

type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

function canonical(value: JsonValue): string {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => canonical(entry)).join(",")}]`;
  const record = value as { readonly [key: string]: JsonValue };
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key] as JsonValue)}`)
    .join(",")}}`;
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function retainedFiles(outputRoot: string): readonly BehavioralFailureInventoryEntry[] {
  const paths: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) visit(path);
      else if (stat.isFile()) paths.push(path);
    }
  };
  visit(outputRoot);
  return paths.sort().map((path) => {
    const bytes = readFileSync(path);
    return {
      path: relative(outputRoot, path),
      byteLength: bytes.byteLength,
      sha256: sha256(bytes),
    };
  });
}

/**
 * Seal an outcome-neutral receipt for an execution that began but did not
 * complete. The receipt inventories bytes only; it never interprets them.
 */
export function writeBehavioralFailureReceipt(
  input: WriteBehavioralFailureReceiptInput,
): BehavioralFailureReceipt {
  mkdirSync(input.outputRoot, { recursive: true });
  const message = input.error instanceof Error ? input.error.message : String(input.error);
  const body = {
    schemaVersion: "pm.public-eval-corners.behavioral-failure-receipt.v1" as const,
    evidenceClass: input.evidenceClass,
    efficacyClaimed: false as const,
    decisionGating: false as const,
    eligibleForIndependentAnalysis: false as const,
    upstreamOutcomesInterpreted: false as const,
    analysisDisposition: "ineligible-execution-failure" as const,
    batchId: input.batchId,
    cornerId: input.cornerId,
    manifestSha256: input.manifestSha256,
    outputRoot: input.outputRoot,
    planPath: "predeclared-plan.json" as const,
    planHash: input.planHash,
    planFileSha256: sha256(input.planBytes),
    failureStage: input.failureStage,
    activeAttempt: input.activeAttempt,
    errorMessageSha256: sha256(message),
    retainedFileInventory: {
      root: "." as const,
      capturedBeforeFailureReceiptWrite: true as const,
      receiptSelfExcludedToAvoidRecursiveHash: true as const,
      files: retainedFiles(input.outputRoot),
    },
  };
  const receiptHash = sha256(canonical(body as unknown as JsonValue));
  const receipt: BehavioralFailureReceipt = { ...body, receiptHash };
  writeFileSync(
    resolve(input.outputRoot, `pm-behavioral-failure-${receiptHash}.json`),
    `${JSON.stringify(receipt, null, 2)}\n`,
    { flag: "wx" },
  );
  return receipt;
}
