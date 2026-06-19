"""Run the REAL ArrowHedgeLab hedge fund and emit each decision into the
substrate, live.

This is the seeded-proof -> live-proof wiring. It calls the actual
`run_hedge_fund()` (19 LLM agents + market data), then for each ticker maps the
real decision + risk-manager output into an ArrowHedge snapshot and posts it to
the substrate ingest route. The COP is read back so we can compare what the raw
agents decided against what the substrate's authority/freshness gate allows.

Requires (same as any hedge-fund run):
  - LLM provider key (OPENAI_API_KEY / ANTHROPIC_API_KEY / GROQ_API_KEY ...)
  - FINANCIAL_DATASETS_API_KEY for market data (some tickers are free)
Substrate:
  - PM_SUBSTRATE_URL (default http://127.0.0.1:4000)
  - PM_SUBSTRATE_TENANT (a tenant with the finance-research profile installed)

Usage:
  PM_SUBSTRATE_URL=http://127.0.0.1:4000 PM_SUBSTRATE_TENANT=<tenant> \
    python3 -m src.substrate.run_with_substrate --tickers AAPL,MSFT \
      --start 2026-05-01 --end 2026-06-03
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


def _risk_for_ticker(analyst_signals: dict[str, Any], ticker: str) -> dict[str, Any]:
    """Pull the risk manager's per-ticker output from analyst_signals.

    The risk agent registers under an id beginning "risk_management_agent".
    """
    for agent_id, by_ticker in analyst_signals.items():
        if agent_id.startswith("risk_management_agent") and ticker in by_ticker:
            r = by_ticker[ticker]
            return {
                "current_price": r.get("current_price", 0.0),
                "remaining_position_limit": r.get("remaining_position_limit", 0.0),
                "max_shares": int(r.get("max_shares", 0) or 0)
                or int(
                    (r.get("remaining_position_limit", 0.0) or 0.0)
                    / max(float(r.get("current_price", 1.0) or 1.0), 1.0)
                ),
                "volatility": float(
                    (r.get("reasoning", {}) or {}).get("volatility", 0.0) or 0.0
                ),
            }
    return {"current_price": 0.0, "remaining_position_limit": 0.0, "max_shares": 0, "volatility": 0.0}


def _best_signal_for_ticker(analyst_signals: dict[str, Any], ticker: str) -> dict[str, Any]:
    """Pick the highest-confidence non-risk analyst signal for the ticker."""
    best = {"agent_id": "analyst_ensemble", "signal": "hold", "confidence": 0.0}
    best_conf = -1.0
    for agent_id, by_ticker in analyst_signals.items():
        if agent_id.startswith("risk_management_agent"):
            continue
        sig = by_ticker.get(ticker) if isinstance(by_ticker, dict) else None
        if not isinstance(sig, dict):
            continue
        conf = sig.get("confidence", 0.0)
        try:
            conff = float(conf)
        except (TypeError, ValueError):
            conff = 0.0
        if conff > best_conf:
            best_conf = conff
            best = {
                "agent_id": agent_id,
                "signal": str(sig.get("signal", "hold")),
                "confidence": conff,
            }
    return best


def run(
    tickers: list[str],
    start_date: str,
    end_date: str,
    base_url: str,
    tenant_id: str,
    freshness_minutes: int,
    model_name: str,
    model_provider: str,
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
    per_ticker: list[dict[str, Any]] = []

    for idx, ticker in enumerate(tickers):
        decision = decisions.get(ticker) or {"action": "hold", "quantity": 0, "confidence": 0}
        risk = _risk_for_ticker(analyst_signals, ticker)
        signal = _best_signal_for_ticker(analyst_signals, ticker)

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
            backtest_id=f"live_{ticker.lower()}",
            research_strategy="live-ensemble",
            model_lock=f"{model_provider}:{model_name}",
            scope_start=start_date,
            scope_end=end_date,
            freshness_minutes=freshness_minutes,
        )
        resp = emitter.emit_tick(ti)
        cop = resp.get("cop", {})
        ticker_cop = (cop.get("tickers") or {}).get(ticker, {})
        per_ticker.append(
            {
                "ticker": ticker,
                "decision": ti.decision,
                "ingested_events": resp.get("ingested", {}).get("eventsPublished"),
                "cop_authorityGate": ticker_cop.get("authorityGate"),
                "cop_staleBlocks": ticker_cop.get("staleBlocks"),
            }
        )

    summary = emitter.read_cop().get("cop", {}).get("summary", {})
    return {"tickers": tickers, "summary": summary, "per_ticker": per_ticker}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers", default="AAPL")
    ap.add_argument("--start", required=True)
    ap.add_argument("--end", required=True)
    ap.add_argument("--freshness-minutes", type=int, default=10)
    ap.add_argument("--model-name", default=os.environ.get("ARROWHEDGE_MODEL", "gpt-4.1"))
    ap.add_argument("--model-provider", default=os.environ.get("ARROWHEDGE_PROVIDER", "OpenAI"))
    args = ap.parse_args()

    base_url = os.environ.get("PM_SUBSTRATE_URL", "http://127.0.0.1:4000")
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
        freshness_minutes=args.freshness_minutes,
        model_name=args.model_name,
        model_provider=args.model_provider,
    )
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
