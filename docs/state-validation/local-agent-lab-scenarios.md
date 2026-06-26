# Local Agent Lab — Axis C scenarios (live, dynamic)

> Status: LIVE harness spec (replaces the scaffolded `packages/evals/src/local-lab.ts`
> hardcoded pass/fail). Grounded in `reality-qualities.md` + Raft mapping.
> Package: `packages/local-agent-lab/`. Model: Ollama `llama3.2:3b`.

## What this is (and what the old one was not)

The old `local-lab.ts` asserted `baseline=fail, substrate=pass` as literals — a
scoreboard with the score pre-filled. It cannot falsify the thesis.

This harness runs a **real local agent** (Ollama) twice per scenario and
measures behavior **at the admission boundary** — never from the model's text,
never hardcoded.

## Core design (engine = stable; scenarios = data)

The engine never gets rebuilt to add a failure class. A scenario is a
`ScenarioSpec` registered in a registry. All 10 taxonomy failure classes now
have registered dynamic scenarios; adding variants remains a spec/fixture
change, not an engine change.

### The agent (both arms identical)

A minimal real loop: **observe → represent(memory) → plan → act**, backed by
`llama3.2:3b`. Same model, same prompt, same temperature in both arms. The ONLY
difference between arms is where state comes from and whether action is admitted:

- **Arm A (no substrate / un-Raft'd follower):** the agent observes once, keeps
  the value in its OWN local memory (a plain JS object / its context), and acts
  from that memory. No freshness check, no authority, no admission gate.
- **Arm B (substrate / Raft discipline):** the agent's read resolves the CURRENT
  authoritative projection from the substrate (latest admitted `seq` for the
  key); its action must pass admission (`publish` of an admitted transition) and
  is REFUSED if built from a superseded read.

### The world = real substrate, fresh tenant per run (hermetic)

"Hermetic" means a unique `tenantId` per run against the real
`pm-substrate-postgres` — NOT a fake in-memory store. Arm B exercises the real
`seq` + hash-chain + admission path (the Raft commit analog). Reproducible
because each run is an isolated tenant; teardown drops it.

### ScenarioSpec (the dynamic contract)

```ts
interface ScenarioSpec {
  scenarioId: string;
  failureClass: FailureClass;          // from the taxonomy (10 classes)
  realityQualities: number[];          // which of the 10 qualities it probes

  // 1. seed the world: returns the initial admitted transition(s)
  seed(world: World): Promise<SeedResult>;        // e.g. publish price v1 (seq=1)

  // 2. let the agent observe + cache (this is the representation)
  observe(world, agent): Promise<Observation>;

  // 3. INDUCE the failure: mutate the world AFTER the agent observed
  induce(world): Promise<void>;                   // e.g. publish price v2 (seq=2)

  // 4. agent plans + emits an intended action from its (now possibly stale) rep
  act(world, agent, observation): Promise<IntendedAction>;

  // 5. ORACLE — measured at admission boundary, against the admitted log.
  //    Returns the real verdict; NOTHING hardcoded.
  oracle(world, intended, admitResult): EvalResult; // pass | fail | blocked
}
```

### The oracle (where honesty lives)

`stale_action` is defined operationally (reality quality #5/#7, Raft index):

> An action is STALE iff it was built from a read whose `seq` is lower than the
> max admitted `seq` for that key at the moment of action.

- **Arm A**: agent acts from cached `seq=1` while world is at `seq=2` →
  `oracle` reads the admitted log, sees the action's basis seq < current seq →
  result = **fail** (a stale action actually occurred). If the model happened to
  re-observe and used seq=2 → **pass** (honest negative — substrate not needed
  here; reported, not hidden).
- **Arm B**: the substrate REFUSES to admit an action built from seq=1 when
  seq=2 exists → no admitted transition is created → result = **blocked**. That
  refusal IS the win (quality #6 No Unadmitted Mutation + #10 No Conflicting
  Terminal Outcomes). If substrate wrongly admits it → **fail** (a real defect,
  exactly the class we found 2026-06-18). The emitted EvalEvent represents this
  as `result: "blocked"`, `scenarioResult: "pass"`, and
  `operationalTerminalOutcome: "blocked"` with an `action_outcome_envelope` ref.

### Metrics (fall out of the run; none hardcoded)

Per arm, computed from the admitted log + run telemetry:
- `stale_action_rate` = stale admitted actions / actionable runs.
- `refusal_rate` (Arm B) = blocked / actionable runs.
- `tokens_per_admitted_transition` = total model tokens / admitted transitions
  (tests Emmanuel's token-cost hypothesis: does substrate state reduce the
  tokens spent reconstructing state?). Emitted both arms.
- `replay_fidelity` = can the admitted log plus terminal packet refs reproduce
  the decision without chat context?

Results are emitted as real `EvalEvent`s with `evidenceStage: "live_run"`
(NOT `"scaffolded_scenario"`), `substrateRefs` pointing at real event ids/seq.
Each arm also now produces a canonical hash-valid `ActionOutcomeEnvelope`
packet. DB-backed eval persistence must write those packets to
`evals.action_outcome_envelope_packets` before recording pass/fail EvalEvents
that cite their `action_outcome_envelope` refs.

The live runner is `pnpm evals:local-agent-lab:live`. It requires
`PM_DATABASE_URL`, uses the real local-agent-lab engine, and sets
`retainWorlds: true` so substrate event refs remain replayable after EvalEvent
persistence. The deterministic scaffold remains `pnpm evals:local-lab`.

## Live Coverage Gate

`buildDynamicLocalAgentLabEvalSuite()` now reports `liveCoverage`. A failure
class is covered only when it has a protective packet-backed live pair:

- both arms emitted `evidenceStage: "live_run"` EvalEvents;
- the pair shares a `pairedRunGroup`;
- baseline scenario verdict is `fail`;
- substrate scenario verdict is not `fail`;
- both events cite generated, resolvable `action_outcome_envelope` packets.

Packet-backed honest negatives, such as `baseline=pass`, are reported but do not
count as covered failure classes. Scaffolded events never count toward this live
coverage gate.

## Registered Scenario Matrix

| Scenario | failureClass | Failure induced | Expected protective behavior |
| --- | --- | --- | --- |
| `partial-observation` | `partial_observation` | Required dependency appears outside the observed local view. | Baseline acts with an incomplete view; substrate blocks the missing-dependency write. |
| `stale-observation` | `stale_observation` | Observed value is superseded before action. | Baseline acts from stale seq; substrate refuses the superseded read. |
| `representation-loss` | `representation_loss` | Mapping evidence becomes required after the cached representation was formed. | Baseline collapses status into an unsupported value; substrate blocks without mapping evidence. |
| `memory-drift` | `memory_drift` | Remembered fact is superseded by source state. | Baseline resumes from stale memory; substrate blocks the stale basis. |
| `source-authority-conflict` | `source_authority_conflict` | Authoritative policy supersedes the initial source decision. | Baseline follows the old source; substrate gates on the current authority. |
| `workflow-invalidation` | `workflow_invalidation` | Workflow step changes after observation. | Baseline executes the invalidated step; substrate blocks the transition. |
| `capability-contract-violation` | `capability_contract_violation` | Capability limit is reduced after observation. | Baseline invokes against the old limit; substrate blocks the contract violation. |
| `parallel-write-conflict` | `parallel_write_conflict` | A parallel writer advances the entity version. | Baseline writes from the superseded snapshot; substrate enforces one terminal outcome. |
| `feedback-disconnection` | `feedback_disconnection` | Feedback revision appears without being linked to the proposed action. | Baseline reuses the stale answer; substrate blocks the unlinked feedback path. |
| `continuity-break` | `continuity_break` | Resume marker advances after the agent observed. | Baseline resumes from the old marker; substrate recovers/refuses from current refs. |

## Go/No-Go for this harness

This harness is go only when the two arms genuinely differ in behavior, the
oracle reads the admitted log, Arm A can actually fail, and Arm B can still
wrongly admit if the gate regresses. The v27 run satisfies that condition across
all 10 Axis C failure classes, but this is not full three-axis verification:
Axis A still needs the same coverage gate and Axis B remains blocked until
PluggedInSocial is restored/cloned or authoritative agency fixtures are
accepted.
