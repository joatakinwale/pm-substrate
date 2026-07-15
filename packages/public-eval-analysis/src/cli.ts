#!/usr/bin/env node

import { readFileSync } from "node:fs";

import { analyzePublicEval } from "./analyze.js";
import {
  createPublicEvalDecisionTrustPolicy,
  createPublicEvalExecutionTimestampReceipt,
  createPublicEvalPreregistrationReceipt,
  createPublicEvalVerificationReceipt,
  evaluatePublicEvalDecisionBundle,
  publicEvalEvidenceSetRoot,
  type PublicEvalDecisionBundleInput,
  type PublicEvalDecisionTrustPolicyInput,
  type PublicEvalExecutionTimestampReceiptInput,
  type PublicEvalPreregistrationReceiptInput,
  type PublicEvalVerificationReceiptInput,
} from "./decision.js";
import {
  createPublicEvalAnalysisManifest,
  createPublicEvalAttemptArtifact,
  type PublicEvalAnalysisManifestInput,
  type PublicEvalAttemptArtifactInput,
} from "./schema.js";

function readJson(path: string | undefined): unknown {
  if (path === undefined) throw new Error("a JSON file path is required");
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function usage(): never {
  throw new Error(
    "usage: pm-public-eval-analysis manifest <manifest-input.json> | " +
      "attempt <attempt-input.json> | analyze <analysis-input.json> | " +
      "trust-policy <policy-input.json> | evidence-root <evidence-array.json> | " +
      "preregister <receipt-input.json> <ed25519-private-key.pem> | " +
      "execution-timestamp-receipt <receipt-input.json> <ed25519-private-key.pem> | " +
      "verification-receipt <receipt-input.json> <ed25519-private-key.pem> | " +
      "decide <decision-bundle.json> <trust-policy.json> <expected-policy-sha256>",
  );
}

try {
  const [command, path, auxiliaryPath, expectedHashArgument] =
    process.argv.slice(2);
  switch (command) {
    case "manifest":
      writeJson(
        createPublicEvalAnalysisManifest(
          readJson(path) as PublicEvalAnalysisManifestInput,
        ),
      );
      break;
    case "attempt":
      writeJson(
        createPublicEvalAttemptArtifact(
          readJson(path) as PublicEvalAttemptArtifactInput,
        ),
      );
      break;
    case "analyze":
      writeJson(
        analyzePublicEval(
          readJson(path) as Parameters<typeof analyzePublicEval>[0],
        ),
      );
      break;
    case "verification-receipt":
      if (auxiliaryPath === undefined) {
        throw new Error("an Ed25519 private-key path is required");
      }
      writeJson(
        createPublicEvalVerificationReceipt(
          readJson(path) as PublicEvalVerificationReceiptInput,
          readFileSync(auxiliaryPath, "utf8"),
        ),
      );
      break;
    case "preregister":
      if (auxiliaryPath === undefined) {
        throw new Error("an Ed25519 private-key path is required");
      }
      writeJson(
        createPublicEvalPreregistrationReceipt(
          readJson(path) as PublicEvalPreregistrationReceiptInput,
          readFileSync(auxiliaryPath, "utf8"),
        ),
      );
      break;
    case "execution-timestamp-receipt":
      if (auxiliaryPath === undefined) {
        throw new Error("an Ed25519 private-key path is required");
      }
      writeJson(
        createPublicEvalExecutionTimestampReceipt(
          readJson(path) as PublicEvalExecutionTimestampReceiptInput,
          readFileSync(auxiliaryPath, "utf8"),
        ),
      );
      break;
    case "trust-policy":
      writeJson(
        createPublicEvalDecisionTrustPolicy(
          readJson(path) as PublicEvalDecisionTrustPolicyInput,
        ),
      );
      break;
    case "evidence-root": {
      const evidence = readJson(path);
      if (!Array.isArray(evidence)) {
        throw new Error("evidence-root input must be a JSON array");
      }
      writeJson({ evidenceSetRootHash: publicEvalEvidenceSetRoot(evidence) });
      break;
    }
    case "decide":
      if (auxiliaryPath === undefined) {
        throw new Error("a trust-policy JSON path is required");
      }
      writeJson(
        evaluatePublicEvalDecisionBundle(
          readJson(path) as PublicEvalDecisionBundleInput,
          readJson(auxiliaryPath),
          expectedHashArgument ??
            process.env["PM_PUBLIC_EVAL_TRUST_POLICY_SHA256"] ??
            "",
        ),
      );
      break;
    default:
      usage();
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`pm-public-eval-analysis: ${message}\n`);
  process.exitCode = 1;
}
