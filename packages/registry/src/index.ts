/**
 * @pm/registry — Capability registry.
 *
 * Architecture rule (architecture.md, Layer 3):
 *   Tools register as capability providers. They declare what nodes/edges
 *   they read, what events they emit, what permissions they require.
 *   "Integration" stops existing as a concept.
 */

export type {
  Capability,
  NormalizedCapability,
  Registry,
  TerminalAdmissionProviderBinding,
  TerminalAdmissionProviderBindingVerification,
  TerminalAdmissionProviderCertificateIssuanceInput,
  TerminalAdmissionProviderCertificateIssuanceReport,
  TerminalAdmissionProviderCertificateRejection,
  TerminalAdmissionProviderCertificateFindCurrentInput,
  TerminalAdmissionProviderCertificateLookupInput,
  TerminalAdmissionProviderCertificateRecordAtInput,
  TerminalAdmissionProviderCertificateRecordInput,
  TerminalAdmissionProviderCertificateStatusEvent,
  TerminalAdmissionProviderCertificateStatusEventListInput,
  TerminalAdmissionProviderCertificateStatusEventReplayDecision,
  TerminalAdmissionProviderCertificateStatusEventReplayInput,
  TerminalAdmissionProviderCertificateStatusEventReplayIssue,
  TerminalAdmissionProviderCertificateStatusEventReplayIssueCode,
  TerminalAdmissionProviderCertificateStatusRecord,
  TerminalAdmissionProviderCertificateStatusRecordValidationInput,
  TerminalAdmissionProviderCertificateStatusStore,
  TerminalAdmissionProviderCertificateStatusUpdateInput,
  TerminalAdmissionProviderCertificateValidationDecision,
  TerminalAdmissionProviderCertificateValidationInput,
  TerminalAdmissionProviderCertificateValidationIssue,
  TerminalAdmissionProviderCertificateValidationIssueCode,
  TerminalAdmissionProviderRefVerification,
  TerminalAdmissionProviderVerificationIssue,
  TerminalAdmissionProviderVerificationIssueCode,
  TerminalAdmissionProviderVerificationReport,
} from "./interfaces.js";
export {
  listTerminalAdmissionProviderBindings,
  normalizeCapability,
  issueTerminalAdmissionProviderCertificates,
  replayTerminalAdmissionProviderCertificateStatusAt,
  terminalAdmissionProviderCertificateDigest,
  terminalAdmissionProviderCertificateStatusEventHash,
  terminalAdmissionProviderManifestDigest,
  verifyTerminalAdmissionProviderCertificate,
  verifyTerminalAdmissionProviderCertificateIntegrity,
  verifyTerminalAdmissionProviderCertificateStatusRecord,
  verifyTerminalAdmissionProviderBindings,
  verifyTerminalAdmissionProviderRef,
} from "./interfaces.js";
export {
  PostgresRegistry,
  PostgresTerminalAdmissionProviderCertificateStore,
} from "./postgres.js";
export { matchesPattern } from "./pattern.js";
