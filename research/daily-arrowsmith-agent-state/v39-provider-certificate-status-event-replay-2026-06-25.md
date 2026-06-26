# v39 - Provider Certificate Status Event Replay

Date: 2026-06-25
Status: implementation progress; full three-axis solution remains unverified.

Active question set entering this run: RQ12-RQ20, RQ40.

## Answered Question

| Question | Paper-backed answer | Codebase result | Replacement |
| --- | --- | --- | --- |
| RQ40: How should provider certificate status transitions become append-only, replayable status events so amnesiac replay can explain whether a write used the status current at decision time rather than only the latest stored status? | Decision-time replay needs a transaction-time/event-history layer, not only a latest-row projection. Jensen/Lomet show transaction-time state must retain previous states with timestamps consistent with serialization. Snodgrass/Yao/Collberg show audit logs must be inalterable and separately checkable. Crosby/Wallach and Papamanthou et al. show append-only histories need efficient membership/consistency evidence, because current snapshots alone cannot prove that an earlier view was not forked or rewritten. Therefore provider certificate status should be an append-only, sequence/hash-linked transition stream, with the latest certificate-status row treated as a projection. Replay should reconstruct the status at `checkedAt` from the event stream and reject invalid sequence, previous-hash, event-hash, time-regression, or from-status transitions. | Added `TerminalAdmissionProviderCertificateStatusEvent`, replay issue/decision types, `terminalAdmissionProviderCertificateStatusEventHash()`, and `replayTerminalAdmissionProviderCertificateStatusAt()` to `@pm/registry`. Added migration `0022_registry_terminal_provider_certificate_status_events.sql`. Updated `PostgresTerminalAdmissionProviderCertificateStore` so `recordCertificate()` appends an initial event, `setCertificateStatus()` appends a transition event and updates the current projection transactionally, `listCertificateStatusEvents()` exposes the stream, and `getCertificateRecordAt()`/checked `findCurrentCertificate()` reconstruct status from replay instead of trusting latest state. | RQ41: How should workflow `ActionOutcomeEnvelope` evidence/substrate refs bind the exact provider-certificate status event sequence/hash used at dispatch so replay cannot substitute a later or different certificate-status chain? |

Active question set leaving this run: RQ12-RQ20, RQ41.

## Peer-Reviewed Sources

- Christian S. Jensen and David B. Lomet, "Transaction Timestamping in (Temporal) Databases," VLDB 2001. https://www.vldb.org/conf/2001/P441.pdf
- Richard T. Snodgrass, Shilong Stanley Yao, and Christian Collberg, "Tamper Detection in Audit Logs," VLDB 2004. DOI: https://doi.org/10.1016/B978-012088469-8.50046-2
- Scott A. Crosby and Dan S. Wallach, "Efficient Data Structures for Tamper-Evident Logging," USENIX Security 2009. https://www.usenix.org/conference/usenixsecurity09/technical-sessions/presentation/efficient-data-structures-tamper-evident
- Charalampos Papamanthou, Nikos Triandopoulos, and Srini Devadas, "Transparency Logs via Append-Only Authenticated Dictionaries," ACM CCS 2019. DOI: https://doi.org/10.1145/3319535.3345652

## Bridge Hypothesis

The certificate status row is a projection, not authority. Authority is the ordered transition stream:

```text
certificate JSON: immutable digest-checked proof object
status event stream: append-only sequence, fromStatus, toStatus, checked time, previous hash, event hash
current status row: operational projection for fast latest lookup
historical lookup: replay stream at checkedAt -> validate certificate + replayed status record
```

This makes amnesiac replay able to explain whether a dispatch used a certificate that was valid at decision time, even if the certificate is later revoked.

## Falsification Criteria

The v39 slice fails if:

1. a later revocation makes replay of an earlier valid decision impossible;
2. status transitions can be mutated without hash/sequence evidence changing;
3. a non-contiguous or previous-hash-broken stream still supports accepted replay;
4. `findCurrentCertificate({ checkedAt })` trusts the latest projection instead of reconstructing status at `checkedAt`;
5. current-row updates and event appends are not written atomically by the Postgres store.

## Implementation Delta

- Added append-only certificate status event types and replay issue types to `@pm/registry`.
- Added deterministic status-event hashing over tenant, certificate id, sequence, transition, status time, recorded time, reason, supersession target, and previous event hash.
- Added pure replay validation for:
  - tenant/certificate mismatch;
  - non-contiguous sequence;
  - previous-event-hash mismatch;
  - event hash drift;
  - status-time regression;
  - from-status mismatch;
  - missing event at decision time.
- Added `registry.terminal_admission_provider_certificate_status_events` migration.
- Updated Postgres certificate recording and status updates to append status events and update the projection in one transaction when no external transaction is supplied.
- Updated historical certificate lookup to replay status events at `checkedAt`.
- Updated registry tests to prove an old valid decision remains replayable after later revocation, while tampered status events fail replay.

## Proof Status

Focused verification passed:

```text
pnpm --filter @pm/registry typecheck
pnpm --filter @pm/workflow typecheck
pnpm test packages/registry/src/terminal-admission.test.ts packages/registry/src/postgres.test.ts
```

The Postgres integration assertions for status-event persistence and historical lookup remain skipped when `PM_DATABASE_URL` is absent, matching the repo's existing integration-test behavior.

Current three-axis state:

| Axis | Status |
| --- | --- |
| Axis A finance | Improved substrate primitive: decision-time provider-certificate status can now be replayed after later revocation. Ten-class Axis A verification remains incomplete. |
| Axis B marketing | Still blocked for full verification until PluggedInSocial is restored or accepted authoritative agency fixtures are run. |
| Axis C local lab | Mechanism-level replay primitive is pure-tested, but the dynamic Axis C lab has not yet bound provider-certificate status-event refs into live envelopes. |

No verified solution is claimed.
