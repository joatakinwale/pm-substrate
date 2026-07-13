import { readFileSync } from "node:fs";

import {
  assessToolSandboxPublicEvalAttemptEligibility,
  convertToolSandboxRawVerificationToPublicEvalAttemptArtifacts,
  toolSandboxVerticalSlice,
  verifyRawMatchedBatch,
} from "./index.js";

function readJson(path: string | undefined): unknown {
  if (path === undefined) throw new Error("a JSON file path is required");
  return JSON.parse(readFileSync(path === "-" ? 0 : path, "utf8")) as unknown;
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function usage(): never {
  throw new Error(
    "usage: public-eval manifest | verify-corpus <ToolSandbox checkout> | qualify-headline <qualification-input.json> | run-matched-batch <batch-input.json> | verify-matched-batch <verification-input.json> | assess-public-eval-eligibility <raw-verification.json> | convert-public-eval-attempts <raw-verification.json> | create <attempt-input.json> | verify <receipt-set.json> | admit-tool <request.json|-> | record-tool-outcome <request.json|->",
  );
}

try {
  const [command, argument] = process.argv.slice(2);
  switch (command) {
    case "manifest":
      writeJson(toolSandboxVerticalSlice.manifest);
      break;
    case "verify-corpus":
      if (argument === undefined) usage();
      writeJson(toolSandboxVerticalSlice.verifyCorpusRoot(argument));
      break;
    case "create":
      writeJson(
        toolSandboxVerticalSlice.createReceipt(
          readJson(argument) as Parameters<
            typeof toolSandboxVerticalSlice.createReceipt
          >[0],
        ),
      );
      break;
    case "qualify-headline":
      writeJson(
        toolSandboxVerticalSlice.runOfficialHeadlineQualification(
          readJson(argument) as Parameters<
            typeof toolSandboxVerticalSlice.runOfficialHeadlineQualification
          >[0],
        ),
      );
      break;
    case "run-matched-batch":
      writeJson(
        toolSandboxVerticalSlice.runMatchedEfficacyBatch(
          readJson(argument) as Parameters<
            typeof toolSandboxVerticalSlice.runMatchedEfficacyBatch
          >[0],
        ),
      );
      break;
    case "verify-matched-batch":
      writeJson(
        verifyRawMatchedBatch(
          readJson(argument) as Parameters<typeof verifyRawMatchedBatch>[0],
        ),
      );
      break;
    case "assess-public-eval-eligibility":
      writeJson(
        assessToolSandboxPublicEvalAttemptEligibility(readJson(argument)),
      );
      break;
    case "convert-public-eval-attempts":
      writeJson(
        convertToolSandboxRawVerificationToPublicEvalAttemptArtifacts(
          readJson(argument),
        ),
      );
      break;
    case "admit-tool":
      writeJson(
        toolSandboxVerticalSlice.admitToolProposal(
          readJson(argument) as Parameters<
            typeof toolSandboxVerticalSlice.admitToolProposal
          >[0],
        ),
      );
      break;
    case "record-tool-outcome":
      writeJson(
        toolSandboxVerticalSlice.recordToolOutcome(
          readJson(argument) as Parameters<
            typeof toolSandboxVerticalSlice.recordToolOutcome
          >[0],
        ),
      );
      break;
    case "verify": {
      const value = readJson(argument);
      if (!Array.isArray(value)) throw new Error("receipt-set JSON must be an array");
      writeJson(toolSandboxVerticalSlice.verifyReceiptSet(value));
      break;
    }
    default:
      usage();
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`public-eval: ${message}\n`);
  process.exitCode = 1;
}
