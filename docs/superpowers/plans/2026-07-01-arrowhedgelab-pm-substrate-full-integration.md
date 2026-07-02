# ArrowHedgeLab pm-substrate Full Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full ArrowHedgeLab/pm-substrate integration that can run ArrowHedgeLab with substrate off, in shadow mode, or in blocking mode while preserving complete agent/config/data provenance for hypothesis testing.

**Architecture:** Add a canonical ArrowHedge run envelope in Python, emit it from CLI/web/backtest paths, extend the TypeScript ArrowHedge capability to preserve plural analyst signals and deterministic action constraints, then run paired mode experiments from the same saved run inputs. pm-substrate remains profile-agnostic; ArrowHedge-specific logic stays in `arrowhedgelab/src/substrate`, `packages/capability-finance-research-ingest`, `packages/profile-finance-research`, and `packages/substrate-http-demo`.

**Tech Stack:** Python 3.11, FastAPI, Pydantic, LangGraph, TypeScript, Vitest, Hono, PostgreSQL-backed pm-substrate event/graph/projection packages.

---

## File Structure

- Create `arrowhedgelab/src/substrate/envelope.py`
  - Canonical Python envelope types and builders for run-level state.
- Modify `arrowhedgelab/src/substrate/emitter.py`
  - Emit full envelopes and preserve legacy single-tick emission during migration.
- Modify `arrowhedgelab/src/substrate/run_with_substrate.py`
  - Build envelopes from CLI runs and support `off`, `shadow`, `blocking`.
- Modify `arrowhedgelab/src/substrate/live_ab.py`
  - Stop relying on synthetic stale labels as the only proof path; consume saved run envelopes.
- Modify `arrowhedgelab/src/main.py`
  - Add optional substrate mode/config to CLI entry path without changing default behavior.
- Modify `arrowhedgelab/app/backend/models/schemas.py`
  - Add substrate config fields to web/backtest request schemas.
- Modify `arrowhedgelab/app/backend/routes/hedge_fund.py`
  - Emit/review substrate envelopes in streaming run and backtest endpoints.
- Modify `arrowhedgelab/app/backend/services/backtest_service.py`
  - Gate paper trades in blocking mode before `execute_trade`.
- Modify `packages/capability-finance-research-ingest/src/arrowhedge.ts`
  - Parse plural analyst signals, allowed actions, and invalid-action blocks.
- Modify `packages/capability-finance-research-ingest/src/capability.ts`
  - Declare any new typed event emitted by invalid-action blocking.
- Modify `packages/profile-finance-research/src/lifecycles.ts`
  - Add lifecycle transition for invalid-action blocking if a new event type is added.
- Create `packages/capability-finance-research-ingest/src/payload-schemas/workflow-blocked-invalid-action.v1.json`
  - Typed payload schema for deterministic action-gate failures.
- Modify `packages/substrate-http-demo/src/arrowhedge-route.ts`
  - Accept envelope ingestion route or a backwards-compatible snapshot route that expands envelopes.
- Create/modify tests:
  - `arrowhedgelab/tests/test_substrate_envelope.py`
  - `arrowhedgelab/tests/test_substrate_emitter.py`
  - `packages/capability-finance-research-ingest/src/arrowhedge.test.ts`
  - `packages/substrate-http-demo/src/arrowhedge-route.test.ts`

---

### Task 1: Add Canonical Python Run Envelope

**Files:**
- Create: `arrowhedgelab/src/substrate/envelope.py`
- Create: `arrowhedgelab/tests/test_substrate_envelope.py`

- [x] **Step 1: Write the failing envelope test**

Add `arrowhedgelab/tests/test_substrate_envelope.py`:

```python
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.substrate.envelope import build_run_envelope


def test_build_run_envelope_preserves_all_agent_signals_and_config():
    observed = datetime(2026, 6, 3, 14, 0, 0, tzinfo=timezone.utc)
    envelope = build_run_envelope(
        run_id="run_cli_001",
        surface="cli",
        substrate_mode="shadow",
        tickers=["AAPL"],
        start_date="2026-05-01",
        end_date="2026-06-03",
        graph_nodes=[{"id": "ben_graham_agent", "type": "agent"}],
        graph_edges=[{"source": "ben_graham_agent", "target": "risk_management_agent"}],
        model_config={"global": {"model_name": "gpt-4.1", "model_provider": "OpenAI"}},
        portfolio={"cash": 100000.0, "positions": {"AAPL": {"long": 0, "short": 0}}},
        analyst_signals={
            "ben_graham_agent": {"AAPL": {"signal": "bullish", "confidence": 0.71}},
            "technical_analyst_agent": {"AAPL": {"signal": "bearish", "confidence": 0.62}},
            "risk_management_agent": {
                "AAPL": {
                    "current_price": 189.25,
                    "remaining_position_limit": 50000.0,
                    "max_shares": 120,
                    "volatility_metrics": {"annualized_volatility": 0.21},
                }
            },
        },
        decisions={"AAPL": {"action": "buy", "quantity": 120, "confidence": 76}},
        observed_at=observed,
    )

    assert envelope["schemaVersion"] == "arrowhedge.run-envelope.v1"
    assert envelope["surface"] == "cli"
    assert envelope["substrateMode"] == "shadow"
    assert envelope["graph"]["nodes"][0]["id"] == "ben_graham_agent"
    assert len(envelope["signals"]) == 2
    assert {signal["agentId"] for signal in envelope["signals"]} == {
        "ben_graham_agent",
        "technical_analyst_agent",
    }
    assert envelope["riskStates"][0]["volatility"] == 0.21
    assert envelope["decisions"][0]["allowedActions"]["buy"] == 120


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failed = 0
    for fn in fns:
        try:
            fn()
            print(f"PASS {fn.__name__}")
        except AssertionError as e:
            failed += 1
            print(f"FAIL {fn.__name__}: {e}")
    print(f"\n{len(fns) - failed}/{len(fns)} passed")
    sys.exit(1 if failed else 0)
```

- [x] **Step 2: Run the test to verify it fails**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 arrowhedgelab/tests/test_substrate_envelope.py
```

Expected: FAIL with `ModuleNotFoundError: No module named 'src.substrate.envelope'`.

- [x] **Step 3: Implement the envelope builder**

Create `arrowhedgelab/src/substrate/envelope.py` with:

```python
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

SubstrateMode = Literal["off", "shadow", "blocking"]
RunSurface = Literal["cli", "web", "backtest"]


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def _confidence(value: Any) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return 0.0
    if parsed > 1:
        parsed = parsed / 100.0
    return max(0.0, min(1.0, parsed))


def _risk_for_ticker(analyst_signals: dict[str, Any], ticker: str) -> dict[str, Any]:
    for agent_id, by_ticker in analyst_signals.items():
        if not agent_id.startswith("risk_management_agent"):
            continue
        if not isinstance(by_ticker, dict) or ticker not in by_ticker:
            continue
        raw = by_ticker[ticker] or {}
        current_price = float(raw.get("current_price", 0.0) or 0.0)
        remaining_limit = float(raw.get("remaining_position_limit", 0.0) or 0.0)
        max_shares = int(raw.get("max_shares", 0) or 0)
        if max_shares <= 0 and current_price > 0:
            max_shares = int(remaining_limit // current_price)
        volatility_metrics = raw.get("volatility_metrics") or {}
        volatility = raw.get("volatility")
        if volatility is None:
            volatility = volatility_metrics.get("annualized_volatility", 0.0)
        return {
            "agentId": agent_id,
            "currentPrice": current_price,
            "remainingPositionLimit": remaining_limit,
            "maxShares": max_shares,
            "volatility": float(volatility or 0.0),
            "bindingConstraint": raw.get("binding_constraint", "position_limit"),
        }
    return {
        "agentId": "risk_management_agent",
        "currentPrice": 0.0,
        "remainingPositionLimit": 0.0,
        "maxShares": 0,
        "volatility": 0.0,
        "bindingConstraint": "missing_risk_state",
    }


def _signals_for_ticker(analyst_signals: dict[str, Any], ticker: str) -> list[dict[str, Any]]:
    signals: list[dict[str, Any]] = []
    for agent_id, by_ticker in analyst_signals.items():
        if agent_id.startswith("risk_management_agent"):
            continue
        if not isinstance(by_ticker, dict):
            continue
        payload = by_ticker.get(ticker)
        if not isinstance(payload, dict):
            continue
        signals.append(
            {
                "id": f"sig_{agent_id}_{ticker}",
                "ticker": ticker,
                "agentId": agent_id,
                "signal": str(payload.get("signal", payload.get("sig", "neutral"))).lower(),
                "confidence": _confidence(payload.get("confidence", payload.get("conf", 0.0))),
                "raw": payload,
            }
        )
    return signals


def _compute_allowed_actions(
    tickers: list[str],
    current_prices: dict[str, float],
    max_shares: dict[str, int],
    portfolio: dict[str, Any],
) -> dict[str, dict[str, int]]:
    allowed: dict[str, dict[str, int]] = {}
    cash = float(portfolio.get("cash", 0.0) or 0.0)
    positions = portfolio.get("positions", {}) or {}
    margin_requirement = float(portfolio.get("margin_requirement", 0.5) or 0.5)
    margin_used = float(portfolio.get("margin_used", 0.0) or 0.0)
    equity = float(portfolio.get("equity", cash) or cash)

    for ticker in tickers:
        price = float(current_prices.get(ticker, 0.0) or 0.0)
        position = positions.get(
            ticker,
            {"long": 0, "long_cost_basis": 0.0, "short": 0, "short_cost_basis": 0.0},
        )
        long_shares = int(position.get("long", 0) or 0)
        short_shares = int(position.get("short", 0) or 0)
        max_qty = int(max_shares.get(ticker, 0) or 0)

        actions = {"hold": 0}
        if long_shares > 0:
            actions["sell"] = long_shares
        if cash > 0 and price > 0:
            max_buy_cash = int(cash // price)
            max_buy = max(0, min(max_qty, max_buy_cash))
            if max_buy > 0:
                actions["buy"] = max_buy
        if short_shares > 0:
            actions["cover"] = short_shares
        if price > 0 and max_qty > 0:
            if margin_requirement <= 0.0:
                max_short = max_qty
            else:
                available_margin = max(0.0, (equity / margin_requirement) - margin_used)
                max_short_margin = int(available_margin // price)
                max_short = max(0, min(max_qty, max_short_margin))
            if max_short > 0:
                actions["short"] = max_short

        allowed[ticker] = actions

    return allowed


def build_run_envelope(
    *,
    run_id: str,
    surface: RunSurface,
    substrate_mode: SubstrateMode,
    tickers: list[str],
    start_date: str,
    end_date: str,
    graph_nodes: list[dict[str, Any]],
    graph_edges: list[dict[str, Any]],
    model_config: dict[str, Any],
    portfolio: dict[str, Any],
    analyst_signals: dict[str, Any],
    decisions: dict[str, Any],
    observed_at: datetime,
    evidence: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    current_prices: dict[str, float] = {}
    max_shares: dict[str, int] = {}
    risk_states: list[dict[str, Any]] = []
    signals: list[dict[str, Any]] = []

    for ticker in tickers:
        risk = _risk_for_ticker(analyst_signals, ticker)
        current_prices[ticker] = float(risk["currentPrice"])
        max_shares[ticker] = int(risk["maxShares"])
        risk_states.append({"ticker": ticker, **risk})
        signals.extend(_signals_for_ticker(analyst_signals, ticker))

    allowed_by_ticker = _compute_allowed_actions(tickers, current_prices, max_shares, portfolio)
    decision_records = []
    for ticker in tickers:
        raw_decision = decisions.get(ticker) or {"action": "hold", "quantity": 0, "confidence": 0}
        decision_records.append(
            {
                "id": f"dec_{run_id}_{ticker}",
                "ticker": ticker,
                "action": str(raw_decision.get("action", "hold")).lower(),
                "quantity": int(raw_decision.get("quantity", 0) or 0),
                "confidence": _confidence(raw_decision.get("confidence")),
                "reasoning": str(raw_decision.get("reasoning", "")),
                "allowedActions": allowed_by_ticker.get(ticker, {"hold": 0}),
            }
        )

    return {
        "schemaVersion": "arrowhedge.run-envelope.v1",
        "runId": run_id,
        "surface": surface,
        "substrateMode": substrate_mode,
        "observedAt": _iso(observed_at),
        "scope": {"startDate": start_date, "endDate": end_date, "tickers": tickers},
        "graph": {"nodes": graph_nodes, "edges": graph_edges},
        "modelConfig": model_config,
        "portfolio": portfolio,
        "signals": signals,
        "riskStates": risk_states,
        "decisions": decision_records,
        "evidence": evidence or [],
    }
```

- [x] **Step 4: Run the test to verify it passes**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 arrowhedgelab/tests/test_substrate_envelope.py
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add arrowhedgelab/src/substrate/envelope.py arrowhedgelab/tests/test_substrate_envelope.py
git commit -m "feat: add ArrowHedge substrate run envelope"
```

---

### Task 2: Extend Python Emitter To Preserve Plural Signals And Real Evidence

**Files:**
- Modify: `arrowhedgelab/src/substrate/emitter.py`
- Modify: `arrowhedgelab/tests/test_substrate_emitter.py`

- [x] **Step 1: Add failing emitter tests**

Append to `arrowhedgelab/tests/test_substrate_emitter.py`:

```python
def test_snapshot_preserves_plural_signals_when_provided():
    tick = _base_tick()
    tick.signal = {
        "agent_id": "analyst_ensemble",
        "signal": "buy",
        "confidence": 0.82,
        "signals": [
            {
                "id": "sig_a",
                "agentId": "ben_graham_agent",
                "signal": "bullish",
                "confidence": 0.71,
            },
            {
                "id": "sig_b",
                "agentId": "technical_analyst_agent",
                "signal": "bearish",
                "confidence": 0.62,
            },
        ],
    }

    snap = tick_to_snapshot(tick)

    assert len(snap["signals"]) == 2
    assert snap["signals"][0]["agentId"] == "ben_graham_agent"
    assert snap["signal"]["agentId"] == "ben_graham_agent"


def test_snapshot_carries_allowed_actions_for_decision_gate():
    tick = _base_tick()
    tick.decision["allowedActions"] = {"hold": 0, "buy": 120}

    snap = tick_to_snapshot(tick)

    assert snap["decision"]["allowedActions"] == {"hold": 0, "buy": 120}
```

- [x] **Step 2: Run tests to verify failure**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 arrowhedgelab/tests/test_substrate_emitter.py
```

Expected: FAIL because `signals` and `decision.allowedActions` are not emitted.

- [x] **Step 3: Implement plural fields without breaking legacy snapshots**

Modify `tick_to_snapshot` in `arrowhedgelab/src/substrate/emitter.py`:

```python
    raw_signals = t.signal.get("signals")
    signals = raw_signals if isinstance(raw_signals, list) and raw_signals else [
        {
            "id": f"sig_{tag}",
            "agentId": str(t.signal.get("agent_id", "analyst_ensemble")),
            "signal": str(t.signal.get("signal", "hold")).lower(),
            "confidence": _norm_confidence(t.signal.get("confidence")),
            "evidenceWindowStart": _iso(observed - timedelta(minutes=30)),
            "evidenceWindowEnd": _iso(observed - timedelta(minutes=1)),
        }
    ]
    primary_signal = signals[0]
```

Then set:

```python
        "signals": signals,
        "signal": {
            "id": str(primary_signal.get("id", f"sig_{tag}")),
            "agentId": str(primary_signal.get("agentId", t.signal.get("agent_id", "analyst_ensemble"))),
            "signal": str(primary_signal.get("signal", t.signal.get("signal", "hold"))).lower(),
            "confidence": _norm_confidence(primary_signal.get("confidence", t.signal.get("confidence"))),
            "evidenceWindowStart": primary_signal.get("evidenceWindowStart") or _iso(observed - timedelta(minutes=30)),
            "evidenceWindowEnd": primary_signal.get("evidenceWindowEnd") or _iso(observed - timedelta(minutes=1)),
        },
```

And include:

```python
            "allowedActions": t.decision.get("allowedActions", {"hold": 0}),
```

inside the `decision` object.

- [x] **Step 4: Run emitter tests**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 arrowhedgelab/tests/test_substrate_emitter.py
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add arrowhedgelab/src/substrate/emitter.py arrowhedgelab/tests/test_substrate_emitter.py
git commit -m "feat: emit plural ArrowHedge signals and allowed actions"
```

---

### Task 3: Extend TypeScript Ingest Contract For Plural Signals

**Files:**
- Modify: `packages/capability-finance-research-ingest/src/arrowhedge.ts`
- Modify: `packages/capability-finance-research-ingest/src/arrowhedge.test.ts`

- [x] **Step 1: Add failing plural-signal test**

Add a test near the existing mapping-plan tests in `packages/capability-finance-research-ingest/src/arrowhedge.test.ts`:

```ts
it("maps plural ArrowHedge analyst signals without dropping dissent", () => {
  const multiSignalSnapshot = {
    ...snapshot,
    signals: [
      {
        id: "sig_aapl_ben_graham",
        agentId: "ben_graham_agent",
        signal: "bullish",
        confidence: 0.71,
        evidenceWindowStart: "2026-06-03T13:30:00.000Z",
        evidenceWindowEnd: "2026-06-03T13:59:00.000Z",
      },
      {
        id: "sig_aapl_technical",
        agentId: "technical_analyst_agent",
        signal: "bearish",
        confidence: 0.62,
        evidenceWindowStart: "2026-06-03T13:30:00.000Z",
        evidenceWindowEnd: "2026-06-03T13:59:00.000Z",
      },
    ],
  };

  const plan = buildArrowHedgeIngestionPlan(multiSignalSnapshot, {
    tenantId: tenantId("tnt_arrowhedge_plural_signals"),
    profile: FINANCE_RESEARCH_PROFILE,
    adapterStartedAt: timestamp("2026-06-03T13:59:58.500Z"),
  });

  expect(plan.valid).toBe(true);
  expect(
    plan.mapping.items.filter((item) => item.sourceName === "AnalystSignalSource"),
  ).toHaveLength(2);
  expect(plan.typedEvents.filter((event) => event.type === "analyst.signal.created")).toHaveLength(2);
});
```

- [x] **Step 2: Run the test to verify failure**

Run:

```bash
pnpm exec vitest run packages/capability-finance-research-ingest/src/arrowhedge.test.ts -t "plural ArrowHedge analyst signals"
```

Expected: FAIL because `parseArrowHedgeSnapshot` reads only `/signal`.

- [x] **Step 3: Update parsing model**

In `ParsedArrowHedgeSnapshot`, add:

```ts
readonly signalSourceRecordIds: readonly string[];
```

In `parseArrowHedgeSnapshot`, replace the single-signal handling with backwards-compatible plural handling:

```ts
const signalObjects = arrayAt(input, "/signals", []);
const normalizedSignals =
  signalObjects.length > 0
    ? signalObjects
    : [objectAt(input, "/signal", issues)].filter(Boolean);
const signalSourceRecordIds: string[] = [];

for (const [index, rawSignal] of normalizedSignals.entries()) {
  if (!isRecord(rawSignal)) {
    issues.push({ path: `/signals/${index}`, message: "expected object" });
    continue;
  }
  const signalId = stringAt(rawSignal, `/signals/${index}/id`, issues);
  const sourceRecordId = `signal:${signalId}`;
  signalSourceRecordIds.push(sourceRecordId);
  pushRecord("AnalystSignalSource", sourceRecordId, {
    kind: "analyst_signal",
    occurredAt: observedAt,
    agentId: stringAt(rawSignal, `/signals/${index}/agentId`, issues),
    signal: stringAt(rawSignal, `/signals/${index}/signal`, issues),
    confidence: numberAt(rawSignal, `/signals/${index}/confidence`, issues),
    evidenceWindowStart: optionalTimestampAt(rawSignal, `/signals/${index}/evidenceWindowStart`, issues),
    evidenceWindowEnd: optionalTimestampAt(rawSignal, `/signals/${index}/evidenceWindowEnd`, issues),
    sourceSnapshotId: snapshotId,
  });
}
```

If helper signatures do not accept `[]` for issues, add a small `optionalArrayAt` helper instead of weakening existing validators.

- [x] **Step 4: Update typed event generation**

In `buildTypedEvents`, change the single signal lookup:

```ts
const signals = items.filter((item) => item.sourceName === "AnalystSignalSource");
```

Then emit one `analyst.signal.created` event per signal:

```ts
const signalEvents = signals.map((signalItem) =>
  typedEvent({
    tenantId,
    type: "analyst.signal.created",
    entityId: signalItem.event.entityId,
    emittedBy,
    authority: snapshot.authority,
    occurredAt: snapshot.observedAt,
    payloadSchema: "finance-research/analyst-signal-created.v1",
    payload: {
      researchRunId,
      tickerId,
      sourceSnapshotId: snapshot.snapshotId,
      tickerSymbol: snapshot.tickerSymbol,
      signal: signalItem.node.identity["signal"],
      confidence: signalItem.node.identity["confidence"],
      agentId: signalItem.node.identity["agentId"],
      occurredAt: snapshot.observedAt,
      evidenceDocumentIds,
    },
  }),
);
```

Put `...signalEvents` at the beginning of the `events` array.

- [x] **Step 5: Run targeted test**

Run:

```bash
pnpm exec vitest run packages/capability-finance-research-ingest/src/arrowhedge.test.ts -t "plural ArrowHedge analyst signals"
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/capability-finance-research-ingest/src/arrowhedge.ts packages/capability-finance-research-ingest/src/arrowhedge.test.ts
git commit -m "feat: preserve plural ArrowHedge analyst signals"
```

---

### Task 4: Enforce Deterministic Action Quantity At The Substrate Boundary

**Files:**
- Modify: `packages/capability-finance-research-ingest/src/arrowhedge.ts`
- Modify: `packages/capability-finance-research-ingest/src/capability.ts`
- Modify: `packages/profile-finance-research/src/lifecycles.ts`
- Modify: `packages/profile-finance-research/src/profile.ts`
- Modify: `packages/profile-finance-research/src/entities.ts`
- Create: `packages/capability-finance-research-ingest/schemas/workflow-blocked-invalid-action.v1.json`
- Modify: `packages/capability-finance-research-ingest/src/arrowhedge.test.ts`

- [x] **Step 1: Add failing over-limit test**

Add to `arrowhedge.test.ts`:

```ts
it("blocks fresh decisions whose quantity exceeds deterministic allowed actions", () => {
  const overLimitSnapshot = {
    ...snapshot,
    decision: {
      ...snapshot.decision,
      quantity: 121,
      accepted: true,
      allowedActions: { hold: 0, buy: 120 },
    },
  };

  const plan = buildArrowHedgeIngestionPlan(overLimitSnapshot, {
    tenantId: tenantId("tnt_arrowhedge_over_limit"),
    profile: FINANCE_RESEARCH_PROFILE,
    adapterStartedAt: timestamp("2026-06-03T13:59:58.500Z"),
  });

  expect(plan.valid).toBe(true);
  expect(plan.typedEvents.map((event) => event.type)).toContain("workflow.blocked.invalid_action");
  expect(plan.typedEvents.map((event) => event.type)).not.toContain("portfolio.decision.accepted");
});
```

- [x] **Step 2: Run the test to verify failure**

Run:

```bash
pnpm exec vitest run packages/capability-finance-research-ingest/src/arrowhedge.test.ts -t "over-limit"
```

Observed: FAIL because over-limit fresh decisions emitted `portfolio.decision.accepted` and did not include `workflow.blocked.invalid_action`.

- [x] **Step 3: Add payload schema**

Create `packages/capability-finance-research-ingest/schemas/workflow-blocked-invalid-action.v1.json`:

```json
{
  "type": "object",
  "required": [
    "researchRunId",
    "blockedEntityId",
    "reason",
    "tickerSymbol",
    "action",
    "quantity",
    "allowedActions",
    "occurredAt"
  ],
  "properties": {
    "researchRunId": { "type": "string" },
    "blockedEntityId": { "type": "string" },
    "reason": { "type": "string" },
    "tickerSymbol": { "type": "string" },
    "action": { "type": "string" },
    "quantity": { "type": "number" },
    "allowedActions": { "type": "object" },
    "occurredAt": { "type": "string", "format": "date-time" }
  },
  "additionalProperties": false
}
```

- [x] **Step 4: Implement invalid-action detection**

Add a helper in `arrowhedge.ts`:

```ts
function violatesAllowedActions(snapshot: ParsedArrowHedgeSnapshot): boolean {
  const decision = snapshot.records.find(
    (record) => record.sourceName === "PortfolioDecisionSource",
  )?.row;
  if (!decision || !isRecord(decision)) return false;
  const allowedActions = decision["allowedActions"];
  if (!isRecord(allowedActions)) return false;
  const action = decision["action"];
  const quantity = decision["quantity"];
  if (typeof action !== "string" || typeof quantity !== "number") return false;
  if (action === "hold") return quantity !== 0;
  const max = allowedActions[action];
  return typeof max !== "number" || quantity > max;
}
```

Ensure `parseArrowHedgeSnapshot` copies `/decision/allowedActions` into the `PortfolioDecisionSource` row.

- [x] **Step 5: Gate acceptance and emit invalid-action block**

Change the accepted condition to include:

```ts
!violatesAllowedActions(snapshot)
```

Add a typed event when the helper returns true:

```ts
if (violatesAllowedActions(snapshot)) {
  events.push(
    typedEvent({
      tenantId,
      type: "workflow.blocked.invalid_action",
      entityId: bySource.get("ResearchRunSource")!.event.entityId,
      emittedBy,
      authority: snapshot.authority,
      occurredAt: snapshot.observedAt,
      payloadSchema: "finance-research/workflow-blocked-invalid-action.v1",
      payload: {
        researchRunId,
        blockedEntityId: decisionId,
        reason: "quantity_exceeds_allowed_actions",
        tickerSymbol: snapshot.tickerSymbol,
        action: decision.node.identity["action"],
        quantity: decision.node.identity["quantity"],
        allowedActions: decision.node.identity["allowedActions"],
        occurredAt: snapshot.observedAt,
      },
    }),
  );
}
```

- [x] **Step 6: Declare lifecycle/capability support**

Add `workflow.blocked.invalid_action` to:

- `packages/capability-finance-research-ingest/src/capability.ts`
- `packages/profile-finance-research/src/lifecycles.ts`

Use the same blocked lifecycle target as stale-state blocking.

- [x] **Step 7: Project invalid-action blocks into the COP**

Add a failing projection test that folds an over-limit plan into `createArrowHedgeCommonOperatingPictureProjection`, then assert:

```ts
expect(state.tickers["AAPL"]?.authorityGate.failures).toBe(1);
expect(state.summary.authorityGatePassRate).toBe(0);
expect(view?.workflowPosition).toBe("blocked_invalid_action");
```

Observed RED before implementation, then PASS after adding `invalidActionBlocks` to `ArrowHedgeTickerCop`.

- [x] **Step 8: Run targeted and full capability tests**

Run:

```bash
pnpm exec vitest run packages/capability-finance-research-ingest/src/arrowhedge.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/capability-finance-research-ingest/src/arrowhedge.ts packages/capability-finance-research-ingest/src/capability.ts packages/profile-finance-research/src/lifecycles.ts packages/profile-finance-research/src/profile.ts packages/profile-finance-research/src/entities.ts packages/capability-finance-research-ingest/schemas/workflow-blocked-invalid-action.v1.json packages/capability-finance-research-ingest/src/arrowhedge.test.ts
git commit -m "feat: block invalid ArrowHedge actions at substrate boundary"
```

---

### Task 5: Add Shared off/shadow/blocking Mode To ArrowHedge Requests

**Files:**
- Modify: `arrowhedgelab/app/backend/models/schemas.py`
- Modify: `arrowhedgelab/src/cli/input.py`
- Modify: `arrowhedgelab/src/substrate/run_with_substrate.py`
- Create: `arrowhedgelab/src/substrate/modes.py`
- Create: `arrowhedgelab/tests/test_substrate_modes.py`

- [x] **Step 1: Add failing schema tests**

Create `arrowhedgelab/tests/test_substrate_modes.py`:

```python
from app.backend.models.schemas import HedgeFundRequest
from src.substrate.modes import add_substrate_args


def test_hedge_fund_request_defaults_substrate_off():
    request = HedgeFundRequest(tickers=["AAPL"], graph_nodes=[], graph_edges=[])
    assert request.substrate_mode == "off"
    assert request.substrate_url is None
    assert request.substrate_tenant is None


def test_hedge_fund_request_accepts_blocking_mode():
    request = HedgeFundRequest(
        tickers=["AAPL"],
        graph_nodes=[],
        graph_edges=[],
        substrate_mode="blocking",
        substrate_url="http://127.0.0.1:4000",
        substrate_tenant="tnt_arrowhedge",
    )
    assert request.substrate_mode == "blocking"
```

- [x] **Step 2: Run tests to verify failure**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m pytest arrowhedgelab/tests/test_substrate_modes.py -q
```

Observed: RED with missing substrate mode helper/schema support. The test is run with the bundled Python direct runner because `pytest` is not installed after the ArrowHedge cleanup.

- [x] **Step 3: Add schema fields**

In `BaseHedgeFundRequest`, add:

```python
    substrate_mode: Literal["off", "shadow", "blocking"] = "off"
    substrate_url: Optional[str] = None
    substrate_tenant: Optional[str] = None
```

Import `Literal` from `typing`.

- [x] **Step 4: Add CLI args without changing defaults**

In `arrowhedgelab/src/cli/input.py`, add optional CLI args through the shared helper:

```python
parser.add_argument("--substrate-mode", choices=["off", "shadow", "blocking"], default="off")
parser.add_argument("--substrate-url", default=os.environ.get("PM_SUBSTRATE_URL"))
parser.add_argument("--substrate-tenant", default=os.environ.get("PM_SUBSTRATE_TENANT"))
```

Keep the existing no-substrate CLI behavior when mode is `off`.

- [x] **Step 5: Add shared mode helper and substrate runner mode**

Create `arrowhedgelab/src/substrate/modes.py` with `SubstrateMode`, `SUBSTRATE_MODES`, `normalize_substrate_mode`, and `add_substrate_args`.

Use the helper from `arrowhedgelab/src/cli/input.py` with default `off`, and from `arrowhedgelab/src/substrate/run_with_substrate.py` with default `shadow` to preserve the dedicated substrate runner's historical behavior.

- [x] **Step 6: Run schema tests**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 /Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 arrowhedgelab/tests/test_substrate_modes.py
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add arrowhedgelab/app/backend/models/schemas.py arrowhedgelab/src/cli/input.py arrowhedgelab/src/substrate/modes.py arrowhedgelab/src/substrate/run_with_substrate.py arrowhedgelab/tests/test_substrate_modes.py
git commit -m "feat: add ArrowHedge substrate runtime modes"
```

---

### Task 6: Wire FastAPI Run Endpoint In Shadow And Blocking Modes

**Files:**
- Modify: `arrowhedgelab/app/backend/routes/hedge_fund.py`
- Modify: `arrowhedgelab/src/substrate/envelope.py`
- Create: `arrowhedgelab/tests/test_substrate_web_run_contract.py`

- [x] **Step 1: Add unit test for blocking decision rewrite**

Create `arrowhedgelab/tests/test_substrate_web_run_contract.py`:

```python
from src.substrate.envelope import apply_substrate_gate_to_decisions


def test_blocking_mode_replaces_blocked_decision_with_hold():
    decisions = {"AAPL": {"action": "buy", "quantity": 121, "confidence": 76}}
    substrate_result = {
        "tickers": {
            "AAPL": {
                "workflowPosition": "blocked_invalid_action",
                "authorityGate": {"passes": 0, "failures": 1},
            }
        }
    }

    rewritten = apply_substrate_gate_to_decisions(
        decisions=decisions,
        substrate_mode="blocking",
        cop=substrate_result,
    )

    assert rewritten["AAPL"]["action"] == "hold"
    assert rewritten["AAPL"]["quantity"] == 0
    assert rewritten["AAPL"]["rejectionReason"] == "substrate_blocked"
```

- [x] **Step 2: Run test to verify failure**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m pytest arrowhedgelab/tests/test_substrate_web_run_contract.py -q
```

Observed: FAIL because `apply_substrate_gate_to_decisions` did not exist.

- [x] **Step 3: Implement gate result application**

Add to `arrowhedgelab/src/substrate/envelope.py`:

```python
def apply_substrate_gate_to_decisions(
    *,
    decisions: dict[str, Any],
    substrate_mode: SubstrateMode,
    cop: dict[str, Any],
) -> dict[str, Any]:
    if substrate_mode != "blocking":
        return decisions
    tickers = cop.get("tickers", {}) if isinstance(cop, dict) else {}
    rewritten = dict(decisions)
    for ticker, state in tickers.items():
        if not isinstance(state, dict):
            continue
        workflow_position = state.get("workflowPosition")
        gate = state.get("authorityGate", {}) or {}
        blocked = (
            isinstance(workflow_position, str)
            and workflow_position.startswith("blocked")
        ) or bool(gate.get("failures", 0))
        if blocked and ticker in rewritten:
            rewritten[ticker] = {
                **rewritten[ticker],
                "action": "hold",
                "quantity": 0,
                "accepted": False,
                "rejectionReason": "substrate_blocked",
            }
    return rewritten
```

- [x] **Step 4: Add tested final-data formatter**

Add `build_web_run_complete_data` to `arrowhedgelab/src/substrate/envelope.py` and cover it in `arrowhedgelab/tests/test_substrate_web_run_contract.py`.

- [x] **Step 5: Wire `/hedge-fund/run`**

In `hedge_fund.py`, after parsing final decisions and analyst signals, build an envelope when `request_data.substrate_mode != "off"`, emit per-ticker snapshots through the existing substrate route, attach `substrate` to `CompleteEvent.data`, and call `apply_substrate_gate_to_decisions` before returning decisions in blocking mode.

Blocking mode fails closed with `blocked_substrate_unavailable` if substrate config is missing or emission fails.

The final data shape must be:

```python
{
    "decisions": gated_decisions,
    "analyst_signals": analyst_signals,
    "current_prices": result.get("data", {}).get("current_prices", {}),
    "substrate": {
        "mode": request_data.substrate_mode,
        "cop": cop,
        "ingested": ingested,
    },
}
```

- [x] **Step 6: Run focused tests**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 /Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 arrowhedgelab/tests/test_substrate_web_run_contract.py
PYTHONDONTWRITEBYTECODE=1 /Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 arrowhedgelab/tests/test_substrate_emitter.py
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add arrowhedgelab/app/backend/routes/hedge_fund.py arrowhedgelab/src/substrate/envelope.py arrowhedgelab/tests/test_substrate_web_run_contract.py
git commit -m "feat: gate ArrowHedge web runs through substrate modes"
```

---

### Task 7: Gate Backtest Paper Trades Before Execution

**Files:**
- Modify: `arrowhedgelab/app/backend/services/backtest_service.py`
- Create: `arrowhedgelab/tests/test_substrate_backtest_gate.py`

- [x] **Step 1: Add failing backtest gate test**

Add to `arrowhedgelab/tests/backtesting/test_execution.py`:

```python
def test_blocking_mode_does_not_execute_substrate_blocked_trade():
    service = make_backtest_service_for_unit_test(substrate_mode="blocking")
    decisions = {"AAPL": {"action": "buy", "quantity": 121, "confidence": 76}}
    cop = {"tickers": {"AAPL": {"workflowPosition": "blocked_invalid_action"}}}

    gated = service.apply_substrate_gate(decisions, cop)

    assert gated["AAPL"]["action"] == "hold"
    assert gated["AAPL"]["quantity"] == 0
```

Implemented as dependency-light `arrowhedgelab/tests/test_substrate_backtest_gate.py`, with stubs for optional market-data/graph imports and a minimal `BacktestService`.

- [x] **Step 2: Run test to verify failure**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m pytest arrowhedgelab/tests/backtesting/test_execution.py -q
```

Observed: FAIL because backtest service did not expose `apply_substrate_gate`.

- [x] **Step 3: Implement backtest gating**

In `BacktestService`, add:

```python
    def apply_substrate_gate(self, decisions: dict[str, Any], cop: dict[str, Any]) -> dict[str, Any]:
        from src.substrate.envelope import apply_substrate_gate_to_decisions

        mode = getattr(self.request, "substrate_mode", "off")
        return apply_substrate_gate_to_decisions(
            decisions=decisions,
            substrate_mode=mode,
            cop=cop,
        )
```

In `run_backtest_async`, call the substrate emitter after `decisions` and `analyst_signals` are available and before:

```python
executed_quantity = self.execute_trade(...)
```

Use gated decisions for `execute_trade` and store both raw and gated decisions in `date_result`:

```python
date_result["raw_decisions"] = decisions
date_result["decisions"] = gated_decisions
date_result["substrate"] = substrate_result
```

- [x] **Step 4: Run backtesting tests**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 /Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 arrowhedgelab/tests/test_substrate_backtest_gate.py
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add arrowhedgelab/app/backend/services/backtest_service.py arrowhedgelab/tests/test_substrate_backtest_gate.py
git commit -m "feat: gate ArrowHedge backtest trades through substrate"
```

---

### Task 8: Add Hypothesis Experiment Runner With False-Positive Controls

**Files:**
- Create: `arrowhedgelab/src/substrate/compare_modes.py`
- Create: `arrowhedgelab/tests/test_substrate_compare_modes.py`
- Modify: `docs/validation.md`

- [x] **Step 1: Add metric test**

Create `arrowhedgelab/tests/test_substrate_compare_modes.py`:

```python
from src.substrate.compare_modes import summarize_mode_comparison


def test_mode_comparison_requires_positive_and_negative_controls():
    summary = summarize_mode_comparison(
        off_results=[
            {"ticker": "AAPL", "actionable": True, "stale": False, "blocked": False, "pnl": 10.0},
            {"ticker": "MSFT", "actionable": True, "stale": True, "blocked": False, "pnl": -5.0},
        ],
        blocking_results=[
            {"ticker": "AAPL", "actionable": True, "stale": False, "blocked": False, "pnl": 10.0},
            {"ticker": "MSFT", "actionable": True, "stale": True, "blocked": True, "pnl": 0.0},
        ],
    )

    assert summary["false_positive_blocks"] == 0
    assert summary["false_negative_stale_actions"] == 0
    assert summary["delta_protection"] == 1
    assert summary["market_delta_pnl"] == 5.0
```

- [x] **Step 2: Run test to verify failure**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m pytest arrowhedgelab/tests/test_substrate_compare_modes.py -q
```

Observed: FAIL because `compare_modes.py` did not exist.

- [x] **Step 3: Implement metric summarizer**

Create `arrowhedgelab/src/substrate/compare_modes.py`:

```python
from __future__ import annotations

from typing import Any


def summarize_mode_comparison(
    *,
    off_results: list[dict[str, Any]],
    blocking_results: list[dict[str, Any]],
) -> dict[str, Any]:
    blocking_by_ticker = {row["ticker"]: row for row in blocking_results}
    false_positive_blocks = 0
    false_negative_stale_actions = 0
    delta_protection = 0
    off_pnl = 0.0
    blocking_pnl = 0.0

    for off in off_results:
        ticker = off["ticker"]
        blocking = blocking_by_ticker.get(ticker, {})
        stale = bool(off.get("stale"))
        off_blocked = bool(off.get("blocked"))
        blocking_blocked = bool(blocking.get("blocked"))
        off_pnl += float(off.get("pnl", 0.0) or 0.0)
        blocking_pnl += float(blocking.get("pnl", 0.0) or 0.0)

        if not stale and blocking_blocked:
            false_positive_blocks += 1
        if stale and not blocking_blocked:
            false_negative_stale_actions += 1
        if stale and not off_blocked and blocking_blocked:
            delta_protection += 1

    return {
        "false_positive_blocks": false_positive_blocks,
        "false_negative_stale_actions": false_negative_stale_actions,
        "delta_protection": delta_protection,
        "off_pnl": off_pnl,
        "blocking_pnl": blocking_pnl,
        "market_delta_pnl": blocking_pnl - off_pnl,
    }
```

- [x] **Step 4: Document the no-claim rule**

In `docs/validation.md`, add a checkpoint under the behavior metrics section:

```markdown
Market-win claims require a saved paired run with:

- identical tickers, dates, model config, and source data in off and blocking modes;
- false-positive blocks = 0 on fresh in-limit actions;
- false-negative stale actions = 0 on stale or source-conflicted actions;
- replayable event ids for every substrate-blocked decision;
- backtest/PnL deltas reported separately from governance deltas.
```

- [x] **Step 5: Run verification**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 /Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 arrowhedgelab/tests/test_substrate_compare_modes.py
pnpm exec vitest run packages/capability-finance-research-ingest/src/arrowhedge.test.ts packages/substrate-http-demo/src/arrowhedge-route.test.ts
```

Expected: PASS.

- [x] **Step 6: Add paired-run report builder**

Add `build_paired_run_report` to `arrowhedgelab/src/substrate/compare_modes.py` so saved off/blocking results produce:

- `pairedRun.identicalInputs`
- `governance.false_positive_blocks`
- `governance.false_negative_stale_actions`
- `governance.replayable_blocked_decisions`
- separate `market.market_delta_pnl`
- `claimStatus.marketWinClaimAllowed`

Add tests proving a report can allow a claim only when identical inputs, zero false positives, zero false negatives, and replayable blocked event ids are present.

- [x] **Step 7: Add saved JSON report writer**

Add `write_paired_run_report_file` and a `python -m src.substrate.compare_modes` CLI so archived off/blocking run JSON files can produce an auditable paired report artifact.

- [ ] **Step 8: Commit**

```bash
git add arrowhedgelab/src/substrate/compare_modes.py arrowhedgelab/tests/test_substrate_compare_modes.py docs/validation.md
git commit -m "feat: add ArrowHedge substrate hypothesis controls"
```

---

### Task 9: Add Full Run-Envelope Ingress To pm-substrate HTTP Route

**Files:**
- Modify: `packages/capability-finance-research-ingest/src/arrowhedge.ts`
- Modify: `packages/capability-finance-research-ingest/src/index.ts`
- Modify: `packages/capability-finance-research-ingest/src/arrowhedge.test.ts`
- Modify: `packages/substrate-http-demo/src/arrowhedge-route.ts`
- Modify: `packages/substrate-http-demo/src/arrowhedge-route.test.ts`

- [x] **Step 1: Write failing run-envelope expansion test**

Added a pure capability test proving a full `arrowhedge.run-envelope.v1` with graph nodes/edges, model config, portfolio, plural signals, risk states, decisions, ticker evidence, and run evidence expands into valid per-ticker snapshots. Observed RED:

```text
TypeError: expandArrowHedgeRunEnvelope is not a function
```

- [x] **Step 2: Implement run-envelope expansion**

Added `expandArrowHedgeRunEnvelope`, exported it from the package index, and made expansion preserve:

- one validated snapshot per ticker;
- all ticker-matching analyst signals;
- deterministic `allowedActions`;
- run-level graph/model config evidence documents with stable SHA-256 hashes;
- incoming ticker-specific and run-level evidence documents.

- [x] **Step 3: Write failing HTTP route contract test**

Added a non-DB Hono/fake-port test for `POST /tenants/:tenantId/arrowhedge/run-envelopes`. Observed RED:

```text
AssertionError: expected 404 to be 200
```

- [x] **Step 4: Implement `/run-envelopes` route**

Added a run-envelope route that expands the envelope, executes the same validated graph/event ingest path as `/snapshots`, aggregates ingest counts/event ids across ticker snapshots, and catches up the COP once for the full run.

- [x] **Step 5: Verify**

Fresh verification:

```bash
pnpm exec vitest run packages/capability-finance-research-ingest/src/arrowhedge.test.ts packages/substrate-http-demo/src/arrowhedge-route.test.ts packages/evals/src/arrowhedge.test.ts packages/local-agent-lab/src/session.test.ts
pnpm --filter @pm/capability-finance-research-ingest run typecheck
pnpm --filter @pm/substrate-http-demo run typecheck
```

Observed: `36 passed | 3 skipped` for the Vitest slice, plus both package typechecks passing.

---

### Task 10: Wire Python Runtime Paths To Full Run-Envelope Ingress

**Files:**
- Modify: `arrowhedgelab/src/substrate/emitter.py`
- Modify: `arrowhedgelab/src/substrate/run_with_substrate.py`
- Modify: `arrowhedgelab/app/backend/routes/hedge_fund.py`
- Modify: `arrowhedgelab/app/backend/services/backtest_service.py`
- Modify: `arrowhedgelab/tests/test_substrate_emitter.py`
- Modify: `arrowhedgelab/tests/test_substrate_web_run_contract.py`
- Modify: `arrowhedgelab/tests/test_substrate_backtest_gate.py`
- Modify: `arrowhedgelab/tests/test_substrate_live_runner_signals.py`

- [x] **Step 1: Write failing Python emitter contract test**

Added a test proving `SubstrateEmitter.emit_run_envelope()` posts to `/arrowhedge/run-envelopes`. Observed RED:

```text
AttributeError: 'SubstrateEmitter' object has no attribute 'emit_run_envelope'
```

- [x] **Step 2: Implement envelope POST support**

Added `SubstrateEmitter.emit_run_envelope()` while keeping legacy `emit()` and `emit_tick()` snapshot compatibility.

- [x] **Step 3: Write failing runtime wiring tests**

Added tests proving web, backtest, and live-runner paths call `emit_run_envelope()` rather than per-ticker `emit_tick()`. Observed REDs:

```text
FAIL test_backtest_substrate_review_posts_full_run_envelope
FAIL test_web_run_substrate_review_posts_full_run_envelope
FAIL test_live_runner_posts_full_run_envelope: live runner must emit the full run envelope
```

- [x] **Step 4: Wire runtime paths to `/run-envelopes`**

Updated web final-output review, backtest daily review, and the dedicated live runner to post the full Python run envelope and use the returned COP/ingest metadata. The live runner also carries the requested freshness horizon into each envelope risk state before posting.

- [x] **Step 5: Verify**

Fresh Python direct-run verification:

```bash
PYTHONDONTWRITEBYTECODE=1 /Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 arrowhedgelab/tests/test_substrate_envelope.py
PYTHONDONTWRITEBYTECODE=1 /Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 arrowhedgelab/tests/test_substrate_emitter.py
PYTHONDONTWRITEBYTECODE=1 /Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 arrowhedgelab/tests/test_substrate_modes.py
PYTHONDONTWRITEBYTECODE=1 /Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 arrowhedgelab/tests/test_substrate_web_run_contract.py
PYTHONDONTWRITEBYTECODE=1 /Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 arrowhedgelab/tests/test_substrate_backtest_gate.py
PYTHONDONTWRITEBYTECODE=1 /Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 arrowhedgelab/tests/test_substrate_compare_modes.py
PYTHONDONTWRITEBYTECODE=1 /Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 arrowhedgelab/tests/test_substrate_live_runner_signals.py
```

Observed: `29/29` Python substrate direct tests passed.

---

### Task 11: Build Saved-Envelope Artifact Controls For Hypothesis Testing

**Files:**
- Modify: `arrowhedgelab/src/substrate/compare_modes.py`
- Modify: `arrowhedgelab/tests/test_substrate_compare_modes.py`
- Modify: `docs/validation.md`

- [x] **Step 1: Write failing saved-envelope artifact test**

Added a test requiring a saved `arrowhedge.run-envelope.v1` plus optional substrate response to produce a normalized run artifact with:

- deterministic model config hash;
- deterministic source/evidence hash;
- staleness derived from the envelope risk freshness window;
- blocking derived from substrate COP state;
- replay event ids from the substrate ingest response.

Observed RED:

```text
ImportError: cannot import name 'build_run_artifact_from_envelope'
```

- [x] **Step 2: Implement envelope artifact builder**

Added `build_run_artifact_from_envelope()` so false-negative/stale controls are derived from the saved input envelope rather than from the substrate projection itself.

- [x] **Step 3: Write failing artifact writer test**

Added a test requiring saved envelope JSON plus saved substrate response JSON to write a normalized artifact file. Observed RED:

```text
ImportError: cannot import name 'write_run_artifact_from_envelope_file'
```

- [x] **Step 4: Implement artifact writer and CLI**

Added `write_run_artifact_from_envelope_file()` and a backward-compatible CLI mode:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m src.substrate.compare_modes artifact-from-envelope \
  --envelope artifacts/arrowhedge/run-envelope.json \
  --mode blocking \
  --substrate-result artifacts/arrowhedge/substrate-response.json \
  --out artifacts/arrowhedge/blocking-run.json
```

- [x] **Step 5: Verify**

Fresh direct test:

```bash
PYTHONDONTWRITEBYTECODE=1 /Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 arrowhedgelab/tests/test_substrate_compare_modes.py
```

Observed: `7/7` compare-mode tests passed.

---

### Task 12: Add Deterministic Offline Substrate Review For Saved Envelopes

**Files:**
- Modify: `packages/capability-finance-research-ingest/src/arrowhedge.ts`
- Modify: `packages/capability-finance-research-ingest/src/index.ts`
- Create: `scripts/review-arrowhedge-envelope-offline.ts`
- Create: `packages/capability-finance-research-ingest/src/offline-review-script.test.ts`
- Modify: `docs/validation.md`

- [x] **Step 1: Write failing offline review test**

Added a TypeScript test requiring a complete `arrowhedge.run-envelope.v1` to be reviewed without HTTP/Postgres while still producing:

- expanded ticker counts;
- validated ingestion totals;
- deterministic typed-event ids;
- deterministic blocked event ids;
- COP authority-gate failure state for over-limit decisions.

Observed RED:

```text
TypeError: reviewArrowHedgeRunEnvelopeOffline is not a function
```

- [x] **Step 2: Implement the offline reviewer**

Added `reviewArrowHedgeRunEnvelopeOffline()` so a saved envelope can be expanded, validated through `buildArrowHedgeIngestionPlan()`, folded through the ArrowHedge COP projection, and summarized with replayable typed-event ids.

- [x] **Step 3: Write failing CLI wrapper test**

Added a package-level test requiring `scripts/review-arrowhedge-envelope-offline.ts` to read a saved envelope and write a substrate-style JSON response for later Python artifact comparison.

Observed RED:

```text
Error: Failed to load url ../../../scripts/review-arrowhedge-envelope-offline.js
```

- [x] **Step 4: Implement script wrapper**

Added:

```bash
pnpm tsx scripts/review-arrowhedge-envelope-offline.ts \
  --envelope artifacts/arrowhedge/run-envelope.json \
  --tenant tnt_arrowhedge \
  --out artifacts/arrowhedge/substrate-response.json
```

- [x] **Step 5: Verify**

Fresh verification:

```bash
pnpm exec vitest run packages/capability-finance-research-ingest/src/offline-review-script.test.ts
pnpm exec vitest run packages/capability-finance-research-ingest/src/arrowhedge.test.ts packages/capability-finance-research-ingest/src/offline-review-script.test.ts packages/substrate-http-demo/src/arrowhedge-route.test.ts packages/evals/src/arrowhedge.test.ts packages/local-agent-lab/src/session.test.ts
pnpm --filter @pm/capability-finance-research-ingest run typecheck
pnpm --filter @pm/substrate-http-demo run typecheck
pnpm --filter @pm/profile-finance-research run typecheck
```

Observed: `1/1` script tests passed, then `38` tests passed with `3` existing route skips, and all three typechecks passed.

---

### Task 13: Lock Paired Envelope Experiments And Harden Market-Claim Provenance

**Files:**
- Modify: `arrowhedgelab/src/substrate/compare_modes.py`
- Modify: `arrowhedgelab/tests/test_substrate_compare_modes.py`
- Modify: `docs/validation.md`

- [x] **Step 1: Write failing bundle/provenance tests**

Added tests requiring:

- a paired bundle writer that creates `off-run.json`, `blocking-run.json`, `paired-report.json`, and `manifest.json` from one envelope plus one substrate response;
- manifest hashes for the input envelope, substrate response, and generated artifacts;
- market-win claims to be denied when artifacts have fixture/unknown provenance.

Observed RED:

```text
ImportError: cannot import name 'write_paired_run_bundle_from_envelope_file'
```

- [x] **Step 2: Implement locked bundle and stricter claim gate**

Added `write_paired_run_bundle_from_envelope_file()` and `bundle-from-envelope` CLI mode. Normalized artifacts now carry `data_provenance`, and paired reports require historical provenance plus positive market/PnL delta before `marketWinClaimAllowed` can pass.

- [x] **Step 3: Verify**

Fresh direct test:

```bash
PYTHONDONTWRITEBYTECODE=1 /Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 arrowhedgelab/tests/test_substrate_compare_modes.py
```

Observed: `9/9` compare-mode tests passed.

---

### Task 14: Add Paired Historical Backtest Experiment Runner

**Files:**
- Create: `arrowhedgelab/src/substrate/backtest_experiment.py`
- Create: `arrowhedgelab/tests/test_substrate_backtest_experiment.py`
- Modify: `arrowhedgelab/app/backend/services/backtest_service.py`
- Modify: `arrowhedgelab/app/backend/models/schemas.py`
- Modify: `arrowhedgelab/src/substrate/compare_modes.py`
- Modify: `arrowhedgelab/tests/test_substrate_backtest_gate.py`
- Modify: `arrowhedgelab/tests/test_substrate_compare_modes.py`
- Modify: `docs/validation.md`

- [x] **Step 1: Write failing off-mode envelope and backtest-artifact tests**

Added tests requiring raw backtest outputs to include canonical `substrate_envelope` evidence even when `substrate_mode=off`, and requiring normalized backtest artifacts to derive independent staleness plus raw-decision hashes from those envelopes.

Observed RED:

```text
ImportError: cannot import name 'build_run_artifact_from_backtest_output'
ERROR test_backtest_results_store_run_envelope_even_when_substrate_off: 'substrate_envelope'
```

- [x] **Step 2: Store envelopes for every backtest day**

Added `BacktestService.build_substrate_envelope_for_day()` and now store `substrate_envelope` in each day result before substrate review. Blocking/shadow modes post that same envelope; off mode keeps it for later paired-run evidence. Backtest day schemas now name `raw_decisions`, `substrate_envelope`, and `substrate`.

- [x] **Step 3: Harden normalized backtest artifacts**

Added `build_run_artifact_from_backtest_output()`. Paired reports now include `rawDecisionHash`, require raw-decision hashes to match, and return `raw_decisions_mismatch_or_missing` when governance is not the only changed variable.

- [x] **Step 4: Write failing paired backtest runner test**

Added a test requiring one request to execute off and blocking backtests, save raw outputs, normalized artifacts, paired report, and manifest.

Observed RED:

```text
ModuleNotFoundError: No module named 'src.substrate.backtest_experiment'
```

- [x] **Step 5: Implement paired backtest runner**

Added `run_paired_backtest_experiment()` and CLI:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m src.substrate.backtest_experiment \
  --request artifacts/arrowhedge/backtest-request.json \
  --experiment-id exp_arrowhedge_axis_a_001 \
  --substrate-url http://127.0.0.1:4000 \
  --substrate-tenant tnt_arrowhedge \
  --out-dir artifacts/arrowhedge/exp_arrowhedge_axis_a_001
```

- [x] **Step 6: Verify focused tests**

Fresh direct tests:

```bash
PYTHONDONTWRITEBYTECODE=1 /Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 arrowhedgelab/tests/test_substrate_backtest_experiment.py
PYTHONDONTWRITEBYTECODE=1 /Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 arrowhedgelab/tests/test_substrate_compare_modes.py
PYTHONDONTWRITEBYTECODE=1 /Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 arrowhedgelab/tests/test_substrate_backtest_gate.py
```

Observed: `1/1`, `10/10`, and `3/3` passed.

---

### Task 15: Add Redacted Paired-Experiment Preflight

**Files:**
- Modify: `arrowhedgelab/src/substrate/backtest_experiment.py`
- Modify: `arrowhedgelab/tests/test_substrate_backtest_experiment.py`
- Modify: `docs/validation.md`

- [x] **Step 1: Write failing preflight tests**

Added tests requiring a paired backtest request preflight to:

- reject missing tickers;
- reject invalid date windows;
- reject missing graph nodes;
- reject missing portfolio-manager structure;
- reject missing substrate URL/tenant;
- reject missing required API key names;
- write a redacted preflight JSON artifact without running models or data calls.

Observed RED:

```text
ImportError: cannot import name 'validate_paired_backtest_request'
```

- [x] **Step 2: Implement preflight and dry-run CLI**

Added `validate_paired_backtest_request()` and `write_backtest_experiment_preflight_file()`. The paired experiment runner now runs preflight before executing, includes preflight details in `manifest.json`, and the CLI supports:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m src.substrate.backtest_experiment \
  --request artifacts/arrowhedge/backtest-request.json \
  --experiment-id exp_arrowhedge_axis_a_001 \
  --substrate-url http://127.0.0.1:4000 \
  --substrate-tenant tnt_arrowhedge \
  --out-dir artifacts/arrowhedge/exp_arrowhedge_axis_a_001 \
  --dry-run
```

- [x] **Step 3: Verify focused test**

Fresh direct test:

```bash
PYTHONDONTWRITEBYTECODE=1 /Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 arrowhedgelab/tests/test_substrate_backtest_experiment.py
```

Observed: `3/3` passed.

---

### Task 16: Add A Checked-In Axis A Backtest Request Template

**Files:**
- Create: `arrowhedgelab/examples/substrate/backtest-request.axis-a.sample.json`
- Modify: `arrowhedgelab/tests/test_substrate_backtest_experiment.py`
- Modify: `docs/validation.md`

- [x] **Step 1: Add sample request and preflight coverage**

Added a starter `BacktestRequest` for the paired Axis A experiment with:

- AAPL/MSFT historical window;
- Ben Graham and Technical Analyst nodes;
- Portfolio Manager node;
- analyst-to-portfolio graph edges;
- substrate URL/tenant placeholders;
- empty `api_keys` so secrets come from environment/app storage.

Added a test proving the checked-in sample passes preflight when the required API key names are present in the environment.

- [x] **Step 2: Verify focused test**

Fresh direct test:

```bash
PYTHONDONTWRITEBYTECODE=1 /Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 arrowhedgelab/tests/test_substrate_backtest_experiment.py
```

Observed: `4/4` passed.

---

### Task 17: Add Completed Bundle Verification

**Files:**
- Modify: `arrowhedgelab/src/substrate/backtest_experiment.py`
- Modify: `arrowhedgelab/tests/test_substrate_backtest_experiment.py`
- Modify: `docs/validation.md`

- [x] **Step 1: Write failing verifier tests**

Added tests requiring completed paired backtest bundles to be verified after generation. The verifier must:

- accept a clean generated bundle;
- recompute manifest artifact hashes;
- recompute `paired-report.json` from saved normalized artifacts;
- require raw off/blocking results to include day-level `substrate_envelope` records;
- reject tampered artifacts;
- expose a `verify-bundle` CLI path.

Observed RED:

```text
ImportError: cannot import name 'verify_paired_backtest_bundle'
```

- [x] **Step 2: Implement verifier and CLI**

Added `verify_paired_backtest_bundle()` and:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m src.substrate.backtest_experiment verify-bundle \
  --bundle-dir artifacts/arrowhedge/exp_arrowhedge_axis_a_001 \
  --out artifacts/arrowhedge/exp_arrowhedge_axis_a_001/verification.json
```

The command returns success only when the bundle is untampered and `marketWinClaimAllowed` is true.

- [x] **Step 3: Verify focused test**

Fresh direct test:

```bash
PYTHONDONTWRITEBYTECODE=1 /Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 arrowhedgelab/tests/test_substrate_backtest_experiment.py
```

Observed: `7/7` passed.

---

### Task 18: Add Live Environment Readiness Check

**Files:**
- Modify: `arrowhedgelab/src/substrate/backtest_experiment.py`
- Modify: `arrowhedgelab/tests/test_substrate_backtest_experiment.py`
- Modify: `docs/validation.md`

- [x] **Step 1: Write failing readiness tests**

Added tests requiring a readiness check to:

- reuse the redacted paired-backtest request preflight;
- probe `/healthz`, tenant existence, `finance-research` profile installation, and the live substrate COP route for the selected tenant;
- return ready only when preflight and every substrate readiness probe pass;
- avoid exposing API key values;
- report substrate probe failures distinctly.

Observed RED:

```text
ImportError: cannot import name 'check_paired_backtest_environment'
```

- [x] **Step 2: Implement readiness checker and CLI**

Added `check_paired_backtest_environment()` and:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m src.substrate.backtest_experiment check-env \
  --request examples/substrate/backtest-request.axis-a.sample.json \
  --substrate-url http://127.0.0.1:4000 \
  --substrate-tenant tnt_arrowhedge \
  --out artifacts/arrowhedge/exp_arrowhedge_axis_a_001/readiness.json
```

- [x] **Step 3: Verify focused and real local readiness command**

Fresh direct test:

```bash
PYTHONDONTWRITEBYTECODE=1 /Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 arrowhedgelab/tests/test_substrate_backtest_experiment.py
```

Observed: `10/10` passed after tightening the probe matrix.

Real local command with test key names:

```bash
FINANCIAL_DATASETS_API_KEY=test-financial-key OPENAI_API_KEY=test-openai-key \
PYTHONDONTWRITEBYTECODE=1 /Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
  -m src.substrate.backtest_experiment check-env \
  --request examples/substrate/backtest-request.axis-a.sample.json \
  --substrate-url http://127.0.0.1:4000 \
  --substrate-tenant tnt_arrowhedge \
  --out /tmp/arrowhedge-axis-a-preflight/readiness.json
```

Observed initially: `{"issues": 1, "ready": false, "substrate": false}` because `127.0.0.1:4000` was occupied by a non-substrate Werkzeug service.

After starting `@pm/substrate-http-demo` on port `4011`, seeding tenant `tnt_arrowhedge`, and installing the `finance-research` profile, the real local command returned:

```json
{"issues": 0, "ready": true, "substrate": true}
```

The saved readiness file showed all four checks passing: health, tenant, profile, and COP.

---

### Task 19: Fix Live Envelope Portfolio Contract Found By Local Ingest

**Files:**
- Modify: `arrowhedgelab/src/substrate/envelope.py`
- Modify: `arrowhedgelab/tests/test_substrate_envelope.py`

- [x] **Step 1: Reproduce live ingest rejection**

Posted a synthetic Python run envelope to the local demo route:

```bash
POST http://127.0.0.1:4011/tenants/tnt_arrowhedge/arrowhedge/run-envelopes
```

Observed RED:

```json
{"error":"invalid run envelope","issues":[{"path":"/portfolio/equity","message":"expected finite number"},{"path":"/portfolio/marginUsed","message":"expected finite number"}]}
```

- [x] **Step 2: Add regression test and normalize portfolio fields**

Added a regression test requiring `build_run_envelope()` to default finite
`portfolio.equity`, `portfolio.marginRequirement`, and `portfolio.marginUsed`
values when ArrowHedge supplies snake_case or partial portfolio state.

Implemented portfolio normalization in `arrowhedgelab/src/substrate/envelope.py`.

- [x] **Step 3: Verify test and live ingest**

Fresh direct test:

```bash
PYTHONDONTWRITEBYTECODE=1 /Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 arrowhedgelab/tests/test_substrate_envelope.py
```

Observed: `3/3` passed.

Retried the synthetic local envelope POST. Observed HTTP 200:

```json
{
  "status": 200,
  "expanded": {"snapshots": 1, "tickers": ["AAPL"]},
  "ingested": {"nodesCreated": 12, "edgesCreated": 21, "eventsPublished": 16},
  "copTickers": ["AAPL"]
}
```

---

### Task 20: Add Repeatable ArrowHedge Tenant/Profile Seed

**Files:**
- Create: `scripts/seed-arrowhedge.ts`
- Modify: `package.json`
- Modify: `docs/validation.md`

- [x] **Step 1: Add idempotent seed command**

Added `pnpm arrowhedge:seed`, which creates the configured ArrowHedge tenant
and installs the `finance-research` profile directly in Postgres once substrate
tables are available.

- [x] **Step 2: Verify seed command**

Fresh command:

```bash
PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate \
PM_ARROWHEDGE_TENANT_ID=tnt_arrowhedge \
pnpm arrowhedge:seed
```

Observed:

```text
arrowhedge ready: tenant=tnt_arrowhedge profile=finance-research@1
```

- [x] **Step 3: Document setup**

Updated `docs/validation.md` so the operator flow now includes seeding the
tenant/profile and starting the HTTP demo before `check-env`.

---

### Task 21: Repair Fresh Database Migration Reliability

**Files:**
- Modify: `db/migrations/0053_agent_state_history_store_head_pruning_tombstone_store_head_witness_authority.sql`
- Modify: `db/migrations/0054_agent_state_history_store_head_pruning_tombstone_store_head_witness_quorum_certificates.sql`
- Modify: `db/migrations/0055_agent_state_history_store_head_pruning_tombstone_store_head_checkpoint_admissions.sql`
- Modify: `db/migrations/0056_agent_state_history_store_head_pruning_tombstone_store_head_pruning_tombstones.sql`
- Modify: `db/migrations/0057_agent_state_history_store_head_pruning_tombstone_store_head_pruning_tombstone_store_head_witness.sql`
- Modify: `db/migrations/0058_agent_state_history_store_head_pruning_tombstone_store_head_pruning_tombstone_store_head_witness_authority.sql`
- Modify: `db/migrations/0069_agent_state_storage_mutation_guard_authorization_admissions.sql`
- Modify: later overlong `agent_state` migration table/index identifiers
- Create: `db/migrations/0146_agent_state_short_identifier_repair_indexes.sql`
- Modify: `packages/agent-state/src/index.ts`
- Modify: `packages/agent-state/src/index.test.ts`
- Modify: `docs/arrowhedgelab-pm-substrate-integration-audit-2026-07-01.md`

- [x] **Step 1: Reproduce migration failure**

Fresh migration failed after `0052` because PostgreSQL truncated the long
`agent_state` pruning-tombstone table names to the same 63-byte physical
identifier. Migration `0053` then skipped its intended table and failed when
creating an index on `effective_from_pruning_tombstone_sequence`.

- [x] **Step 2: Shorten physical identifiers and add repair migration**

Shortened overlong table/index identifiers in unapplied migrations and matching
agent-state store references. Added `0146_agent_state_short_identifier_repair_indexes.sql`
for legacy already-applied index-name collisions, and quoted the `authorization`
column in migration `0069`.

- [x] **Step 3: Verify fresh and existing database paths**

Fresh temp DB:

```text
applied 78 migration(s)
146 applied migrations
```

Current dev DB:

```text
applied 94 migration(s)
146 applied migrations
```

Follow-up checks:

```text
pnpm db:migrate
no migrations to apply
```

```json
{"tableIdentifierCollisions":0,"collisions":[]}
```

---

### Task 22: Fix Repeat-Run ArrowHedge Ingest Identity

**Files:**
- Modify: `arrowhedgelab/src/substrate/envelope.py`
- Modify: `arrowhedgelab/tests/test_substrate_envelope.py`
- Modify: `docs/arrowhedgelab-pm-substrate-integration-audit-2026-07-01.md`

- [x] **Step 1: Reproduce repeat-ingest false positive**

After the full migrations were available, a second synthetic local envelope POST
failed first on reused signal ids:

```json
{"error":"edge \"finance-research/research_run_has_signal\" to-cardinality exactly:1 would be exceeded (proposed count 2)"}
```

After signal ids were made run-scoped, the next retry exposed reused
run-specific evidence ids:

```json
{"error":"schemaVersion mismatch for EvidenceDocument: caller=2, profile=1"}
```

- [x] **Step 2: Make run-specific source records immutable**

Changed ArrowHedge signal ids to include `runId` and changed signal/risk
evidence document ids and source URIs to include `runId`. This matches their
hash inputs, which already include `runId`, and prevents repeated runs from
mutating earlier evidence records.

- [x] **Step 3: Verify test and live Postgres-backed ingest**

Fresh direct test:

```bash
PYTHONDONTWRITEBYTECODE=1 /Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 arrowhedgelab/tests/test_substrate_envelope.py
```

Observed: `3/3` passed.

Live POST to `http://127.0.0.1:4011/tenants/tnt_arrowhedge/arrowhedge/run-envelopes`
after migration, seed, readiness, and identity fixes returned:

```json
{
  "status": 200,
  "expanded": {"snapshots": 1, "tickers": ["AAPL"]},
  "ingested": {
    "nodesCreated": 11,
    "nodesUpdated": 0,
    "edgesCreated": 21,
    "eventsPublished": 16
  },
  "copTickers": ["AAPL"]
}
```

---

### Task 23: Split Graph Profile Schema Version From Row Revision

**Files:**
- Create: `db/migrations/0147_graph_node_revision.sql`
- Modify: `packages/types/src/node.ts`
- Modify: `packages/graph/src/interfaces.ts`
- Modify: `packages/graph/src/errors.ts`
- Modify: `packages/graph/src/postgres.ts`
- Modify: `packages/graph/src/postgres.test.ts`
- Modify: `packages/graph/src/validator-wiring.test.ts`
- Modify: `packages/graph/src/staleness.test.ts`
- Modify: `packages/capability-finance-research-ingest/src/arrowhedge.ts`
- Modify: `packages/capability-finance-research-ingest/src/arrowhedge.test.ts`
- Modify: `packages/substrate-http-demo/src/arrowhedge-route.test.ts`
- Modify: `docs/arrowhedgelab-pm-substrate-integration-audit-2026-07-01.md`

- [x] **Step 1: Add regression for schema-version false positives**

Added a graph validator-wiring regression requiring repeated profile-bound
updates to keep `schemaVersion` stable at the profile entity schema version
while advancing a separate `revision` token.

Observed RED before the fix:

```text
optimistic concurrency conflict ... expected schemaVersion undefined, found 1
```

- [x] **Step 2: Add graph node revision and update the API**

Added `graph.nodes.revision`, migrated existing bumped profile-bound
`schema_version` values back to installed profile entity schema versions, and
changed `PostgresGraph.updateNode()` to advance `revision` instead of
`schema_version`. `expectedRevision` is now the preferred optimistic
concurrency token; `expectedSchemaVersion` remains as a legacy fallback for
older callers.

- [x] **Step 3: Verify graph, HTTP, migration, and ArrowHedge paths**

Fresh focused tests:

```text
packages/graph/src/validator-wiring.test.ts: 8 passed
packages/graph/src/postgres.test.ts: 11 passed
packages/substrate-http/src/app.test.ts: 14 passed
```

Typechecks passed for:

```text
@pm/types
@pm/graph
@pm/substrate-http
@pm/capability-finance-research-ingest
@pm/substrate-http-demo
```

Fresh temp DB migration reached:

```text
147
0147_graph_node_revision.sql
revision:integer:NO:1
schema_version:integer:NO:1
```

Live ArrowHedge envelope POST after the graph revision split returned:

```json
{
  "status": 200,
  "expanded": {"snapshots": 1, "tickers": ["AAPL"]},
  "ingested": {
    "nodesCreated": 11,
    "nodesUpdated": 0,
    "edgesCreated": 21,
    "eventsPublished": 16
  },
  "copTickers": ["AAPL"]
}
```

---

## Completion Audit

Before declaring this implementation complete, verify all of the following against current files and command output:

- [x] `arrowhedgelab` can run with substrate `off` and produce the same shape of decisions it produced before this work.
- [x] `shadow` mode emits substrate artifacts but does not alter decisions or trades.
- [x] `blocking` mode prevents stale, source-conflicted, and over-limit decisions before web output and before backtest paper-trade execution.
- [x] Every selected analyst signal appears in substrate typed events; no best-signal collapse remains in the full path.
- [x] Raw analyst, risk, and decision payloads are hashed into ticker-scoped evidence documents before runtime snapshot emission.
- [x] Full run envelopes can be posted to pm-substrate and expanded into validated ticker snapshots with graph/model config evidence.
- [x] Python web, backtest, and live-runner paths use the full run-envelope POST path instead of collapsing runtime emission to per-ticker snapshots.
- [x] Saved run envelopes can be reviewed offline into a substrate-style response with deterministic COP and blocked event ids.
- [x] Saved run envelopes can be converted into normalized off/blocking artifacts with independent staleness labels and replay event ids.
- [x] Saved run envelopes can be bundled into locked off/blocking/report/manifest artifacts, and fixture/unknown provenance cannot authorize a market-win claim.
- [x] Raw backtest outputs carry day-level run envelopes in off and blocking mode, and paired backtest experiments can be generated from one locked request with matching raw-decision hashes.
- [x] Paired historical experiments have a dry-run preflight that writes redacted readiness evidence and refuses malformed requests before model/data calls.
- [x] A checked-in starter backtest request can pass preflight with environment-provided key names, making the final paired experiment easy to run without committing secrets.
- [x] Completed paired backtest bundles can be independently verified for manifest integrity, recomputed report equality, day-level envelope presence, and claim readiness.
- [x] Local environment readiness can be checked before spending model/data calls; it now requires service health, tenant existence, `finance-research` profile installation, and ArrowHedge COP route readiness.
- [x] A local synthetic Python envelope can be posted to the live substrate HTTP demo and ingested into Postgres-backed graph/events/COP.
- [x] ArrowHedge tenant/profile setup has a repeatable seed command instead of requiring a manual profile POST.
- [x] Fresh pm-substrate migrations can run through all `147` migrations on a clean database, and no new table-name truncation collisions remain.
- [x] Repeated ArrowHedge envelope ingests use run-scoped signal/evidence identities and do not update prior run-specific evidence records.
- [x] pm-substrate graph updates keep profile schema version stable and use a separate row revision for optimistic concurrency, preventing schema-version false positives on legitimate repeated profile-bound updates.
- [x] The Python tests pass with bytecode disabled.
- [x] The TypeScript ArrowHedge capability and HTTP route tests pass.
- [x] The final market-win report distinguishes governance metrics from PnL/backtest metrics.
- [x] No claim is made from synthetic stale injection alone.

Recommended final verification command:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m pytest arrowhedgelab/tests/test_substrate_envelope.py arrowhedgelab/tests/test_substrate_emitter.py arrowhedgelab/tests/test_substrate_modes.py arrowhedgelab/tests/test_substrate_web_run_contract.py arrowhedgelab/tests/test_substrate_compare_modes.py -q
pnpm exec vitest run packages/capability-finance-research-ingest/src/arrowhedge.test.ts packages/substrate-http-demo/src/arrowhedge-route.test.ts
```
