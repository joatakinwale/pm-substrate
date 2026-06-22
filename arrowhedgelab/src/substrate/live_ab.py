"""LIVE A/B: real LLM agent decisions, with vs without the substrate gate.

This is the live-proof counterpart to src/substrate/experiment.py (which used
seeded synthetic ticks). Here every decision comes from the REAL hedge fund
(run_hedge_fund: ~19 LLM agents + market data). We then run the same two arms
the seeded experiment defined:

  - Arm A (agents alone, NO gate): if the real agent proposed an ACTIONABLE
    decision (buy/sell with quantity > 0) on a tick whose risk read is STALE,
    the raw agent acts on stale state. Count it as an unguarded stale action.
  - Arm B (agents + substrate): emit the SAME decision through the substrate
    ingest route with the stale freshness window; the COP authority/freshness
    gate should flag/block it (staleBlocks or authorityGate.failures).

Stale injection: we mark a deterministic subset of tickers stale (every other
actionable ticker, by sorted order) and emit those with a negative freshness
horizon so freshnessExpiresAt < observedAt (the substrate isStale() trigger).
Fresh tickers are emitted with a positive horizon.

Metrics (identical definitions to experiment.py):
  arm_a_stale_action_rate     = unguarded stale actions / actionable ticks
  arm_b_stale_blocked_rate    = stale ticks the COP flagged / stale ticks
  delta_protection            = stale actions Arm B blocked that Arm A took
  falsified                   = True iff Arm B blocked nothing while stale>0

Usage:
  PM_SUBSTRATE_URL=http://127.0.0.1:4100 PM_SUBSTRATE_TENANT=<tenant> \
    python3 -m src.substrate.live_ab --tickers AAPL,MSFT,NVDA,TSLA,GOOGL \
      --start 2026-05-01 --end 2026-06-03 \
      --model-name claude-haiku-4-5 --model-provider Anthropic
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from typing import Any

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from src.main import run_hedge_fund  # noqa: E402
from src.substrate.emitter import SubstrateEmitter, TickInputs  # noqa: E402
from src.substrate.run_with_substrate import (  # noqa: E402
    _best_signal_for_ticker,
    _risk_for_ticker,
)


def _is_actionable(decision: dict[str, Any]) -> bool:
    action = str(decision.get("action", "hold")).lower()
    try:
        qty = float(decision.get("quantity", 0) or 0)
    except (TypeError, ValueError):
        qty = 0.0
    return action in ("buy", "sell", "short", "cover") and qty > 0


def run(
    tickers: list[str],
    start_date: str,
    end_date: str,
    base_url: str,
    tenant_id: str,
    model_name: str,
    model_provider: str,
    fresh_minutes: int,
    stale_minutes: int,
) -> dict[str, Any]:
    portfolio = {
        "cash": 100000.0,
        "margin_requirement": 0.0,
        "margin_used": 0.0,
        "positions": {
            t: {"long": 0, "short": 0, "long_cost_basis": 0.0, "short_cost_basis": 0.0}
            for t in tickers
        },
        "realized_gains": {t: {"long": 0.0, "short": 0.0} for t in tickers},
    }

    result = run_hedge_fund(
        tickers=tickers,
        start_date=start_date,
        end_date=end_date,
        portfolio=portfolio,
        model_name=model_name,
        model_provider=model_provider,
    )
    decisions = result.get("decisions") or {}
    analyst_signals = result.get("analyst_signals") or {}

    emitter = SubstrateEmitter(base_url=base_url, tenant_id=tenant_id)
    observed = datetime.now(timezone.utc)

    # Deterministic stale injection: every other ticker (sorted) is marked stale.
    ordered = sorted(tickers)
    stale_set = {t for i, t in enumerate(ordered) if i % 2 == 1}

    actionable = 0
    stale_ticks = 0
    arm_a_stale_actions = 0
    arm_b_blocked = 0
    per_ticker: list[dict[str, Any]] = []

    for idx, ticker in enumerate(ordered):
        decision = decisions.get(ticker) or {"action": "hold", "quantity": 0, "confidence": 0}
        risk = _risk_for_ticker(analyst_signals, ticker)
        signal = _best_signal_for_ticker(analyst_signals, ticker)
        is_actionable = _is_actionable(decision)
        is_stale = ticker in stale_set

        if is_actionable:
            actionable += 1
        if is_stale:
            stale_ticks += 1
            # Arm A: raw agent has no gate. It only "acts on stale state" if it
            # actually proposed an actionable decision on this stale tick.
            if is_actionable:
                arm_a_stale_actions += 1

        ti = TickInputs(
            ticker=ticker,
            observed_at=observed,
            decision={
                "action": decision.get("action", "hold"),
                "quantity": decision.get("quantity", 0),
                "confidence": decision.get("confidence", 0),
                "reasoning": decision.get("reasoning", ""),
            },
            risk=risk,
            portfolio={"cash": portfolio["cash"], "equity": portfolio["cash"], "margin_used": 0.0},
            signal=signal,
            backtest_id=f"liveab_{ticker.lower()}",
            research_strategy="live-ab-ensemble",
            model_lock=f"{model_provider}:{model_name}",
            scope_start=start_date,
            scope_end=end_date,
            # Negative horizon => freshnessExpiresAt < observedAt => substrate isStale().
            freshness_minutes=(-abs(stale_minutes) if is_stale else abs(fresh_minutes)),
        )
        resp = emitter.emit_tick(ti)
        cop = resp.get("cop", {})
        ticker_cop = (cop.get("tickers") or {}).get(ticker, {})
        gate = ticker_cop.get("authorityGate", {}) or {}
        stale_blocks = ticker_cop.get("staleBlocks", 0) or 0

        flagged = bool(stale_blocks) or bool(gate.get("failures", 0))
        if is_stale and flagged:
            arm_b_blocked += 1

        per_ticker.append(
            {
                "ticker": ticker,
                "decision": {"action": decision.get("action"), "quantity": decision.get("quantity"), "confidence": decision.get("confidence")},
                "actionable": is_actionable,
                "stale_injected": is_stale,
                "ingested_events": resp.get("ingested", {}).get("eventsPublished"),
                "cop_authorityGate": gate,
                "cop_staleBlocks": stale_blocks,
                "substrate_flagged": flagged,
                "arm_a_acted_on_stale": is_stale and is_actionable,
                "arm_b_blocked": is_stale and flagged,
            }
        )

    summary = emitter.read_cop().get("cop", {}).get("summary", {})
    return {
        "mode": "live",
        "model": f"{model_provider}:{model_name}",
        "tickers": ordered,
        "stale_injected": sorted(stale_set),
        "actionable_ticks": actionable,
        "stale_ticks": stale_ticks,
        "arm_a_stale_action_rate": (arm_a_stale_actions / actionable) if actionable else 0.0,
        "arm_b_stale_blocked_rate": (arm_b_blocked / stale_ticks) if stale_ticks else 0.0,
        "arm_b_authority_gate_pass_rate": summary.get("authorityGatePassRate"),
        "delta_protection": arm_b_blocked,
        "falsified": arm_b_blocked <= 0 and stale_ticks > 0,
        "per_ticker": per_ticker,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers", default="AAPL,MSFT,NVDA,TSLA,GOOGL")
    ap.add_argument("--start", required=True)
    ap.add_argument("--end", required=True)
    ap.add_argument("--fresh-minutes", type=int, default=10)
    ap.add_argument("--stale-minutes", type=int, default=30)
    ap.add_argument("--model-name", default=os.environ.get("ARROWHEDGE_MODEL", "claude-haiku-4-5"))
    ap.add_argument("--model-provider", default=os.environ.get("ARROWHEDGE_PROVIDER", "Anthropic"))
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    base_url = os.environ.get("PM_SUBSTRATE_URL", "http://127.0.0.1:4100")
    tenant_id = os.environ.get("PM_SUBSTRATE_TENANT")
    if not tenant_id:
        print("PM_SUBSTRATE_TENANT is required (tenant with finance-research installed).")
        return 2

    tickers = [t.strip().upper() for t in args.tickers.split(",") if t.strip()]
    result = run(
        tickers=tickers,
        start_date=args.start,
        end_date=args.end,
        base_url=base_url,
        tenant_id=tenant_id,
        model_name=args.model_name,
        model_provider=args.model_provider,
        fresh_minutes=args.fresh_minutes,
        stale_minutes=args.stale_minutes,
    )
    out = json.dumps(result, indent=2)
    print(out)
    if args.out:
        with open(args.out, "w") as f:
            f.write(out + "\n")
        print(f"\nwrote {args.out}")
    print(
        f"\nRESULT (live): Arm A stale-action rate {result['arm_a_stale_action_rate']:.2f} "
        f"vs Arm B blocked rate {result['arm_b_stale_blocked_rate']:.2f}; "
        f"substrate blocked {result['delta_protection']} stale action(s) the raw agents took."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
