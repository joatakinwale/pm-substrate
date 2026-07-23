# Universal Data Adapter Implementation Goal

**Date:** 2026-07-01  
**Status:** Active implementation goal  
**Owner:** Emmanuel / JOATLABS  

## Goal

Build the Universal Data Adapter (UDA) as a deterministic integration layer for
pm-substrate.

External systems should not be rewritten to emit substrate-native data. Instead,
a discovery process studies an external source once, uses the pi harness to
generate deterministic mapping and conversion tools, and then the runtime calls
those approved tools repeatedly without LLM calls.

The runtime must align with the current pm-substrate implementation:

- `@pm/substrate-http` stays profile-agnostic.
- UDA routes mount through `extraRoutes`.
- Graph writes use the existing `createNode`, `updateNode`, and `createEdge`
  contracts.
- Event writes use the existing event publisher contract.
- Graph and event writes must commit transactionally.
- Profile validation remains owned by graph/profile validators.
- No LLM call is allowed in the per-record runtime path.

## Non-Negotiables

1. **LLM once, deterministic forever after.**
   The agent may use an LLM during discovery to understand an unknown source or
   conversion. After that, the pi harness generates deterministic tools that are
   reused for every future record.

2. **The mapper emits an execution plan, not vague payloads.**
   Runtime output must be directly executable against the current graph/event
   APIs. The missing bridge is an `InboundExecutionPlan`.

3. **Every generated runtime artifact is hash-bound and approvable.**
   Mapping specs, conversion tools, generated mapper modules, and tests are
   content-addressed. Runtime rejects unapproved or tampered artifacts.

4. **Coverage must be explicit.**
   The system must not claim "we captured everything" just because required
   fields validate. Every discovered source field must be classified as mapped,
   derived, ignored, rejected, or unknown.

5. **Drift must quarantine, not silently adapt.**
   Source schema drift emits an event, quarantines affected records, triggers
   regeneration, and requires approval before replay.

## Runtime Artifacts

### `SourceRecordEnvelope`

The raw external input plus source metadata.

Fields:

- `sourceId`
- `sourceRecordId`
- `sourceSchemaVersion`
- `sourceSchemaFingerprint`
- `observedAt`
- `receivedAt`
- `raw`
- `redactionProfile`

### `ConversionToolSpec`

A build-time artifact for repeated data type or semantic conversion.

The discovery agent can use an LLM to understand the conversion once. The pi
harness then generates a deterministic conversion tool and test suite.

Examples:

- source string date -> substrate timestamp
- enum label -> canonical substrate enum
- money object -> amount/currency/minor units
- nested source object -> substrate identity fields
- source lifecycle status -> substrate event type

Fields:

- `toolId`
- `version`
- `sourceType`
- `targetType`
- `conversionIntent`
- `inputSchema`
- `outputSchema`
- `examples`
- `edgeCases`
- `generatedToolHash`
- `testHash`
- `approvalRef`

Runtime rules:

- The conversion tool is pure deterministic code.
- It cannot access filesystem, network, environment variables, process state, or
  dynamic imports.
- It cannot call an LLM.
- It receives all nondeterministic values as explicit inputs.
- It fails loudly with field path and reason.

### `MappingSpec`

The human-reviewable mapping declaration.

Fields:

- `mappingId`
- `version`
- `sourceId`
- `sourceSchemaFingerprint`
- `coverage`
- `fieldMappings`
- `kindRules`
- `identityRules`
- `eventRules`
- `edgeRules`
- `conversionToolRefs`
- `ignoredFields`
- `generatedMapperHash`
- `generatedTestHash`
- `approvalRef`

Coverage classifications:

- `mapped`
- `derived`
- `ignored`
- `rejected`
- `unknown`

Any `unknown` field blocks approval.

### `InboundExecutionPlan`

The deterministic mapper output. This is what the executor runs.

Fields:

- `tenantId`
- `sourceId`
- `sourceRecordId`
- `mappingId`
- `mappingVersion`
- `lineage`
- `graphOps`
- `eventOps`
- `projectionRequests`
- `validationEvidence`

`graphOps` must lower to existing graph calls:

- `createNode`
- `updateNode`
- `createEdge`

`eventOps` must lower to existing event publisher input:

- `type`
- `entityId`
- `emittedBy`
- `payloadSchema`
- `payload`
- `authority`
- `occurredAt`
- `causedBy`

## Runtime Route

Add a UDA route in `substrate-http-demo` through `extraRoutes`:

`POST /tenants/:tenantId/inbound/records`

Execution flow:

1. Parse `SourceRecordEnvelope`.
2. Resolve approved `MappingSpec` for `sourceId` and mapping version.
3. Verify mapping hash, mapper hash, conversion tool hashes, and approval state.
4. Run the deterministic mapper in the constrained runtime.
5. Validate the returned `InboundExecutionPlan`.
6. Execute graph ops and event ops in one transaction.
7. Catch up requested projections.
8. Return execution summary, graph write results, event ids, and lineage summary.

The route must not live in substrate core.

## pi Harness Role

The pi harness is the codegen and verification harness.

It should generate:

- deterministic conversion tools from `ConversionToolSpec`
- deterministic mapper modules from `MappingSpec`
- fixtures from source samples
- tests for required fields, edge cases, drift, and coverage

It should run:

- conversion tool tests
- mapper tests
- contract validation dry-runs
- no-runtime-LLM assertions
- forbidden-import/static-sandbox checks

The discovery agent spends tokens to reason about unknown source semantics. The
pi harness turns that reasoning into deterministic code and tests. The runtime
only calls the approved generated tools.

## Build Plan

### M1 - Types and Contracts

Add types for:

- `SourceRecordEnvelope`
- `ConversionToolSpec`
- `MappingSpec`
- `InboundExecutionPlan`
- `InboundExecutionResult`
- UDA approval records
- UDA drift events
- UDA quarantine records

Acceptance:

- Types compile in `@pm/types`.
- No substrate core runtime behavior changes.
- Unit tests cover required fields and exact optional behavior.

### M2 - Deterministic Execution Plan Validator

Build a pure validator for `InboundExecutionPlan`.

Acceptance:

- Missing graph op fields fail.
- Missing event op fields fail.
- Unknown operation kinds fail.
- Missing lineage for mapped fields fails.
- Invalid projection request fails.

### M3 - UDA Executor

Build an executor that runs a validated `InboundExecutionPlan` against current
graph/event APIs.

Acceptance:

- Graph and event writes commit in one transaction.
- Any graph failure rolls back event writes.
- Any event failure rolls back graph writes.
- Execution result returns event ids and graph write summaries.
- Existing profile validators still enforce graph writes.

### M4 - Reference Mapper Without Agent Discovery

Write one hand-authored mapper that emits an `InboundExecutionPlan`.

Use ArrowHedge first only because the repo already has known hand-written glue
for comparison.

Acceptance:

- Reference mapper produces equivalent or stricter graph/event behavior than
  existing ArrowHedge bridge for the same sample.
- No ArrowHedge source-system edits.
- No substrate core edits.

### M5 - Approval and Hash Binding

Add content-addressed approval for mapping specs, conversion tools, mapper
modules, and tests.

Acceptance:

- Approved mapper runs.
- Unapproved mapper is rejected.
- Tampered mapper hash is rejected.
- Tampered conversion tool hash is rejected.
- Revoked approval is rejected.
- Mapping approval is tenant/source scoped.

### M6 - pi-Generated Conversion Tool Path

Use pi harness to generate a deterministic conversion tool from a
`ConversionToolSpec`.

Acceptance:

- LLM may be used only before tool generation.
- Generated conversion tool passes generated tests.
- Runtime calls the conversion tool without LLM calls.
- Repeated conversion uses the same approved tool.
- Failed conversion reports source field path and reason.

### M7 - pi-Generated Mapper Path

Use pi harness to generate a mapper from a hand-written `MappingSpec`.

Acceptance:

- Generated mapper emits a valid `InboundExecutionPlan`.
- Generated mapper uses approved conversion tool references.
- Required-field deletion fails tests.
- Nullability and enum edge cases are tested.
- Static checks prove no forbidden runtime access.

### M8 - Discovery Agent

Only after M1-M7.

Discovery agent flow:

1. Introspect source schema and samples through MCP.
2. Propose `MappingSpec` and `ConversionToolSpec`s.
3. Classify every source field in coverage matrix.
4. Drive pi harness to generate conversion tools, mapper, fixtures, and tests.
5. Return artifacts for human approval.

Acceptance:

- Any `unknown` source field blocks approval.
- Human can review mapping and conversion coverage before runtime use.
- Runtime still uses deterministic generated tools only.

### M9 - Drift and Quarantine

Add drift handling.

On source schema drift:

1. Emit `mapping.drift.detected`.
2. Quarantine affected records.
3. Classify drift as additive or breaking.
4. Trigger regeneration through discovery agent and pi harness.
5. Require approval.
6. Replay quarantined records after approval.

Acceptance:

- Drift never silently mis-maps.
- Quarantined records are durable.
- Approved regenerated mapper can replay quarantined records.
- Old approved mapper can continue only for compatible records.

### M10 - Second Source Falsifier

ArrowHedge alone does not prove universality.

Add one structurally different source after ArrowHedge.

Acceptance:

- Same executor runs both sources.
- Same approval/hash path applies.
- Same conversion-tool pattern applies.
- No substrate core edits are required.

## Falsification Criteria

Do not claim UDA works until all are true:

- Runtime performs zero LLM calls per record.
- A repeated conversion is handled by an approved pi-generated conversion tool.
- Generated mapper output is equivalent or a proven superset of the hand-written
  ArrowHedge bridge on the same input.
- Removing a required source field fails generated tests.
- Unmapped source fields appear in the coverage matrix and block approval unless
  explicitly classified.
- Tampered mapper is rejected.
- Tampered conversion tool is rejected.
- Schema drift quarantines records and emits drift event.
- Graph/event execution is transactional.
- At least two structurally different sources run through the same executor.

## First Implementation Target

Start with M1-M3.

The first concrete shipping slice is:

1. Add UDA types.
2. Add `InboundExecutionPlan` validator.
3. Add executor tests proving graph/event transactionality.

Do not build the discovery agent first. The executor is the foundation.
