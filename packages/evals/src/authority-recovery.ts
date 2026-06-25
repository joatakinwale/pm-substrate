import {
  validateGraphWriteAuthority,
  type GraphWriteAuthorityIssue,
  type GraphWriteAuthorityPolicy,
  type GraphWriteAuthorityRef,
  type GraphWriteAuthoritySubstrateRecord,
} from "@pm/graph";
import type { TenantId } from "@pm/types";

import type { EvalEvent, EvalEvidenceRef } from "./schema.js";

export interface EvalGraphWriteAuthorityEnvelopeLookup {
  readonly tenantId: string;
  readonly envelopeId: string;
}

export interface EvalGraphWriteAuthorityEnvelope {
  readonly envelopeId: string;
  readonly actionId: string;
  readonly terminalOutcome: "accepted" | "blocked" | "rejected" | "held";
}

export interface EvalGraphWriteAuthorityEnvelopeStore {
  getWorkflowActionOutcomeEnvelope(
    lookup: EvalGraphWriteAuthorityEnvelopeLookup,
  ): Promise<EvalGraphWriteAuthorityEnvelope | null | undefined>;
}

export interface EvalGraphWriteAuthorityResolution {
  readonly authorityRef?: GraphWriteAuthorityRef;
  readonly substrateRecord?: GraphWriteAuthoritySubstrateRecord;
}

export interface EvalGraphWriteAuthorityResolveInput {
  readonly tenantId: TenantId;
  readonly event: EvalEvent;
  readonly envelopeId: string;
  readonly expectedActionId?: string;
}

export type EvalGraphWriteAuthorityResolver = (
  input: EvalGraphWriteAuthorityResolveInput,
) => Promise<EvalGraphWriteAuthorityResolution>;

export type EvalGraphWriteAuthorityRecoveryStatus =
  | "accepted_authority_recovered"
  | "terminal_outcome_refused_authority"
  | "missing_action_outcome_ref"
  | "ambiguous_action_outcome_ref"
  | "missing_authority_packet"
  | "unexpected_terminal_authority"
  | "authority_resolution_failed"
  | "authority_policy_rejected";

export interface EvalGraphWriteAuthorityRecovery {
  readonly runId: string;
  readonly scenarioId: string;
  readonly axis: EvalEvent["axis"];
  readonly tenantId: TenantId;
  readonly envelopeId?: string;
  readonly actionId?: string;
  readonly terminalOutcome?: EvalGraphWriteAuthorityEnvelope["terminalOutcome"];
  readonly valid: boolean;
  readonly status: EvalGraphWriteAuthorityRecoveryStatus;
  readonly evidenceRefs: readonly EvalEvidenceRef[];
  readonly substrateRefs: readonly EvalEvidenceRef[];
  readonly issueCodes: readonly string[];
  readonly issues: readonly string[];
}

export interface EvalGraphWriteAuthorityRecoverySummary {
  readonly totalEvents: number;
  readonly auditedEvents: number;
  readonly validRecoveries: number;
  readonly invalidRecoveries: number;
  readonly byStatus: Readonly<Record<EvalGraphWriteAuthorityRecoveryStatus, number>>;
}

export interface EvalGraphWriteAuthorityRecoverySuite {
  readonly recoveries: readonly EvalGraphWriteAuthorityRecovery[];
  readonly summary: EvalGraphWriteAuthorityRecoverySummary;
}

export async function auditEvalEventGraphWriteAuthority(input: {
  readonly event: EvalEvent;
  readonly store: EvalGraphWriteAuthorityEnvelopeStore;
  readonly resolveAcceptedAuthority: EvalGraphWriteAuthorityResolver;
  readonly policy: GraphWriteAuthorityPolicy;
  readonly expectedActionId?: string;
}): Promise<EvalGraphWriteAuthorityRecovery> {
  const actionOutcomeRefs = input.event.substrateRefs.filter(
    (ref) => ref.kind === "action_outcome_envelope",
  );
  const common = {
    runId: input.event.runId,
    scenarioId: input.event.scenarioId,
    axis: input.event.axis,
    tenantId: input.event.tenantId,
    evidenceRefs: input.event.evidenceRefs,
    substrateRefs: input.event.substrateRefs,
  } as const;

  if (actionOutcomeRefs.length === 0) {
    return {
      ...common,
      valid: false,
      status: "missing_action_outcome_ref",
      issueCodes: ["missing_action_outcome_ref"],
      issues: ["EvalEvent has no action_outcome_envelope substrate ref."],
    };
  }
  if (actionOutcomeRefs.length > 1) {
    return {
      ...common,
      valid: false,
      status: "ambiguous_action_outcome_ref",
      issueCodes: ["ambiguous_action_outcome_ref"],
      issues: [
        `EvalEvent has ${actionOutcomeRefs.length} action_outcome_envelope substrate refs.`,
      ],
    };
  }

  const envelopeId = actionOutcomeRefs[0]!.id;
  const envelope = await input.store.getWorkflowActionOutcomeEnvelope({
    tenantId: String(input.event.tenantId),
    envelopeId,
  });
  if (envelope === null || envelope === undefined) {
    return {
      ...common,
      envelopeId,
      valid: false,
      status: "missing_authority_packet",
      issueCodes: ["missing_authority_packet"],
      issues: [`ActionOutcomeEnvelope packet ${envelopeId} was not found.`],
    };
  }

  const expectedActionId = input.expectedActionId ?? envelope.actionId;
  if (envelope.terminalOutcome !== "accepted") {
    return auditRefusedTerminalOutcome({
      ...common,
      envelope,
      resolveAcceptedAuthority: input.resolveAcceptedAuthority,
      expectedActionId,
    });
  }

  let resolution: EvalGraphWriteAuthorityResolution;
  try {
    resolution = await input.resolveAcceptedAuthority({
      tenantId: input.event.tenantId,
      event: input.event,
      envelopeId,
      expectedActionId,
    });
  } catch (err) {
    return {
      ...common,
      envelopeId,
      actionId: envelope.actionId,
      terminalOutcome: envelope.terminalOutcome,
      valid: false,
      status: "authority_resolution_failed",
      issueCodes: ["authority_resolution_failed"],
      issues: [errorMessage(err)],
    };
  }

  const policyIssues = validateGraphWriteAuthority({
    ...(resolution.authorityRef !== undefined
      ? { authorityRef: resolution.authorityRef }
      : {}),
    ...(resolution.substrateRecord !== undefined
      ? { substrateRecord: resolution.substrateRecord }
      : {}),
    policy: input.policy,
  });
  if (policyIssues.length > 0) {
    return {
      ...common,
      envelopeId,
      actionId: envelope.actionId,
      terminalOutcome: envelope.terminalOutcome,
      valid: false,
      status: "authority_policy_rejected",
      issueCodes: policyIssues.map((issue) => issue.code),
      issues: issueMessages(policyIssues),
    };
  }

  return {
    ...common,
    envelopeId,
    actionId: envelope.actionId,
    terminalOutcome: envelope.terminalOutcome,
    valid: true,
    status: "accepted_authority_recovered",
    issueCodes: [],
    issues: [],
  };
}

export async function auditEvalEventsGraphWriteAuthority(input: {
  readonly events: readonly EvalEvent[];
  readonly store: EvalGraphWriteAuthorityEnvelopeStore;
  readonly resolveAcceptedAuthority: EvalGraphWriteAuthorityResolver;
  readonly policy: GraphWriteAuthorityPolicy;
}): Promise<EvalGraphWriteAuthorityRecoverySuite> {
  const auditableEvents = input.events.filter((event) =>
    event.substrateRefs.some((ref) => ref.kind === "action_outcome_envelope"),
  );
  const recoveries = await Promise.all(
    auditableEvents.map((event) =>
      auditEvalEventGraphWriteAuthority({
        event,
        store: input.store,
        resolveAcceptedAuthority: input.resolveAcceptedAuthority,
        policy: input.policy,
      }),
    ),
  );

  return {
    recoveries,
    summary: summarizeRecoveries(input.events.length, recoveries),
  };
}

async function auditRefusedTerminalOutcome(input: {
  readonly runId: string;
  readonly scenarioId: string;
  readonly axis: EvalEvent["axis"];
  readonly tenantId: TenantId;
  readonly evidenceRefs: readonly EvalEvidenceRef[];
  readonly substrateRefs: readonly EvalEvidenceRef[];
  readonly envelope: EvalGraphWriteAuthorityEnvelope;
  readonly resolveAcceptedAuthority: EvalGraphWriteAuthorityResolver;
  readonly expectedActionId: string;
}): Promise<EvalGraphWriteAuthorityRecovery> {
  try {
    await input.resolveAcceptedAuthority({
      tenantId: input.tenantId,
      event: minimalEventForAuthorityAudit(input),
      envelopeId: input.envelope.envelopeId,
      expectedActionId: input.expectedActionId,
    });
  } catch {
    return {
      runId: input.runId,
      scenarioId: input.scenarioId,
      axis: input.axis,
      tenantId: input.tenantId,
      envelopeId: input.envelope.envelopeId,
      actionId: input.envelope.actionId,
      terminalOutcome: input.envelope.terminalOutcome,
      valid: true,
      status: "terminal_outcome_refused_authority",
      evidenceRefs: input.evidenceRefs,
      substrateRefs: input.substrateRefs,
      issueCodes: [],
      issues: [],
    };
  }

  return {
    runId: input.runId,
    scenarioId: input.scenarioId,
    axis: input.axis,
    tenantId: input.tenantId,
    envelopeId: input.envelope.envelopeId,
    actionId: input.envelope.actionId,
    terminalOutcome: input.envelope.terminalOutcome,
    valid: false,
    status: "unexpected_terminal_authority",
    evidenceRefs: input.evidenceRefs,
    substrateRefs: input.substrateRefs,
    issueCodes: ["unexpected_terminal_authority"],
    issues: [
      `Non-accepted terminal outcome ${input.envelope.terminalOutcome} resolved as write authority.`,
    ],
  };
}

function minimalEventForAuthorityAudit(input: {
  readonly runId: string;
  readonly scenarioId: string;
  readonly axis: EvalEvent["axis"];
  readonly tenantId: TenantId;
  readonly evidenceRefs: readonly EvalEvidenceRef[];
  readonly substrateRefs: readonly EvalEvidenceRef[];
}): EvalEvent {
  return {
    tenantId: input.tenantId,
    axis: input.axis,
    runId: input.runId,
    agentId: "authority-recovery-audit",
    scenarioId: input.scenarioId,
    failureClass: "workflow_invalidation",
    observedAt: "2026-06-25T00:00:00.000Z" as EvalEvent["observedAt"],
    source: "authority-recovery-audit",
    evidenceRefs: input.evidenceRefs,
    substrateRefs: input.substrateRefs,
    result: "blocked",
    notes: "authority-recovery synthetic context",
  };
}

const issueMessages = (issues: readonly GraphWriteAuthorityIssue[]): readonly string[] =>
  issues.map((issue) => `${issue.path}: ${issue.message}`);

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

function summarizeRecoveries(
  totalEvents: number,
  recoveries: readonly EvalGraphWriteAuthorityRecovery[],
): EvalGraphWriteAuthorityRecoverySummary {
  const byStatus = Object.fromEntries(
    RECOVERY_STATUSES.map((status) => [status, 0]),
  ) as Record<EvalGraphWriteAuthorityRecoveryStatus, number>;
  let validRecoveries = 0;
  for (const recovery of recoveries) {
    byStatus[recovery.status] += 1;
    if (recovery.valid) validRecoveries += 1;
  }

  return {
    totalEvents,
    auditedEvents: recoveries.length,
    validRecoveries,
    invalidRecoveries: recoveries.length - validRecoveries,
    byStatus,
  };
}

const RECOVERY_STATUSES = [
  "accepted_authority_recovered",
  "terminal_outcome_refused_authority",
  "missing_action_outcome_ref",
  "ambiguous_action_outcome_ref",
  "missing_authority_packet",
  "unexpected_terminal_authority",
  "authority_resolution_failed",
  "authority_policy_rejected",
] as const satisfies readonly EvalGraphWriteAuthorityRecoveryStatus[];
