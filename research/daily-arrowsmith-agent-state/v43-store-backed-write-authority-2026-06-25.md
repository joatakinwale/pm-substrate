# v43 - Store Backed Write Authority

Date: 2026-06-25
Status: implementation progress; full three-axis solution remains unverified.

Active question set entering this run: RQ12-RQ20, RQ44.

## Answered Question

| Question | Paper-backed answer | Codebase result | Replacement |
| --- | --- | --- | --- |
| RQ44: How should workflow/capability dispatch bind graph write-authority refs to substrate-stored `ActionOutcomeEnvelope`/provider-status records so capability code cannot forge syntactically valid authority refs? | Proof-carrying authentication says a request should carry checkable proof, but secure provenance and tamper-evident log work show that proof must resolve to an integrity-protected history, not just a self-asserted token. Transparency-log work adds the append-only/authenticated lookup requirement: a caller should be able to prove that the cited record exists and matches the current append-only history. Therefore graph write authority needs a second layer beyond shape validation: strict policies can require a substrate record matching the cited envelope id, action id, accepted terminal outcome, provider certificate id/digest, and provider status event ref. Capability code may return a resolution bundle, but the validator treats the substrate record as the proof input that should come from a store adapter. | Added `GraphWriteAuthoritySubstrateRecord` and `GraphWriteAuthorityPolicy.requireSubstrateRecord` to `@pm/graph`. Extended graph mutation inputs and `PostgresGraph` guards to accept and validate substrate records while preserving old transaction-client argument forms. Extended `@pm/capability-kit` graph authority resolution so resolvers can return `{ authorityRef, substrateRecord }`, and apply/emit contexts can receive both. Added graph and capability-kit tests proving missing/mismatched substrate records fail before SQL/apply, while matched records pass. | RQ45: How should workflow/runtime adapters construct and inject store-backed `GraphWriteAuthorityResolution` objects into real capability handlers across Axis A/B/C without substrate-package edits or hand-forged refs? |

Active question set leaving this run: RQ12-RQ20, RQ45.

## Peer-Reviewed Sources

- Andrew W. Appel and Edward W. Felten, "Proof-Carrying Authentication," ACM CCS 1999. DOI: https://doi.org/10.1145/319709.319718. PDF: https://www.cs.princeton.edu/~appel/papers/says.pdf
- Ragib Hasan, Radu Sion, and Marianne Winslett, "The Case of the Fake Picasso: Preventing History Forgery with Secure Provenance," FAST 2009. https://www.usenix.org/conference/fast09/technical-sessions/presentation/hasan
- Scott A. Crosby and Dan S. Wallach, "Efficient Data Structures for Tamper-Evident Logging," USENIX Security 2009. DOI: https://doi.org/10.5555/1855768.1855788. PDF: https://static.usenix.org/event/sec09/tech/full_papers/crosby.pdf
- Charalampos Papamanthou, Nikos Triandopoulos, and Srinivas Devadas, "Transparency Logs via Append-Only Authenticated Dictionaries," ACM CCS 2019. DOI: https://doi.org/10.1145/3319535.3345652. PDF: https://www.cs.yale.edu/homes/cpap/published/logs-ccs19.pdf

## Bridge Hypothesis

Graph write authority should be admitted in two phases:

```text
syntax ref -> accepted envelope/status-ref shape
substrate record -> store-resolved envelope/status proof
strict write policy -> require both before graph mutation
```

This does not make the store itself magic. The caller still must source `GraphWriteAuthoritySubstrateRecord` from an admitted packet/status store, and future work must wire real workflow/runtime adapters to do that automatically.

## Falsification Criteria

The v43 slice fails if:

1. strict graph policy can accept a valid-looking ref without a substrate record;
2. a substrate record with a different envelope/action/outcome can authorize a write;
3. provider certificate id/digest/status-ref mismatches are hidden by the substrate record;
4. capability-kit can pass strict store-bound policy with a bare ref only;
5. matched records are not available to `apply`/`emit` for downstream provenance;
6. this primitive is claimed as end-to-end proof before workflow/runtime adapters source records from real stores.

## Implementation Delta

- Added `GraphWriteAuthoritySubstrateRecord`.
- Added `GraphWriteAuthorityPolicy.requireSubstrateRecord`.
- Extended graph authority validation with missing/mismatch issue codes for substrate records.
- Extended graph create/update/createEdge inputs with `writeAuthoritySubstrateRecord`.
- Extended `PostgresGraph` guards to validate substrate records and preserve delete-edge transaction-client compatibility.
- Added `GraphWriteAuthorityResolution` to capability-kit.
- Extended capability-kit `graphWriteAuthority` resolvers to return either a bare ref or `{ authorityRef, substrateRecord }`.
- Passed `writeAuthoritySubstrateRecord` through capability apply/emit contexts.
- Added graph and capability-kit tests for missing, mismatched, and matched substrate records.

## Proof Status

Focused verification passed:

```text
pnpm --filter @pm/graph typecheck
pnpm --filter @pm/capability-kit typecheck
pnpm exec vitest run packages/graph/src/write-authority.test.ts packages/capability-kit/src/write-authority.test.ts
```

Current three-axis state:

| Axis | Status |
| --- | --- |
| Axis A finance | Store-bound authority validation primitive exists, but real Axis A workflow/capability adapters still need to inject store-backed resolutions. |
| Axis B marketing | Still blocked for full verification until PluggedInSocial is restored or accepted authoritative agency fixtures are run. |
| Axis C local lab | Mechanism-level store-bound validation exists; local-lab scenarios do not yet exercise real store adapters. |

No verified solution is claimed.
