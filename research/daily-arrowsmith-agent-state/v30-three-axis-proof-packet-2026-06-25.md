# Agent-State Arrowsmith v30: Three-Axis Proof Packet

Date: 2026-06-25
Status: research-to-runtime continuation
Immediate predecessor read: `research/daily-arrowsmith-agent-state/v29-eval-verdict-terminal-outcome-split-2026-06-25.md`

## Loop State Update

Active question set entering this run: RQ12-RQ20, RQ31 from v29.

Answered this run:

| Eliminated question | Peer-reviewed answer | Repo action | Replacement question |
| --- | --- | --- | --- |
| RQ31: How should Axis A and Axis C emit terminal-proof-backed `scenarioResult` pass pairs for all ten failure classes while preserving Axis B's distinct blocked-evaluation semantics until PluggedInSocial or accepted authoritative agency fixtures exist? | Treat the three-axis report as a traceability and oracle artifact, not as a pooled metric. Gotel/Finkelstein and Ramesh/Jarke show that traceability has to follow artifacts forward and backward through their lifecycle; otherwise missing or weak links create false confidence. Torkar/Gorschek/Feldt/Svahnberg/Raja/Kamran show that traceability remains hard in practice and needs explicit artifact classes and link purposes. Li/Offutt show that model-based test oracles should check the relevant state, not merely runtime exceptions or output existence. Therefore each `(axis, failureClass)` pass needs an explicit paired event group, a scenario oracle verdict, and terminal proof refs; the aggregate report should preserve blocked strata as cells rather than normalizing them into missing or passing evidence. | Added `buildThreeAxisProofPacket()` in `@pm/evals`. The packet wraps `analyzeThreeAxisCoverage()` and records status, sources, verified axes, blocked axes, unverified axes, missing cells, blocked cells, unverified cells, and terminal-proof-backed scenario-pass cells. Axis B blocked events now explicitly set `scenarioResult: "blocked"`. ArrowHedge outcome refs can be arm-scoped and carry `operationalTerminalOutcome`, allowing Axis A events to emit terminal metadata for both baseline and substrate arms when proof packets exist. Tests prove the current state remains `blocked` with Axis C verified, Axis A incomplete, and Axis B blocked; a fully populated synthetic matrix is the only verified packet. | RQ32: How should three-axis proof packets validate their `action_outcome_envelope` refs against live or replay packet stores so terminal-proof-backed scenario passes cannot be satisfied by dangling or hash-invalid refs? |

Active question set leaving this run: RQ12-RQ20, RQ32.

## Sources

- Orlena C. Z. Gotel and Anthony C. W. Finkelstein, "An Analysis of the Requirements Traceability Problem," Proceedings of the First International Conference on Requirements Engineering, 1994: https://doi.org/10.1109/ICRE.1994.292398
- Bala Ramesh and Matthias Jarke, "Toward Reference Models for Requirements Traceability," IEEE Transactions on Software Engineering, 2001: https://doi.org/10.1109/32.895989
- Richard Torkar, Tony Gorschek, Robert Feldt, Mikael Svahnberg, Uzair Akbar Raja, and Kashif Kamran, "Requirements Traceability: A Systematic Review and Industry Case Study," International Journal of Software Engineering and Knowledge Engineering, 2012: https://doi.org/10.1142/S021819401250009X
- Nan Li and Jeff Offutt, "Test Oracle Strategies for Model-Based Testing," IEEE Transactions on Software Engineering, 2017: https://doi.org/10.1109/TSE.2016.2597136

## Bridge Hypothesis

The verifier needs a proof packet that is itself a traceability artifact:

1. every covered cell points back to paired EvalEvents;
2. every verified cell points to a scenario pass and terminal proof refs;
3. every blocked cell remains visible with its blocker reason;
4. every aggregate status is derived from the 30 cells, not from a manually selected subset.

This makes Axis A/C proof emission a matter of producing enough linked event/proof artifacts, while Axis B remains blocked until the source system or authoritative fixtures exist.

## Implementation Delta

1. Added `buildThreeAxisProofPacket()` and exported it from `@pm/evals`.
2. Added `ThreeAxisProofPacket` status fields: `verified`, `blocked`, and `unverified`.
3. Added source and cell lists for verified, terminal-proof-backed scenario pass, blocked, missing, and unverified cells.
4. Added arm-scoped ArrowHedge `actionOutcomeEnvelopes` with optional `terminalOutcome`.
5. Added explicit `scenarioResult: "blocked"` to the Axis B blocker event.

## Falsification Criteria

This slice fails if:

1. A packet reports `verified` while any axis has a blocked or unverified cell.
2. A terminal-proof-backed scenario-pass cell is reported without both a scenario pass pair and terminal proof refs.
3. The current Axis A/B/C packet hides the Axis B blocker.
4. Axis A is marked verified from its partial current suite.
5. A fully populated synthetic matrix does not produce a verified packet.

## Verification

- `pnpm vitest run packages/evals/src/arrowhedge.test.ts packages/evals/src/marketing.test.ts packages/evals/src/three-axis-proof-packet.test.ts packages/evals/src/three-axis-coverage.test.ts packages/evals/src/schema.test.ts packages/evals/src/local-agent-lab.test.ts packages/evals/src/local-lab.test.ts packages/evals/src/metrics.test.ts --reporter=basic`
- `pnpm --filter @pm/evals typecheck`
- `pnpm typecheck`
- `git diff --check`

## Proof Status

| Axis | Current status |
| --- | --- |
| Axis A finance | Improved but incomplete. ArrowHedge EvalEvents can now carry arm-scoped terminal refs, and the proof packet can recognize the terminal-partition cell when both arms cite outcome refs. The full ten-class Axis A matrix is still missing. |
| Axis B marketing | Still blocked. The proof packet preserves the blocked Axis B cell and does not let Axis C verification hide it. |
| Axis C local lab | Verified in packet tests when supplied with ten terminal-proof-backed live-style pairs. Real live Postgres/Ollama packet generation remains the strongest Axis C evidence from v27. |

## Next Action Queue

1. Answer RQ32 by validating proof packet terminal refs against the live `evals.action_outcome_envelope_packets` store or committed replay packets.
2. Expand Axis A finance to one terminal-proof-backed scenario pass pair for every failure class.
3. Keep Axis B blocked until PluggedInSocial is restored or authoritative agency fixtures are accepted.
4. Persist proof packets or a JSON snapshot so an amnesiac verifier can explain the current blocked state without chat context.
