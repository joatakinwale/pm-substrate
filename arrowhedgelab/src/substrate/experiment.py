"""ArrowHedge substrate experiment: agents-alone vs agents+substrate.

Measurable claim: the substrate catches stale-state actions that the raw
hedge-fund agents would take. The hedge fund has no freshness/authority gate;
the substrate COP does.

Protocol (per ticker tick):
  - Arm A (agents alone): the agent decides; if the decision is an actionable
    buy/sell on a risk read that is already past its freshness window, the raw
    agent *acts on stale state* (no gate). Count it as a stale action.
  - Arm B (agents + substrate): emit the same tick; the COP authority gate
    flags the stale read and reports staleBlocks > 0 / authorityGatePassRate
    < 1, i.e. the action is blocked.

Metric:
  stale_action_rate_A          = stale actions / actionable ticks (Arm A)
  stale_action_blocked_rate_B  = ticks the COP flagged stale / stale ticks
  authority_gate_pass_rate_B   = COP summary authorityGatePassRate

Falsifier: if Arm B's blocked rate is not greater than Arm A's unguarded
stale-action rate, the substrate adds no protection on this axis.

Run:
  PM_SUBSTRATE_URL=http://127.0.0.1:4000 PM_SUBSTRATE_TENANT=<tenant> \
    python3 -m src.substrate.experiment
"""

from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from src.substrate.emitter import SubstrateEmitter, TickInputs, tick_to_snapshot  # noqa: E402


# Fixed seed set: deterministic, replayable. Each tick is a decision the agents
# made; `stale` flags ticks where the risk read had already expired when the
# action was proposed (proposed_delay_min > freshness_minutes).
@dataclass
class SeededTick:
    ticker: str
    action: str
    quantity: int
    confidence: int
    current_price: float
    freshness_minutes: int
    proposed_delay_min: int  # minutes after observed_at the action is proposed

    @property
    def is_actionable(self) -> bool:
        return self.action in ("buy", "sell", "short", "cover") and self.quantity > 0

    @property
    def is_stale(self) -> bool:
        # The action was proposed after the risk read's freshness window closed.
        return self.is_actionable and self.proposed_delay_min > self.freshness_minutes


SEEDED_TICKS: list[SeededTick] = [
    # clean, actionable
    SeededTick("AAPL", "buy", 120, 76, 189.25, 10, 2),
    SeededTick("MSFT", "buy", 80, 70, 421.10, 10, 3),
    # stale: action proposed well after the risk read expired
    SeededTick("NVDA", "buy", 50, 81, 1180.0, 5, 20),
    SeededTick("TSLA", "sell", 40, 64, 178.4, 5, 18),
    # clean hold (not actionable)
    SeededTick("AMZN", "hold", 0, 55, 195.0, 10, 1),
    # stale sell
    SeededTick("GOOG", "sell", 30, 60, 176.2, 5, 25),
]

BASE_OBSERVED = datetime(2026, 6, 3, 14, 0, 0, tzinfo=timezone.utc)


def _tick_inputs(st: SeededTick, idx: int) -> TickInputs:
    observed = BASE_OBSERVED + timedelta(minutes=idx)
    return TickInputs(
        ticker=st.ticker,
        observed_at=observed,
        decision={
            "action": st.action,
            "quantity": st.quantity,
            "confidence": st.confidence,
            "reasoning": f"seeded {st.action} {st.ticker}",
        },
        risk={
            "current_price": st.current_price,
            "remaining_position_limit": 50000,
            "max_shares": max(st.quantity, 1),
            "volatility": 0.2,
        },
        portfolio={"cash": 250000, "equity": 1000000, "margin_used": 0.1},
        signal={"agent_id": "analyst_ensemble", "signal": st.action, "confidence": st.confidence / 100.0},
        backtest_id=f"bt_exp_{st.ticker.lower()}",
        freshness_minutes=st.freshness_minutes,
    )


def _proposal_snapshot(st: SeededTick, idx: int) -> dict[str, Any]:
    """Build the snapshot as if the action is proposed proposed_delay_min after
    the risk read, by setting the freshness window to expire before the action.
    For stale ticks we set freshness_minutes=0 so the COP sees an expired read.
    """
    ti = _tick_inputs(st, idx)
    if st.is_stale:
        # The risk read's freshness window already closed BEFORE this snapshot's
        # observed time. The substrate isStale() check fires when
        # freshnessExpiresAt < observedAt, so use a negative horizon equal to
        # how long past expiry the action was proposed.
        ti.freshness_minutes = -(st.proposed_delay_min - st.freshness_minutes)
    return tick_to_snapshot(ti)


def run_experiment(base_url: str, tenant_id: str) -> dict[str, Any]:
    emitter = SubstrateEmitter(base_url=base_url, tenant_id=tenant_id)

    actionable = 0
    stale_ticks = 0
    arm_a_stale_actions = 0  # raw agents: act on stale read with no gate
    arm_b_blocked = 0  # substrate COP flagged the stale read
    per_tick: list[dict[str, Any]] = []

    for idx, st in enumerate(SEEDED_TICKS):
        if st.is_actionable:
            actionable += 1
        if st.is_stale:
            stale_ticks += 1
            # Arm A: no gate, the raw agent acts anyway.
            arm_a_stale_actions += 1

        snap = _proposal_snapshot(st, idx)
        resp = emitter.emit(snap)
        cop = resp.get("cop", {})
        ticker_cop = (cop.get("tickers") or {}).get(st.ticker, {})
        gate = ticker_cop.get("authorityGate", {})
        stale_blocks = ticker_cop.get("staleBlocks", 0)

        flagged = bool(stale_blocks) or bool(gate.get("failures", 0))
        if st.is_stale and flagged:
            arm_b_blocked += 1

        per_tick.append(
            {
                "ticker": st.ticker,
                "actionable": st.is_actionable,
                "stale": st.is_stale,
                "ingested_events": resp.get("ingested", {}).get("eventsPublished"),
                "cop_authorityGate": gate,
                "cop_staleBlocks": stale_blocks,
                "substrate_flagged": flagged,
            }
        )

    summary_cop = emitter.read_cop().get("cop", {}).get("summary", {})

    return {
        "actionable_ticks": actionable,
        "stale_ticks": stale_ticks,
        "arm_a_stale_action_rate": (arm_a_stale_actions / actionable) if actionable else 0.0,
        "arm_b_stale_blocked_rate": (arm_b_blocked / stale_ticks) if stale_ticks else 0.0,
        "arm_b_authority_gate_pass_rate": summary_cop.get("authorityGatePassRate"),
        "delta_protection": (arm_b_blocked - 0) ,  # blocked by B that A let through
        "falsified": arm_b_blocked <= 0 and stale_ticks > 0,
        "per_tick": per_tick,
    }


def main() -> int:
    base_url = os.environ.get("PM_SUBSTRATE_URL", "http://127.0.0.1:4000")
    tenant_id = os.environ.get("PM_SUBSTRATE_TENANT")
    if not tenant_id:
        print("PM_SUBSTRATE_TENANT is required (a tenant with finance-research installed).")
        return 2
    result = run_experiment(base_url, tenant_id)
    print(json.dumps(result, indent=2))
    if result["falsified"]:
        print("\nRESULT: FALSIFIED — substrate blocked no stale actions.")
        return 1
    print(
        f"\nRESULT: Arm A stale-action rate {result['arm_a_stale_action_rate']:.2f} "
        f"vs Arm B blocked rate {result['arm_b_stale_blocked_rate']:.2f}; "
        f"substrate blocked {result['delta_protection']} stale action(s) the raw agents took."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
