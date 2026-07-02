# Procedure Admission Kernel

## Name

Procedure Admission Kernel.

## Problem

Agent work often repeats expensive or fragile actions: browser QA, Pi Harness
code generation, external adapter runs, data conversion, validation scripts, and
multi-step tool use. Running the script or harness cannot by itself make the
result operational state. A harness output is still evidence until the
substrate admits it through an authority-scoped, replayable transition.

## Mechanism

`@pm/procedure-admission` introduces three replay objects:

- `ProcedureDefinition`: the versioned, authority-scoped procedure contract.
- `ProcedureRun`: one deterministic or harness-backed execution, with input,
  output, runner evidence, hashes, status, and bound definition hash.
- `ProcedureAdmissionRecord`: the authority-scoped admission decision over a
  run, sequenced into a hash-linked replay history.

Current operational procedure state is the projection of admitted records from
`replayProcedureAdmissionHistory`. Direct procedure outputs, runner logs,
agent memory, or local files are not operational state.

The Postgres-backed store makes the same rule durable: definitions are stored
per tenant/procedure/version, admission records are sequenced by tenant and
authority scope, and `admit` refuses any run whose definition is not already
registered in durable storage with the exact matching definition hash.

`ProcedureAdmissionRuntime` adds the first runtime boundary. It invokes a
registered runner port by `runnerKind`, builds the run envelope from returned
evidence, refuses to append onto invalid replay history, and then delegates
admission to the durable store. Runner output still has no authority until the
store admits the generated record and replay returns the current projection.
`substrate-http` exposes that same boundary through optional procedure routes
when a runtime is injected.

## Admission Rule

A procedure run may become operational only when:

- the procedure definition is durably registered for the tenant, procedure id,
  and version;
- the procedure definition hash verifies;
- the run hash verifies;
- the admission record hash verifies;
- tenant and authority scope agree across definition, run, and admission;
- the run binds the exact procedure id, definition hash, and version;
- admitted runs have `status: "succeeded"`;
- admitted runs include input evidence, runner evidence, and an output hash;
- bound evidence has not expired at admission evaluation time.

Failed, blocked, cancelled, stale, mismatched, or tampered runs remain evidence
only and do not enter the admitted projection.

## Replay Rule

Replay requires:

- contiguous admission sequences starting at `1`;
- each record's `previousAdmissionHash` to match the previous head hash;
- no duplicate procedure run ids;
- valid definition, run, and admission hashes for every record;
- matching tenant and authority scope for the replay request.

The replay projection returns admitted runs, rejected runs, the current head
hash, and issues. Only `admittedRuns` are operational.

Durable admission also requires the incoming record to extend the current
stored head. A stale sequence number or mismatched `previousAdmissionHash` is
refused instead of forking the authority-scoped ledger.

## Authority Boundary

The authority boundary is `authorityScope`. The first implemented validation
binds a Pi Harness-style run to the local-agent-lab PM-governance approval-gate
scope:

`local-agent-lab/pm-governance-approval-gate`

That validation is intentionally not a finance or marketing fixture; it tests
the substrate rule against PM-governance state.

## Failure Modes Prevented

- a Pi Harness output becoming state because a model remembers it;
- a script result becoming state without runner evidence;
- stale runner evidence authorizing a PM-governance transition;
- a failed harness run being treated as a usable result;
- a local file/output hash mismatch being hidden by a valid-looking admission;
- replay accepting gaps, forked heads, or duplicate runs;
- admission against an unstored or substituted procedure definition.
- runtime appending onto an invalid prior admission history.

## Minimal Implementation Slice

- Package: `@pm/procedure-admission`
- Pure runtime: `packages/procedure-admission/src/index.ts`
- Postgres store: `packages/procedure-admission/src/postgres.ts`
- Migration: `db/migrations/0149_procedure_admission.sql`
- HTTP route: `packages/substrate-http/src/routes/procedures.ts`
- Focused tests: `packages/procedure-admission/src/index.test.ts` and
  `packages/procedure-admission/src/postgres.test.ts`
- PM-governance/local-lab validation:
  `packages/local-agent-lab/src/procedure-admission.test.ts`

## Falsification Tests

The current tests falsify the primitive if:

- an admitted Pi Harness run does not replay into operational procedure state;
- a missing output hash is admitted;
- a failed run becomes operational;
- stale input or runner evidence authorizes admission;
- an unstored or substituted procedure definition can authorize admission;
- a runner-port result can become operational without durable admission;
- tampered run hashes or admission hashes are accepted;
- replay tolerates sequence gaps or previous-head mismatches;
- explicitly rejected runs appear in admitted projection.

## Claim Boundary

This slice includes the pure replay kernel, a runner-port runtime, a
Postgres-backed admission store, optional HTTP endpoints, and PM-governance
local-agent-lab validation through a Pi-Harness-style runner port. It does not
yet wire procedure admission into `@pm/workflow` invoke nodes or invoke the
real external Pi process. Those are next integration steps after the runtime
boundary remains stable.
