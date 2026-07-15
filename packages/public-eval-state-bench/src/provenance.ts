import { lstatSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import type {
  StateBenchDomain,
  StateBenchLearningArtifact,
  StateBenchLearningEntry,
  VerificationResult,
} from "./index.js";

export type StateBenchExtractionKind = "model" | "deterministic";

export interface StateBenchExtractionPipelineInput {
  readonly manifestId: string;
  readonly declaredAt: string;
  readonly extractorKind: StateBenchExtractionKind;
  readonly extractorSourceRevision: string;
  readonly extractorSourcePath: string;
  readonly modelId?: string;
  readonly modelDigest?: string;
  readonly deterministicExtractorId?: string;
  readonly promptPath: string;
  readonly toolsPath: string;
  readonly decodingPath: string;
}

export interface StateBenchExtractionPipelineManifest {
  readonly schemaVersion: "pm-state-bench-extraction-pipeline.v1";
  readonly manifestId: string;
  readonly declaredAt: string;
  readonly benchmark: {
    readonly repositoryUrl: string;
    readonly revision: string;
    readonly track: "agent_learning";
    readonly sourceSplit: "train";
    readonly corpusRoot: string;
    readonly corpusSha256: string;
  };
  readonly dataAccessPolicy: {
    readonly allowedBenchmarkSourcePrefix: string;
    readonly additionalBenchmarkInputs: readonly [];
    readonly heldOutPaths: "forbidden";
    readonly oraclePaths: "forbidden";
  };
  readonly extractor: {
    readonly kind: StateBenchExtractionKind;
    readonly sourceRevision: string;
    readonly sourceSha256: string;
    readonly modelId: string | null;
    readonly modelDigest: string | null;
    readonly deterministicExtractorId: string | null;
  };
  readonly procedure: {
    readonly promptSha256: string;
    readonly toolsSha256: string;
    readonly decodingSha256: string;
  };
  readonly outputSchemaVersion: "pm-state-bench-learnings.v1";
  readonly manifestHash: string;
}

export interface StateBenchRawExtractionRecord {
  readonly schemaVersion: "pm-state-bench-raw-extraction-record.v1";
  readonly manifestHash: string;
  readonly sequence: number;
  readonly recordedAt: string;
  readonly learningId: string;
  readonly domain: StateBenchDomain;
  readonly rawOutput: string;
  readonly rawOutputSha256: string;
  readonly artifactEntry: StateBenchLearningEntry;
  readonly artifactEntrySha256: string;
  readonly citedTrainBytes: readonly {
    readonly path: string;
    readonly fileSha256: string;
    readonly encoding: "base64";
    readonly bytesBase64: string;
  }[];
  readonly recordHash: string;
}

export interface StateBenchExtractionCollectionInput {
  readonly checkoutPath: string;
  readonly artifactPath: string;
  readonly artifactSealPath: string;
  readonly pipelineManifestPath: string;
  readonly extractorSourcePath: string;
  readonly promptPath: string;
  readonly toolsPath: string;
  readonly decodingPath: string;
  readonly rawRecordsPath: string;
}

export interface StateBenchRawExtractionRecordInput {
  readonly checkoutPath: string;
  readonly artifactPath: string;
  readonly pipelineManifestPath: string;
  readonly extractorSourcePath: string;
  readonly promptPath: string;
  readonly toolsPath: string;
  readonly decodingPath: string;
  readonly learningId: string;
  readonly sequence: number;
  readonly recordedAt: string;
  readonly rawOutputPath: string;
}

export interface StateBenchExtractionProvenanceReceipt {
  readonly schemaVersion: "pm-state-bench-extraction-provenance.v1";
  readonly evidenceClass: "training_extraction_byte_and_procedure_provenance";
  readonly authorityStatus: "evidence_only";
  readonly claimBoundary: "byte_and_declared_procedure_provenance_not_semantic_truth_or_runtime_noninterference";
  readonly benchmark: {
    readonly repositoryUrl: string;
    readonly revision: string;
    readonly sourceSplit: "train";
    readonly corpusRoot: string;
    readonly corpusFileCount: number;
    readonly corpusSha256: string;
  };
  readonly pipeline: {
    readonly manifestId: string;
    readonly manifestHash: string;
    readonly declaredAt: string;
    readonly extractorKind: StateBenchExtractionKind;
    readonly extractorSourceRevision: string;
    readonly extractorSourceSha256: string;
    readonly modelId: string | null;
    readonly modelDigest: string | null;
    readonly deterministicExtractorId: string | null;
    readonly promptSha256: string;
    readonly toolsSha256: string;
    readonly decodingSha256: string;
  };
  readonly sourcePolicy: {
    readonly declaredBenchmarkInputs: readonly [string];
    readonly allCitationsReopenedFromPinnedTrainBytes: true;
    readonly heldOutOrOraclePathsDeclared: false;
  };
  readonly artifact: {
    readonly artifactSha256: string;
    readonly artifactSealHash: string;
    readonly entryCount: number;
  };
  readonly rawRecords: {
    readonly fileCount: number;
    readonly treeSha256: string;
    readonly entries: readonly {
      readonly sequence: number;
      readonly learningId: string;
      readonly path: string;
      readonly fileSha256: string;
      readonly recordHash: string;
      readonly rawOutputSha256: string;
      readonly artifactEntrySha256: string;
      readonly citedTrainPaths: readonly string[];
    }[];
  };
  readonly receiptHash: string;
}



interface CorpusFile {
  readonly path: string;
  readonly absolutePath: string;
  readonly domain: StateBenchDomain;
  readonly taskId: string;
  readonly fileSha256: string;
}

interface ExtractionProvenanceDependencies {
  readonly STATE_BENCH_MANIFEST: {
    readonly upstreamUrl: string;
    readonly upstreamRevision: string;
    readonly trainCorpusRoot: string;
    readonly trainCorpusSha256: string;
  };
  readonly TRAIN_PREFIX: string;
  readonly sha256: (bytes: string | Buffer) => string;
  readonly canonical: (value: unknown) => string;
  readonly isObject: (value: unknown) => value is Readonly<Record<string, unknown>>;
  readonly exactKeys: (
    value: Readonly<Record<string, unknown>>,
    allowed: readonly string[],
    path: string,
  ) => void;
  readonly requiredString: (value: unknown, path: string) => string;
  readonly safeId: (value: unknown, path: string) => string;
  readonly exactTimestamp: (value: unknown, path: string) => string;
  readonly shaValue: (value: unknown, path: string) => string;
  readonly readJson: (path: string) => unknown;
  readonly normalizeRelative: (path: string) => string;
  readonly regularFilesRecursively: (root: string) => readonly string[];
  readonly sourcePath: (
    value: string,
    domain: StateBenchDomain,
    path: string,
  ) => string;
  readonly assertVerifiedCheckout: (path: string) => string;
  readonly loadArtifact: (path: string) => StateBenchLearningArtifact;
  readonly inspectTrainCorpus: (root: string) => {
    readonly files: readonly CorpusFile[];
    readonly treeSha256: string;
  };
  readonly verifyTrainArtifactSeal: (
    checkoutPath: string,
    artifactPath: string,
    value: unknown,
  ) => VerificationResult;
}

export function createStateBenchExtractionProvenance(
  dependencies: ExtractionProvenanceDependencies,
) {
  const {
    STATE_BENCH_MANIFEST,
    TRAIN_PREFIX,
    sha256,
    canonical,
    isObject,
    exactKeys,
    requiredString,
    safeId,
    exactTimestamp,
    shaValue,
    readJson,
    normalizeRelative,
    regularFilesRecursively,
    sourcePath,
    assertVerifiedCheckout,
    loadArtifact,
    inspectTrainCorpus,
    verifyTrainArtifactSeal,
  } = dependencies;

function regularFileBytes(path: string, label: string): Buffer {
  const resolved = resolve(path);
  const metadata = lstatSync(resolved);
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error(`${label} must be a regular file, not a symbolic link`);
  }
  return readFileSync(resolved);
}

function parseExtractionPipelineManifest(
  value: unknown,
): StateBenchExtractionPipelineManifest {
  if (!isObject(value)) throw new Error("extraction pipeline manifest must be an object");
  exactKeys(
    value,
    [
      "schemaVersion",
      "manifestId",
      "declaredAt",
      "benchmark",
      "dataAccessPolicy",
      "extractor",
      "procedure",
      "outputSchemaVersion",
      "manifestHash",
    ],
    "extraction pipeline manifest",
  );
  if (value.schemaVersion !== "pm-state-bench-extraction-pipeline.v1") {
    throw new Error("unsupported extraction pipeline manifest schemaVersion");
  }
  if (!isObject(value.benchmark)) throw new Error("pipeline benchmark must be an object");
  exactKeys(
    value.benchmark,
    ["repositoryUrl", "revision", "track", "sourceSplit", "corpusRoot", "corpusSha256"],
    "pipeline benchmark",
  );
  if (
    value.benchmark.repositoryUrl !== STATE_BENCH_MANIFEST.upstreamUrl ||
    value.benchmark.revision !== STATE_BENCH_MANIFEST.upstreamRevision ||
    value.benchmark.track !== "agent_learning" ||
    value.benchmark.sourceSplit !== "train" ||
    value.benchmark.corpusRoot !== STATE_BENCH_MANIFEST.trainCorpusRoot ||
    value.benchmark.corpusSha256 !== STATE_BENCH_MANIFEST.trainCorpusSha256
  ) {
    throw new Error("pipeline benchmark source must be the exact pinned training corpus");
  }
  if (!isObject(value.dataAccessPolicy)) {
    throw new Error("pipeline dataAccessPolicy must be an object");
  }
  exactKeys(
    value.dataAccessPolicy,
    [
      "allowedBenchmarkSourcePrefix",
      "additionalBenchmarkInputs",
      "heldOutPaths",
      "oraclePaths",
    ],
    "pipeline dataAccessPolicy",
  );
  if (
    value.dataAccessPolicy.allowedBenchmarkSourcePrefix !== TRAIN_PREFIX ||
    !Array.isArray(value.dataAccessPolicy.additionalBenchmarkInputs) ||
    value.dataAccessPolicy.additionalBenchmarkInputs.length !== 0 ||
    value.dataAccessPolicy.heldOutPaths !== "forbidden" ||
    value.dataAccessPolicy.oraclePaths !== "forbidden"
  ) {
    throw new Error("pipeline data access must declare train-only input and forbid held-out/oracle paths");
  }
  if (!isObject(value.extractor)) throw new Error("pipeline extractor must be an object");
  exactKeys(
    value.extractor,
    [
      "kind",
      "sourceRevision",
      "sourceSha256",
      "modelId",
      "modelDigest",
      "deterministicExtractorId",
    ],
    "pipeline extractor",
  );
  if (value.extractor.kind !== "model" && value.extractor.kind !== "deterministic") {
    throw new Error("pipeline extractor kind must be model or deterministic");
  }
  const sourceRevision = requiredString(
    value.extractor.sourceRevision,
    "extractor.sourceRevision",
  );
  const sourceSha256 = shaValue(value.extractor.sourceSha256, "extractor.sourceSha256");
  let modelId: string | null;
  let modelDigest: string | null;
  let deterministicExtractorId: string | null;
  if (value.extractor.kind === "model") {
    modelId = safeId(value.extractor.modelId, "extractor.modelId");
    modelDigest = shaValue(value.extractor.modelDigest, "extractor.modelDigest");
    if (value.extractor.deterministicExtractorId !== null) {
      throw new Error("model extractor cannot declare deterministicExtractorId");
    }
    deterministicExtractorId = null;
  } else {
    if (value.extractor.modelId !== null || value.extractor.modelDigest !== null) {
      throw new Error("deterministic extractor cannot declare model identity");
    }
    modelId = null;
    modelDigest = null;
    deterministicExtractorId = safeId(
      value.extractor.deterministicExtractorId,
      "extractor.deterministicExtractorId",
    );
  }
  if (!isObject(value.procedure)) throw new Error("pipeline procedure must be an object");
  exactKeys(
    value.procedure,
    ["promptSha256", "toolsSha256", "decodingSha256"],
    "pipeline procedure",
  );
  const procedure = {
    promptSha256: shaValue(value.procedure.promptSha256, "procedure.promptSha256"),
    toolsSha256: shaValue(value.procedure.toolsSha256, "procedure.toolsSha256"),
    decodingSha256: shaValue(value.procedure.decodingSha256, "procedure.decodingSha256"),
  };
  if (value.outputSchemaVersion !== "pm-state-bench-learnings.v1") {
    throw new Error("pipeline output schema must be pm-state-bench-learnings.v1");
  }
  const body: Omit<StateBenchExtractionPipelineManifest, "manifestHash"> = {
    schemaVersion: "pm-state-bench-extraction-pipeline.v1",
    manifestId: safeId(value.manifestId, "manifestId"),
    declaredAt: exactTimestamp(value.declaredAt, "declaredAt"),
    benchmark: {
      repositoryUrl: STATE_BENCH_MANIFEST.upstreamUrl,
      revision: STATE_BENCH_MANIFEST.upstreamRevision,
      track: "agent_learning",
      sourceSplit: "train",
      corpusRoot: STATE_BENCH_MANIFEST.trainCorpusRoot,
      corpusSha256: STATE_BENCH_MANIFEST.trainCorpusSha256,
    },
    dataAccessPolicy: {
      allowedBenchmarkSourcePrefix: TRAIN_PREFIX,
      additionalBenchmarkInputs: [],
      heldOutPaths: "forbidden",
      oraclePaths: "forbidden",
    },
    extractor: {
      kind: value.extractor.kind,
      sourceRevision,
      sourceSha256,
      modelId,
      modelDigest,
      deterministicExtractorId,
    },
    procedure,
    outputSchemaVersion: "pm-state-bench-learnings.v1",
  };
  const manifestHash = shaValue(value.manifestHash, "manifestHash");
  if (manifestHash !== sha256(canonical(body))) {
    throw new Error("extraction pipeline manifestHash does not recompute");
  }
  return { ...body, manifestHash };
}

function createExtractionPipelineManifest(
  input: StateBenchExtractionPipelineInput,
): StateBenchExtractionPipelineManifest {
  const kind = input.extractorKind;
  if (kind !== "model" && kind !== "deterministic") {
    throw new Error("extractorKind must be model or deterministic");
  }
  let modelId: string | null = null;
  let modelDigest: string | null = null;
  let deterministicExtractorId: string | null = null;
  if (kind === "model") {
    modelId = safeId(input.modelId, "modelId");
    modelDigest = shaValue(input.modelDigest, "modelDigest");
    if (input.deterministicExtractorId !== undefined) {
      throw new Error("model pipeline cannot declare deterministicExtractorId");
    }
  } else {
    if (input.modelId !== undefined || input.modelDigest !== undefined) {
      throw new Error("deterministic pipeline cannot declare a model identity");
    }
    deterministicExtractorId = safeId(
      input.deterministicExtractorId,
      "deterministicExtractorId",
    );
  }
  const body: Omit<StateBenchExtractionPipelineManifest, "manifestHash"> = {
    schemaVersion: "pm-state-bench-extraction-pipeline.v1",
    manifestId: safeId(input.manifestId, "manifestId"),
    declaredAt: exactTimestamp(input.declaredAt, "declaredAt"),
    benchmark: {
      repositoryUrl: STATE_BENCH_MANIFEST.upstreamUrl,
      revision: STATE_BENCH_MANIFEST.upstreamRevision,
      track: "agent_learning",
      sourceSplit: "train",
      corpusRoot: STATE_BENCH_MANIFEST.trainCorpusRoot,
      corpusSha256: STATE_BENCH_MANIFEST.trainCorpusSha256,
    },
    dataAccessPolicy: {
      allowedBenchmarkSourcePrefix: TRAIN_PREFIX,
      additionalBenchmarkInputs: [],
      heldOutPaths: "forbidden",
      oraclePaths: "forbidden",
    },
    extractor: {
      kind,
      sourceRevision: requiredString(
        input.extractorSourceRevision,
        "extractorSourceRevision",
      ),
      sourceSha256: sha256(regularFileBytes(input.extractorSourcePath, "extractor source")),
      modelId,
      modelDigest,
      deterministicExtractorId,
    },
    procedure: {
      promptSha256: sha256(regularFileBytes(input.promptPath, "extraction prompt")),
      toolsSha256: sha256(regularFileBytes(input.toolsPath, "extraction tools")),
      decodingSha256: sha256(regularFileBytes(input.decodingPath, "decoding config")),
    },
    outputSchemaVersion: "pm-state-bench-learnings.v1",
  };
  return { ...body, manifestHash: sha256(canonical(body)) };
}

function verifyExtractionPipelineManifest(
  input: Pick<
    StateBenchExtractionCollectionInput,
    "pipelineManifestPath" | "extractorSourcePath" | "promptPath" | "toolsPath" | "decodingPath"
  >,
  value: unknown,
): VerificationResult {
  try {
    const parsed = parseExtractionPipelineManifest(value);
    const common = {
      manifestId: parsed.manifestId,
      declaredAt: parsed.declaredAt,
      extractorKind: parsed.extractor.kind,
      extractorSourceRevision: parsed.extractor.sourceRevision,
      extractorSourcePath: input.extractorSourcePath,
      promptPath: input.promptPath,
      toolsPath: input.toolsPath,
      decodingPath: input.decodingPath,
    };
    const recomputed =
      parsed.extractor.modelId === null
        ? createExtractionPipelineManifest({
            ...common,
            extractorKind: "deterministic",
            deterministicExtractorId: safeId(
              parsed.extractor.deterministicExtractorId,
              "extractor.deterministicExtractorId",
            ),
          })
        : createExtractionPipelineManifest({
            ...common,
            extractorKind: "model",
            modelId: parsed.extractor.modelId,
            modelDigest: shaValue(parsed.extractor.modelDigest, "extractor.modelDigest"),
          });
    if (canonical(parsed) !== canonical(recomputed)) {
      return {
        valid: false,
        issues: ["extraction pipeline manifest is stale for the supplied procedure bytes"],
      };
    }
    return { valid: true, issues: [] };
  } catch (error) {
    return {
      valid: false,
      issues: [error instanceof Error ? error.message : String(error)],
    };
  }
}

function loadVerifiedExtractionManifest(
  input: Pick<
    StateBenchExtractionCollectionInput,
    "pipelineManifestPath" | "extractorSourcePath" | "promptPath" | "toolsPath" | "decodingPath"
  >,
): StateBenchExtractionPipelineManifest {
  const value = readJson(input.pipelineManifestPath);
  const verification = verifyExtractionPipelineManifest(input, value);
  if (!verification.valid) {
    throw new Error(`extraction pipeline verification failed: ${verification.issues.join("; ")}`);
  }
  return parseExtractionPipelineManifest(value);
}

function rawRecordBody(
  manifest: StateBenchExtractionPipelineManifest,
  entry: StateBenchLearningEntry,
  sequence: number,
  recordedAt: string,
  rawOutput: string,
  citedTrainBytes: StateBenchRawExtractionRecord["citedTrainBytes"],
): Omit<StateBenchRawExtractionRecord, "recordHash"> {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error("raw extraction sequence must be a positive integer");
  }
  const exactRecordedAt = exactTimestamp(recordedAt, "recordedAt");
  if (Date.parse(exactRecordedAt) < Date.parse(manifest.declaredAt)) {
    throw new Error("raw extraction record cannot predate its pipeline declaration");
  }
  return {
    schemaVersion: "pm-state-bench-raw-extraction-record.v1",
    manifestHash: manifest.manifestHash,
    sequence,
    recordedAt: exactRecordedAt,
    learningId: entry.learningId,
    domain: entry.domain,
    rawOutput,
    rawOutputSha256: sha256(rawOutput),
    artifactEntry: entry,
    artifactEntrySha256: sha256(canonical(entry)),
    citedTrainBytes,
  };
}

function createRawExtractionRecord(
  input: StateBenchRawExtractionRecordInput,
): StateBenchRawExtractionRecord {
  const root = assertVerifiedCheckout(input.checkoutPath);
  const artifact = loadArtifact(input.artifactPath);
  const manifest = loadVerifiedExtractionManifest(input);
  const entry = artifact.entries.find((candidate) => candidate.learningId === input.learningId);
  if (entry === undefined) throw new Error(`artifact does not contain learning ${input.learningId}`);
  const inventory = new Map(
    inspectTrainCorpus(root).files.map((file) => [file.path, file] as const),
  );
  const citedTrainBytes = entry.sourceTrajectories.map((path) => {
    const file = inventory.get(path);
    if (file === undefined) throw new Error(`citation is not in the pinned train corpus: ${path}`);
    const bytes = readFileSync(file.absolutePath);
    return {
      path,
      fileSha256: file.fileSha256,
      encoding: "base64" as const,
      bytesBase64: bytes.toString("base64"),
    };
  });
  const rawOutput = regularFileBytes(input.rawOutputPath, "raw extraction output").toString(
    "utf8",
  );
  const body = rawRecordBody(
    manifest,
    entry,
    input.sequence,
    input.recordedAt,
    rawOutput,
    citedTrainBytes,
  );
  return { ...body, recordHash: sha256(canonical(body)) };
}

function parseAndVerifyRawExtractionRecord(
  value: unknown,
  manifest: StateBenchExtractionPipelineManifest,
  entry: StateBenchLearningEntry,
  expectedSequence: number,
  inventory: ReadonlyMap<string, CorpusFile>,
): StateBenchRawExtractionRecord {
  if (!isObject(value)) throw new Error(`raw extraction record ${expectedSequence} must be an object`);
  exactKeys(
    value,
    [
      "schemaVersion",
      "manifestHash",
      "sequence",
      "recordedAt",
      "learningId",
      "domain",
      "rawOutput",
      "rawOutputSha256",
      "artifactEntry",
      "artifactEntrySha256",
      "citedTrainBytes",
      "recordHash",
    ],
    `raw extraction record ${expectedSequence}`,
  );
  if (
    value.schemaVersion !== "pm-state-bench-raw-extraction-record.v1" ||
    value.manifestHash !== manifest.manifestHash ||
    value.sequence !== expectedSequence ||
    value.learningId !== entry.learningId ||
    value.domain !== entry.domain ||
    canonical(value.artifactEntry) !== canonical(entry)
  ) {
    throw new Error(`raw extraction record ${expectedSequence} is not bound to its manifest/artifact entry`);
  }
  if (typeof value.rawOutput !== "string") {
    throw new Error(`raw extraction record ${expectedSequence} rawOutput must be a string`);
  }
  if (!Array.isArray(value.citedTrainBytes)) {
    throw new Error(`raw extraction record ${expectedSequence} citedTrainBytes must be an array`);
  }
  if (value.citedTrainBytes.length !== entry.sourceTrajectories.length) {
    throw new Error(`raw extraction record ${expectedSequence} must reopen every artifact citation`);
  }
  const citedTrainBytes = value.citedTrainBytes.map((rawCitation, citationIndex) => {
    if (!isObject(rawCitation)) throw new Error(`citation ${citationIndex} must be an object`);
    exactKeys(
      rawCitation,
      ["path", "fileSha256", "encoding", "bytesBase64"],
      `record ${expectedSequence} citation ${citationIndex}`,
    );
    const expectedPath = entry.sourceTrajectories[citationIndex];
    const path = sourcePath(
      requiredString(rawCitation.path, `citation ${citationIndex}.path`),
      entry.domain,
      `citation ${citationIndex}.path`,
    );
    if (path !== expectedPath || rawCitation.encoding !== "base64") {
      throw new Error(`record ${expectedSequence} citation ${citationIndex} order/encoding drifted`);
    }
    const file = inventory.get(path);
    if (file === undefined) throw new Error(`record citation is not a pinned train file: ${path}`);
    const bytesBase64 = requiredString(
      rawCitation.bytesBase64,
      `citation ${citationIndex}.bytesBase64`,
    );
    const decoded = Buffer.from(bytesBase64, "base64");
    if (decoded.toString("base64") !== bytesBase64) {
      throw new Error(`record ${expectedSequence} citation ${citationIndex} is not canonical base64`);
    }
    const fileSha256 = shaValue(rawCitation.fileSha256, `citation ${citationIndex}.fileSha256`);
    if (
      fileSha256 !== file.fileSha256 ||
      sha256(decoded) !== file.fileSha256 ||
      !decoded.equals(readFileSync(file.absolutePath))
    ) {
      throw new Error(`record ${expectedSequence} citation ${citationIndex} bytes do not match pinned train data`);
    }
    return { path, fileSha256, encoding: "base64" as const, bytesBase64 };
  });
  const body = rawRecordBody(
    manifest,
    entry,
    expectedSequence,
    exactTimestamp(value.recordedAt, `record ${expectedSequence}.recordedAt`),
    value.rawOutput,
    citedTrainBytes,
  );
  if (
    value.rawOutputSha256 !== body.rawOutputSha256 ||
    value.artifactEntrySha256 !== body.artifactEntrySha256 ||
    value.recordHash !== sha256(canonical(body)) ||
    canonical(value) !== canonical({ ...body, recordHash: sha256(canonical(body)) })
  ) {
    throw new Error(`raw extraction record ${expectedSequence} content hashes do not recompute`);
  }
  return { ...body, recordHash: shaValue(value.recordHash, "recordHash") };
}

function createExtractionProvenanceReceipt(
  input: StateBenchExtractionCollectionInput,
): StateBenchExtractionProvenanceReceipt {
  const root = assertVerifiedCheckout(input.checkoutPath);
  const artifact = loadArtifact(input.artifactPath);
  const artifactSealValue = readJson(input.artifactSealPath);
  const sealVerification = verifyTrainArtifactSeal(root, input.artifactPath, artifactSealValue);
  if (!sealVerification.valid || !isObject(artifactSealValue)) {
    throw new Error(`training artifact seal is invalid: ${sealVerification.issues.join("; ")}`);
  }
  const artifactSealHash = shaValue(artifactSealValue.sealHash, "artifact sealHash");
  const artifactSha256 = shaValue(artifactSealValue.artifactSha256, "artifact sha256");
  const manifest = loadVerifiedExtractionManifest(input);
  const corpus = inspectTrainCorpus(root);
  const inventory = new Map(corpus.files.map((file) => [file.path, file] as const));
  const rawRoot = resolve(input.rawRecordsPath);
  const rawRootMetadata = lstatSync(rawRoot);
  if (rawRootMetadata.isSymbolicLink() || !rawRootMetadata.isDirectory()) {
    throw new Error("rawRecordsPath must be a real directory, not a symbolic link");
  }
  const files = regularFilesRecursively(rawRoot);
  const expectedPaths = artifact.entries.map(
    (entry, index) => `${String(index + 1).padStart(4, "0")}-${entry.learningId}.json`,
  );
  const actualPaths = files.map((path) => normalizeRelative(relative(rawRoot, path))).sort();
  if (canonical(actualPaths) !== canonical([...expectedPaths].sort())) {
    throw new Error("raw record root must contain exactly one canonically named record per artifact entry");
  }
  const entries = artifact.entries.map((entry, index) => {
    const path = expectedPaths[index]!;
    const absolutePath = join(rawRoot, path);
    const record = parseAndVerifyRawExtractionRecord(
      readJson(absolutePath),
      manifest,
      entry,
      index + 1,
      inventory,
    );
    return {
      sequence: index + 1,
      learningId: entry.learningId,
      path,
      fileSha256: sha256(readFileSync(absolutePath)),
      recordHash: record.recordHash,
      rawOutputSha256: record.rawOutputSha256,
      artifactEntrySha256: record.artifactEntrySha256,
      citedTrainPaths: record.citedTrainBytes.map((citation) => citation.path),
    };
  });
  const body: Omit<StateBenchExtractionProvenanceReceipt, "receiptHash"> = {
    schemaVersion: "pm-state-bench-extraction-provenance.v1",
    evidenceClass: "training_extraction_byte_and_procedure_provenance",
    authorityStatus: "evidence_only",
    claimBoundary:
      "byte_and_declared_procedure_provenance_not_semantic_truth_or_runtime_noninterference",
    benchmark: {
      repositoryUrl: STATE_BENCH_MANIFEST.upstreamUrl,
      revision: STATE_BENCH_MANIFEST.upstreamRevision,
      sourceSplit: "train",
      corpusRoot: STATE_BENCH_MANIFEST.trainCorpusRoot,
      corpusFileCount: corpus.files.length,
      corpusSha256: corpus.treeSha256,
    },
    pipeline: {
      manifestId: manifest.manifestId,
      manifestHash: manifest.manifestHash,
      declaredAt: manifest.declaredAt,
      extractorKind: manifest.extractor.kind,
      extractorSourceRevision: manifest.extractor.sourceRevision,
      extractorSourceSha256: manifest.extractor.sourceSha256,
      modelId: manifest.extractor.modelId,
      modelDigest: manifest.extractor.modelDigest,
      deterministicExtractorId: manifest.extractor.deterministicExtractorId,
      promptSha256: manifest.procedure.promptSha256,
      toolsSha256: manifest.procedure.toolsSha256,
      decodingSha256: manifest.procedure.decodingSha256,
    },
    sourcePolicy: {
      declaredBenchmarkInputs: [STATE_BENCH_MANIFEST.trainCorpusRoot],
      allCitationsReopenedFromPinnedTrainBytes: true,
      heldOutOrOraclePathsDeclared: false,
    },
    artifact: {
      artifactSha256,
      artifactSealHash,
      entryCount: artifact.entries.length,
    },
    rawRecords: {
      fileCount: entries.length,
      treeSha256: sha256(
        entries.map((entry) => `${entry.path}\0${entry.fileSha256}\n`).join(""),
      ),
      entries,
    },
  };
  return { ...body, receiptHash: sha256(canonical(body)) };
}

function verifyExtractionProvenanceReceipt(
  input: StateBenchExtractionCollectionInput,
  value: unknown,
): VerificationResult {
  try {
    const recomputed = createExtractionProvenanceReceipt(input);
    if (canonical(value) !== canonical(recomputed)) {
      return {
        valid: false,
        issues: ["extraction provenance receipt is incomplete, stale, or does not recompute"],
      };
    }
    return { valid: true, issues: [] };
  } catch (error) {
    return {
      valid: false,
      issues: [error instanceof Error ? error.message : String(error)],
    };
  }
}

function loadProvenanceBoundArtifact(
  input: StateBenchExtractionCollectionInput,
  receiptPath: string,
): StateBenchLearningArtifact {
  const receiptValue = readJson(receiptPath);
  const verification = verifyExtractionProvenanceReceipt(input, receiptValue);
  if (!verification.valid) {
    throw new Error(`extraction provenance verification failed: ${verification.issues.join("; ")}`);
  }
  return loadArtifact(input.artifactPath);
}


  return Object.freeze({
    createExtractionPipelineManifest,
    parseExtractionPipelineManifest,
    verifyExtractionPipelineManifest,
    createRawExtractionRecord,
    createExtractionProvenanceReceipt,
    verifyExtractionProvenanceReceipt,
    loadProvenanceBoundArtifact,
  });
}
