import { createServer } from "node:http";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

import {
  stateBenchLearningAdapter,
  type StateBenchExtractionCollectionInput,
  type StateBenchExtractionKind,
  type StateBenchOfficialCollectionInput,
  type StateBenchOutputConformanceReceipt,
  type StateBenchRetrievalIdentity,
  type StateBenchRetrievalRequest,
  type StateBenchSidecarArm,
} from "./index.js";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function required(name: string): string {
  const value = option(name);
  if (value === undefined || value.length === 0) throw new Error(`${name} is required`);
  return value;
}

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function collectionInput(): StateBenchOfficialCollectionInput {
  const auditRoot = option("--audit-root");
  const artifactPath = option("--artifact");
  const sealPath = option("--seal");
  const extractionProvenancePath = option("--extraction-provenance");
  const pipelineManifestPath = option("--pipeline-manifest");
  const extractorSourcePath = option("--extractor-source");
  const promptPath = option("--prompt");
  const toolsPath = option("--tools");
  const decodingPath = option("--decoding");
  const rawRecordsPath = option("--raw-records");
  return {
    checkoutPath: required("--checkout"),
    resultsPath: required("--results"),
    configPath: required("--config"),
    ...(auditRoot === undefined ? {} : { auditRoot }),
    ...(artifactPath === undefined ? {} : { artifactPath }),
    ...(sealPath === undefined ? {} : { sealPath }),
    ...(extractionProvenancePath === undefined ? {} : { extractionProvenancePath }),
    ...(pipelineManifestPath === undefined ? {} : { pipelineManifestPath }),
    ...(extractorSourcePath === undefined ? {} : { extractorSourcePath }),
    ...(promptPath === undefined ? {} : { promptPath }),
    ...(toolsPath === undefined ? {} : { toolsPath }),
    ...(decodingPath === undefined ? {} : { decodingPath }),
    ...(rawRecordsPath === undefined ? {} : { rawRecordsPath }),
  };
}

function extractionInput(): StateBenchExtractionCollectionInput {
  return {
    checkoutPath: required("--checkout"),
    artifactPath: required("--artifact"),
    artifactSealPath: required("--seal"),
    pipelineManifestPath: required("--pipeline-manifest"),
    extractorSourcePath: required("--extractor-source"),
    promptPath: required("--prompt"),
    toolsPath: required("--tools"),
    decodingPath: required("--decoding"),
    rawRecordsPath: required("--raw-records"),
  };
}

function pipelineFiles(): Pick<
  StateBenchExtractionCollectionInput,
  "pipelineManifestPath" | "extractorSourcePath" | "promptPath" | "toolsPath" | "decodingPath"
> {
  return {
    pipelineManifestPath: required("--pipeline-manifest"),
    extractorSourcePath: required("--extractor-source"),
    promptPath: required("--prompt"),
    toolsPath: required("--tools"),
    decodingPath: required("--decoding"),
  };
}

async function serve(): Promise<void> {
  const checkoutPath = required("--checkout");
  const artifactPath = required("--artifact");
  const sealPath = required("--seal");
  const provenanceInput = extractionInput();
  const extractionProvenancePath = required("--extraction-provenance");
  const config = stateBenchLearningAdapter.loadRunConfig(required("--config"));
  if (config.arm === "native") {
    throw new Error("native arm uses upstream StateBenchAgent and must not start a retrieval sidecar");
  }
  const sidecarArm: StateBenchSidecarArm = config.arm;
  const artifact = stateBenchLearningAdapter.loadProvenanceBoundArtifact(
    provenanceInput,
    extractionProvenancePath,
  );
  stateBenchLearningAdapter.assertRunArtifactCoverage(
    artifact,
    config,
    new Date().toISOString(),
  );
  const seal = readJson(sealPath) as { sealHash?: unknown };
  if (seal.sealHash !== config.artifactSealHash) {
    throw new Error("run config artifactSealHash does not match the verified seal");
  }
  const provenance = readJson(extractionProvenancePath) as { receiptHash?: unknown };
  if (provenance.receiptHash !== config.extractionProvenanceHash) {
    throw new Error(
      "run config extractionProvenanceHash does not match the verified extraction evidence",
    );
  }
  const runIndex = Number(required("--run-index"));
  const runId = stateBenchLearningAdapter.officialRunId(config, runIndex);
  const configSha256 = stateBenchLearningAdapter.runConfigSha256(config);
  const officialTasks = new Set(
    stateBenchLearningAdapter.officialTaskIds(checkoutPath, config.domain),
  );
  const port = Number(option("--port") ?? "4319");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("--port is invalid");
  }

  const auditPath = resolve(required("--audit-log"));
  if (existsSync(auditPath)) {
    throw new Error("--audit-log already exists; sidecar audit logs are immutable");
  }
  mkdirSync(dirname(auditPath), { recursive: true });
  const session = stateBenchLearningAdapter.createAuditSession(
    config,
    runIndex,
    new Date().toISOString(),
  );
  writeFileSync(auditPath, `${JSON.stringify(session)}\n`, { flag: "wx", mode: 0o600 });
  let sequence = 0;
  let previousHash = session.recordHash;

  const server = createServer((request, response) => {
    if (request.method !== "POST" || request.url !== "/retrieve") {
      response.writeHead(404).end();
      return;
    }
    const chunks: Buffer[] = [];
    let byteCount = 0;
    request.on("data", (chunk: Buffer) => {
      byteCount += chunk.length;
      if (byteCount <= 65_536) chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        if (byteCount > 65_536) throw new Error("retrieval request exceeds 64 KiB");
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
          query?: unknown;
          top_k?: unknown;
          identity?: unknown;
        };
        const identity = body.identity as StateBenchRetrievalIdentity;
        if (
          identity?.experimentId !== config.experimentId ||
          identity?.configSha256 !== configSha256 ||
          identity?.runId !== runId ||
          identity?.domain !== config.domain ||
          identity?.modelId !== config.agentModel.modelId ||
          !officialTasks.has(identity?.taskId)
        ) {
          throw new Error("retrieval identity is not bound to this held-out run session");
        }
        const retrievalRequest: StateBenchRetrievalRequest = {
          query: String(body.query ?? ""),
          topK: body.top_k as 3,
          arm: sidecarArm,
          requestedAt: new Date().toISOString(),
          identity,
        };
        const result = stateBenchLearningAdapter.retrieve(artifact, retrievalRequest);
        const record = stateBenchLearningAdapter.createAuditRetrieval(
          previousHash,
          sequence + 1,
          retrievalRequest,
          result,
          new Date().toISOString(),
        );
        appendFileSync(auditPath, `${JSON.stringify(record)}\n`);
        sequence = record.sequence;
        previousHash = record.recordHash;
        response
          .writeHead(200, {
            "content-type": "application/json",
            "cache-control": "no-store",
          })
          .end(JSON.stringify(result));
      } catch (error) {
        response
          .writeHead(400, {
            "content-type": "application/json",
            "cache-control": "no-store",
          })
          .end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
      }
    });
  });
  server.listen(port, "127.0.0.1", () => {
    print({
      status: "listening",
      port,
      arm: config.arm,
      runId,
      configSha256,
      auditPath,
      evidenceClass: stateBenchLearningAdapter.manifest.evidenceClasses.adapterConformance.id,
    });
  });
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === "serve") return serve();
  if (command === "manifest") return print(stateBenchLearningAdapter.manifest);
  if (command === "verify-checkout") {
    const result = stateBenchLearningAdapter.verifyCheckout(required("--checkout"));
    print(result);
    if (!result.valid) process.exitCode = 1;
    return;
  }
  if (command === "seal-artifact") {
    return print(
      stateBenchLearningAdapter.createTrainArtifactSeal(
        required("--checkout"),
        required("--artifact"),
      ),
    );
  }
  if (command === "verify-artifact") {
    const result = stateBenchLearningAdapter.verifyTrainArtifactSeal(
      required("--checkout"),
      required("--artifact"),
      readJson(required("--seal")),
    );
    print(result);
    if (!result.valid) process.exitCode = 1;
    return;
  }
  if (command === "create-extraction-manifest") {
    const extractorKind = required("--extractor-kind") as StateBenchExtractionKind;
    const modelId = option("--model-id");
    const modelDigest = option("--model-digest");
    const deterministicExtractorId = option("--deterministic-extractor-id");
    return print(
      stateBenchLearningAdapter.createExtractionPipelineManifest({
        manifestId: required("--manifest-id"),
        declaredAt: required("--declared-at"),
        extractorKind,
        extractorSourceRevision: required("--extractor-source-revision"),
        extractorSourcePath: required("--extractor-source"),
        ...(modelId === undefined ? {} : { modelId }),
        ...(modelDigest === undefined ? {} : { modelDigest }),
        ...(deterministicExtractorId === undefined ? {} : { deterministicExtractorId }),
        promptPath: required("--prompt"),
        toolsPath: required("--tools"),
        decodingPath: required("--decoding"),
      }),
    );
  }
  if (command === "verify-extraction-manifest") {
    const result = stateBenchLearningAdapter.verifyExtractionPipelineManifest(
      pipelineFiles(),
      readJson(required("--pipeline-manifest")),
    );
    print(result);
    if (!result.valid) process.exitCode = 1;
    return;
  }
  if (command === "record-extraction") {
    return print(
      stateBenchLearningAdapter.createRawExtractionRecord({
        checkoutPath: required("--checkout"),
        artifactPath: required("--artifact"),
        ...pipelineFiles(),
        learningId: required("--learning-id"),
        sequence: Number(required("--sequence")),
        recordedAt: required("--recorded-at"),
        rawOutputPath: required("--raw-output"),
      }),
    );
  }
  if (command === "seal-extraction") {
    return print(
      stateBenchLearningAdapter.createExtractionProvenanceReceipt(extractionInput()),
    );
  }
  if (command === "verify-extraction") {
    const result = stateBenchLearningAdapter.verifyExtractionProvenanceReceipt(
      extractionInput(),
      readJson(required("--extraction-provenance")),
    );
    print(result);
    if (!result.valid) process.exitCode = 1;
    return;
  }
  if (command === "config-hash") {
    const config = stateBenchLearningAdapter.loadRunConfig(required("--config"));
    return print({ configSha256: stateBenchLearningAdapter.runConfigSha256(config) });
  }
  if (command === "verify-metrics") {
    const result = stateBenchLearningAdapter.verifyOfficialMetrics(
      readJson(required("--metrics")),
    );
    print(result);
    if (!result.valid) process.exitCode = 1;
    return;
  }
  if (command === "collect-output") {
    return print(stateBenchLearningAdapter.collectOutputConformanceReceipt(collectionInput()));
  }
  if (command === "verify-output") {
    const result = stateBenchLearningAdapter.verifyOutputConformanceReceipt(
      collectionInput(),
      readJson(required("--receipt")),
    );
    print(result);
    if (!result.valid) process.exitCode = 1;
    return;
  }
  if (command === "convert-to-public-attempt") {
    return stateBenchLearningAdapter.convertConformanceReceiptToPublicEvalAttemptArtifact(
      readJson(required("--receipt")) as StateBenchOutputConformanceReceipt,
    );
  }
  throw new Error(
    "usage: <serve|manifest|verify-checkout|seal-artifact|verify-artifact|create-extraction-manifest|verify-extraction-manifest|record-extraction|seal-extraction|verify-extraction|config-hash|verify-metrics|collect-output|verify-output|convert-to-public-attempt> [options]",
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
