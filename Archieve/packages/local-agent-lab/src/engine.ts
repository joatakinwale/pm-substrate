/**
 * Engine — runs a ScenarioSpec across both arms against fresh hermetic worlds
 * and produces a paired result with metrics derived from the admitted log +
 * token ledgers. The verdict comes from each repository-authored spec's oracle;
 * therefore these runs validate mechanism/conformance and cannot establish
 * efficacy on an independent benchmark.
 *
 * One run = one scenario × {no_substrate, substrate}. A suite runs many specs.
 */

import { createHash, randomUUID } from "node:crypto";
import {
  buildActionOutcomeEnvelope,
  buildActionOutcomeProviderAuthority,
  stateRef,
  type ActionOutcomeEnvelope,
  type ActionOutcomeProviderAuthority,
  type ActionTerminalOutcome,
} from "@pm/agent-state-core";
import type { Timestamp } from "@pm/types";
import { World } from "./world.js";
import { LabAgent } from "./agent.js";
import { defaultLabProvider, type LabModelClient } from "./provider.js";
import type {
  AdmitOutcome,
  Arm,
  EvalResult,
  IntendedAction,
  Observation,
  ExpectedAdmission,
  ScenarioSpec,
} from "./scenario.js";

export interface ArmRun {
  readonly arm: Arm;
  readonly result: EvalResult;
  readonly actedValue: unknown;
  readonly admitted: boolean;
  readonly refusedReason?: string;
  readonly tokens: number;
  readonly admittedTransitions: number;
  readonly chainValid: boolean;
  readonly actionOutcomeEnvelope?: ActionOutcomeEnvelope;
}

export interface ScenarioRun {
  /** Shared identity for every scenario attempt in one suite invocation. */
  readonly suiteRunId: string;
  /** Exact identity shared by the baseline/substrate arms of this attempt. */
  readonly attemptId: string;
  readonly scenarioId: string;
  readonly failureClass: string;
  readonly expectedAdmission: ExpectedAdmission;
  readonly controlGroup: string;
  readonly realityQualities: readonly number[];
  readonly model: string;
  readonly arms: Readonly<Record<Arm, ArmRun>>;
  readonly actionOutcomeEnvelopes: readonly ActionOutcomeEnvelope[];
  /** True iff the two arms genuinely diverged in behavior (the falsifiable bit). */
  readonly behaviorDiverged: boolean;
}

export interface EngineConfig {
  readonly databaseUrl: string;
  readonly ollama?: LabModelClient;
  readonly retainWorlds?: boolean;
  readonly actionOutcomeAuthorityProvider?: LocalAgentLabActionOutcomeAuthorityProvider;
  readonly suiteRunIdFactory?: () => string;
  readonly attemptIdFactory?: (spec: Pick<ScenarioSpec, "scenarioId">) => string;
}

export interface LocalAgentLabActionOutcomeAuthorityInput {
  readonly spec: Pick<ScenarioSpec, "scenarioId" | "failureClass">;
  readonly arm: Arm;
  readonly tenantId: string;
  readonly terminalOutcome: ActionTerminalOutcome;
  readonly checkedAt: Timestamp;
}

export type LocalAgentLabActionOutcomeAuthorityProvider = (
  input: LocalAgentLabActionOutcomeAuthorityInput,
) => ActionOutcomeProviderAuthority | undefined;

const LOCAL_AGENT_LAB_TERMINAL_PROVIDER_CERTIFICATE_ID =
  "tapc_local_agent_lab_terminal_provider_v1";
const LOCAL_AGENT_LAB_TERMINAL_PROVIDER_CERTIFICATE_DIGEST =
  "sha256:local_agent_lab_terminal_provider_v1";
const LOCAL_AGENT_LAB_TERMINAL_PROVIDER_STATUS_EVENT_ID =
  "evt_local_agent_lab_terminal_provider_status_v1";
const LOCAL_AGENT_LAB_TERMINAL_PROVIDER_STATUS_EVENT_HASH =
  "sha256:local_agent_lab_terminal_provider_status_v1";
const LOCAL_AGENT_LAB_TERMINAL_PROVIDER_STATUS_UPDATED_AT =
  "2026-06-25T00:00:00.000Z" as Timestamp;

export const defaultLocalAgentLabActionOutcomeAuthorityProvider:
  LocalAgentLabActionOutcomeAuthorityProvider = (input) => {
    if (input.terminalOutcome !== "accepted") return undefined;
    return buildActionOutcomeProviderAuthority({
      certificateId: LOCAL_AGENT_LAB_TERMINAL_PROVIDER_CERTIFICATE_ID,
      certificateDigest: LOCAL_AGENT_LAB_TERMINAL_PROVIDER_CERTIFICATE_DIGEST,
      statusEventHash: LOCAL_AGENT_LAB_TERMINAL_PROVIDER_STATUS_EVENT_HASH,
      statusUpdatedAt: LOCAL_AGENT_LAB_TERMINAL_PROVIDER_STATUS_UPDATED_AT,
      checkedAt: input.checkedAt,
    });
  };

async function runArm(
  spec: ScenarioSpec,
  arm: Arm,
  cfg: EngineConfig,
  identity: { readonly suiteRunId: string; readonly attemptId: string },
): Promise<ArmRun> {
  const world = await World.create(cfg.databaseUrl);
  const agent = new LabAgent(cfg.ollama ?? defaultLabProvider());
  const ctx = { world, agent, arm };
  try {
    await spec.seed(ctx);
    const observation = await spec.observe(ctx);
    await spec.induce(ctx);
    const action = await spec.act(ctx, observation);
    const outcome = await spec.admit(ctx, action);
    const result = await spec.oracle(ctx, action, outcome);
    const actionOutcomeEnvelope = buildLocalAgentLabActionOutcomeEnvelope({
      spec,
      arm,
      tenantId: world.tenantId,
      decidedAt: new Date().toISOString() as Timestamp,
      observation,
      action,
      outcome,
      result,
      suiteRunId: identity.suiteRunId,
      attemptId: identity.attemptId,
      ...(cfg.actionOutcomeAuthorityProvider !== undefined
        ? { authorityProvider: cfg.actionOutcomeAuthorityProvider }
        : {}),
    });

    // admitted transitions for this run = full tenant log length.
    const chain = await world.verifyChain();
    return {
      arm,
      result,
      actedValue: action.actedValue,
      admitted: outcome.admitted,
      ...(outcome.refusedReason !== undefined
        ? { refusedReason: outcome.refusedReason }
        : {}),
      tokens: agent.ledger.totalTokens,
      admittedTransitions: chain.checked ?? 0,
      chainValid: chain.valid === true,
      actionOutcomeEnvelope,
    };
  } finally {
    if (cfg.retainWorlds === true) {
      await world.close();
    } else {
      await world.destroy();
    }
  }
}

export async function runScenario(
  spec: ScenarioSpec,
  cfg: EngineConfig,
): Promise<ScenarioRun> {
  const identity = {
    suiteRunId: cfg.suiteRunIdFactory?.() ?? `suite_${randomUUID()}`,
    attemptId:
      cfg.attemptIdFactory?.(spec) ??
      `attempt_${spec.scenarioId}_${randomUUID()}`,
  };
  return runScenarioWithIdentity(spec, cfg, identity);
}

async function runScenarioWithIdentity(
  spec: ScenarioSpec,
  cfg: EngineConfig,
  identity: { readonly suiteRunId: string; readonly attemptId: string },
): Promise<ScenarioRun> {
  const ollama = cfg.ollama ?? defaultLabProvider();
  const a = await runArm(spec, "no_substrate", { ...cfg, ollama }, identity);
  const b = await runArm(spec, "substrate", { ...cfg, ollama }, identity);
  return {
    suiteRunId: identity.suiteRunId,
    attemptId: identity.attemptId,
    scenarioId: spec.scenarioId,
    failureClass: spec.failureClass,
    expectedAdmission: spec.expectedAdmission ?? "block",
    controlGroup: spec.controlGroup ?? spec.failureClass,
    realityQualities: spec.realityQualities,
    model: ollama.model,
    arms: { no_substrate: a, substrate: b },
    actionOutcomeEnvelopes: [
      a.actionOutcomeEnvelope,
      b.actionOutcomeEnvelope,
    ].filter((envelope): envelope is ActionOutcomeEnvelope => envelope !== undefined),
    behaviorDiverged: a.result !== b.result,
  };
}

export interface SuiteResult {
  readonly suiteRunId: string;
  readonly runs: readonly ScenarioRun[];
  readonly model: string;
  readonly actionOutcomeEnvelopes: readonly ActionOutcomeEnvelope[];
  /** Across runs: how many had Arm A fail while Arm B did not fail. */
  readonly substrateProtectedCount: number;
  /** Honest negatives: Arm A did not fail (substrate not needed this run). */
  readonly noFailureCount: number;
  readonly tokensPerAdmittedTransition: Readonly<Record<Arm, number>>;
}

export async function runSuite(
  specs: readonly ScenarioSpec[],
  cfg: EngineConfig,
): Promise<SuiteResult> {
  const suiteRunId = cfg.suiteRunIdFactory?.() ?? `suite_${randomUUID()}`;
  const runs: ScenarioRun[] = [];
  for (const spec of specs) {
    const attemptId =
      cfg.attemptIdFactory?.(spec) ??
      `attempt_${spec.scenarioId}_${randomUUID()}`;
    runs.push(
      await runScenarioWithIdentity(spec, cfg, { suiteRunId, attemptId }),
    );
  }
  let substrateProtectedCount = 0;
  let noFailureCount = 0;
  const tok = { no_substrate: { t: 0, n: 0 }, substrate: { t: 0, n: 0 } };
  for (const r of runs) {
    const a = r.arms.no_substrate;
    const b = r.arms.substrate;
    if (a.result === "fail" && b.result !== "fail") substrateProtectedCount += 1;
    if (a.result !== "fail") noFailureCount += 1;
    tok.no_substrate.t += a.tokens;
    tok.no_substrate.n += a.admittedTransitions;
    tok.substrate.t += b.tokens;
    tok.substrate.n += b.admittedTransitions;
  }
  const tpa = (x: { t: number; n: number }) => (x.n > 0 ? x.t / x.n : x.t);
  return {
    suiteRunId,
    runs,
    model: cfg.ollama?.model ?? defaultLabProvider().model,
    actionOutcomeEnvelopes: runs.flatMap((run) => run.actionOutcomeEnvelopes),
    substrateProtectedCount,
    noFailureCount,
    tokensPerAdmittedTransition: {
      no_substrate: tpa(tok.no_substrate),
      substrate: tpa(tok.substrate),
    },
  };
}

export function buildLocalAgentLabActionOutcomeEnvelope(input: {
  readonly spec: Pick<ScenarioSpec, "scenarioId" | "failureClass">;
  readonly arm: Arm;
  readonly tenantId: string;
  readonly decidedAt: Timestamp;
  readonly observation: Observation;
  readonly action: IntendedAction;
  readonly outcome: AdmitOutcome;
  readonly result: EvalResult;
  readonly suiteRunId?: string;
  readonly attemptId?: string;
  readonly authorityProvider?: LocalAgentLabActionOutcomeAuthorityProvider;
}): ActionOutcomeEnvelope {
  const terminalOutcome = input.outcome.admitted ? "accepted" : "blocked";
  const authority = (input.authorityProvider ??
    defaultLocalAgentLabActionOutcomeAuthorityProvider)({
      spec: input.spec,
      arm: input.arm,
      tenantId: input.tenantId,
      terminalOutcome,
      checkedAt: input.decidedAt,
    });
  const identitySuffix = input.attemptId === undefined
    ? ""
    : `_${localAgentLabIdentitySuffix(input.attemptId)}`;
  const envelopeId =
    `outcome_local_agent_lab_${input.spec.scenarioId}_${input.arm}${identitySuffix}`;
  const evidenceRefs = [
    stateRef(
      "document",
      `local-agent-lab:${input.spec.scenarioId}:observation${identitySuffix}`,
    ),
  ];
  const substrateRefs = [
    stateRef(
      "action_outcome_envelope",
      envelopeId,
      "Local agent lab ActionOutcomeEnvelope",
    ),
    stateRef("continuity_checkpoint", `basis:${input.observation.basisPosition}`),
    ...(input.outcome.admittedEventId === undefined
      ? []
      : [stateRef("event", input.outcome.admittedEventId)]),
  ];

  return buildActionOutcomeEnvelope({
    tenantId: input.tenantId as ActionOutcomeEnvelope["tenantId"],
    actionId:
      `local_agent_lab:${input.spec.scenarioId}:${input.arm}${identitySuffix}`,
    subject: stateRef("document", input.spec.scenarioId),
    proposalReviewId:
      `local_agent_lab:${input.spec.scenarioId}:${input.arm}${identitySuffix}:proposal_review`,
    stateReviewArtifactHash: localAgentLabArtifactHash(input),
    evidenceAdmissionReviewIds: [
      `local_agent_lab:${input.spec.scenarioId}:${input.arm}${identitySuffix}:evidence_review`,
    ],
    ...(authority !== undefined
      ? {
          statusCheckRefs: [
            stateRef(
              "event",
              LOCAL_AGENT_LAB_TERMINAL_PROVIDER_STATUS_EVENT_ID,
              "Local agent lab terminal provider status",
            ),
          ],
          providerCertificateId: authority.providerCertificateId,
          providerCertificateDigest: authority.providerCertificateDigest,
          providerCertificateStatusRef: authority.providerCertificateStatusRef,
        }
      : {}),
    requestedTerminalOutcome: terminalOutcome,
    decidedAt: input.decidedAt,
    decidedBy: `local-agent-lab:${input.arm}`,
    evidenceRefs,
    substrateRefs,
    blockingCauses:
      terminalOutcome === "blocked"
        ? [
            {
              source: "policy",
              code: input.outcome.refusedReason ?? input.spec.failureClass,
              message:
                input.outcome.refusedReason ??
                `Local agent lab ${input.arm} run blocked ${input.spec.scenarioId}.`,
              refs: substrateRefs,
            },
          ]
        : [],
  });
}

function localAgentLabArtifactHash(input: {
  readonly spec: Pick<ScenarioSpec, "scenarioId" | "failureClass">;
  readonly arm: Arm;
  readonly observation: Observation;
  readonly action: IntendedAction;
  readonly outcome: AdmitOutcome;
  readonly result: EvalResult;
  readonly suiteRunId?: string;
  readonly attemptId?: string;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        scenarioId: input.spec.scenarioId,
        failureClass: input.spec.failureClass,
        arm: input.arm,
        observation: input.observation,
        action: input.action,
        outcome: input.outcome,
        result: input.result,
        suiteRunId: input.suiteRunId,
        attemptId: input.attemptId,
      }),
    )
    .digest("hex");
}

function localAgentLabIdentitySuffix(attemptId: string): string {
  return createHash("sha256").update(attemptId).digest("hex").slice(0, 16);
}
