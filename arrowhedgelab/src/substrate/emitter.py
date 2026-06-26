"""Map a live hedge-fund decision tick into an ArrowHedge substrate snapshot.

The mapping function (`tick_to_snapshot`) is pure and unit-testable; the
`SubstrateEmitter` wraps it with an HTTP POST to the substrate ingest route.

ArrowHedge snapshot contract (consumed by
@pm/capability-finance-research-ingest -> buildArrowHedgeIngestionPlan):

    snapshotId, observedAt, authority,
    backtestRun, researchRun, ticker, evidence[],
    signal, risk, portfolio, decision

The hedge fund's run_hedge_fund() returns:

    {
      "decisions": {ticker: {action, quantity, confidence, reasoning}},
      "analyst_signals": {agent_id: {ticker: {signal, confidence, ...}}},
    }

The risk manager (agent id prefixed "risk_management_agent") publishes per
ticker: current_price, remaining_position_limit, max_shares, volatility.
"""

from __future__ import annotations

import hashlib
import json
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Optional


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def _sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# Confidence in the agents is 0-100 (PortfolioDecision.confidence) or 0-1
# (analyst signals). Normalize to the substrate's 0-1 contract.
def _norm_confidence(value: Any) -> float:
    try:
        v = float(value)
    except (TypeError, ValueError):
        return 0.0
    if v > 1.0:
        v = v / 100.0
    return max(0.0, min(1.0, v))


@dataclass
class TickInputs:
    """One (ticker, decision-tick) worth of live hedge-fund state."""

    ticker: str
    observed_at: datetime
    decision: dict[str, Any]  # {action, quantity, confidence, reasoning}
    risk: dict[str, Any]  # {current_price, remaining_position_limit, max_shares, volatility?}
    portfolio: dict[str, Any]  # {cash, equity, margin_requirement?, margin_used?}
    # Best analyst signal driving the decision: {agent_id, signal, confidence}
    signal: dict[str, Any]
    backtest_id: str = "live"
    research_strategy: str = "live-ensemble"
    model_lock: str = "live"
    seed: str = "live"
    scope_start: str = ""
    scope_end: str = ""
    exchange: str = "NASDAQ"
    currency: str = "USD"
    asset_class: str = "equity"
    # Freshness horizon for the risk read / evidence (minutes). Positive => the
    # risk read's window closes this many minutes AFTER observed_at (fresh).
    # Negative => the window already closed this many minutes BEFORE observed_at
    # (stale: the substrate isStale() check fires when freshnessExpiresAt <
    # observedAt). This is the experiment's stale lever.
    freshness_minutes: int = 10
    # Optional explicit evidence docs; if empty, two synthetic windows are made.
    evidence: list[dict[str, Any]] = field(default_factory=list)


def _decision_action(action: str) -> str:
    # Substrate decision.action accepts buy/sell/short/cover/hold per
    # PortfolioDecision; pass through, defaulting to hold.
    allowed = {"buy", "sell", "short", "cover", "hold"}
    a = (action or "hold").lower()
    return a if a in allowed else "hold"


def tick_to_snapshot(t: TickInputs) -> dict[str, Any]:
    """Pure mapping: live tick -> ArrowHedge snapshot dict."""
    observed = t.observed_at
    expires = observed + timedelta(minutes=t.freshness_minutes)
    tag = f"{t.ticker}_{int(observed.timestamp())}"
    scope_start = t.scope_start or observed.strftime("%Y-%m-%d")
    scope_end = t.scope_end or observed.strftime("%Y-%m-%d")

    evidence = t.evidence or [
        {
            "id": f"ev_price_{tag}",
            "sha256": _sha256_hex(f"price:{tag}"),
            "mimeType": "application/json",
            "filename": f"{t.ticker}-price-window.json",
            "sourceUri": f"arrowhedge://evidence/{t.ticker}/price",
            "retrievedAt": _iso(observed - timedelta(minutes=2)),
            "freshnessExpiresAt": _iso(expires),
        },
        {
            "id": f"ev_news_{tag}",
            "sha256": _sha256_hex(f"news:{tag}"),
            "mimeType": "text/markdown",
            "filename": f"{t.ticker}-news-window.md",
            "sourceUri": f"arrowhedge://evidence/{t.ticker}/news",
            "retrievedAt": _iso(observed - timedelta(minutes=3)),
            "freshnessExpiresAt": _iso(expires),
        },
    ]

    action = _decision_action(str(t.decision.get("action", "hold")))
    quantity = int(t.decision.get("quantity", 0) or 0)
    accepted = action != "hold" and quantity > 0

    return {
        "snapshotId": f"snap_{tag}",
        "observedAt": _iso(observed),
        "authority": f"arrowhedge:backtest:{t.backtest_id}",
        "backtestRun": {
            "id": t.backtest_id,
            "title": f"{t.ticker} live run",
            "scopeStart": scope_start,
            "scopeEnd": scope_end,
            "state": "completed",
            "datasetRef": f"arrowhedge://backtests/{t.backtest_id}.csv",
            "seed": t.seed,
        },
        "researchRun": {
            "id": f"rr_{tag}",
            "title": f"{t.ticker} live research",
            "scopeStart": scope_start,
            "scopeEnd": scope_end,
            "state": "deciding",
            "strategy": t.research_strategy,
            "modelLock": t.model_lock,
            "seed": t.seed,
        },
        "ticker": {
            "symbol": t.ticker,
            "assetClass": t.asset_class,
            "exchange": t.exchange,
            "currency": t.currency,
        },
        "evidence": evidence,
        "signal": {
            "id": f"sig_{tag}",
            "agentId": str(t.signal.get("agent_id", "analyst_ensemble")),
            "signal": str(t.signal.get("signal", "hold")).lower(),
            "confidence": _norm_confidence(t.signal.get("confidence")),
            "evidenceWindowStart": _iso(observed - timedelta(minutes=30)),
            "evidenceWindowEnd": _iso(observed - timedelta(minutes=1)),
        },
        "risk": {
            "id": f"risk_{tag}",
            "currentPrice": float(t.risk.get("current_price", 0.0) or 0.0),
            "remainingPositionLimit": float(
                t.risk.get("remaining_position_limit", 0.0) or 0.0
            ),
            "maxShares": int(t.risk.get("max_shares", 0) or 0),
            "volatility": float(t.risk.get("volatility", 0.0) or 0.0),
            "bindingConstraint": str(
                t.risk.get("binding_constraint", "position_limit")
            ),
            "freshnessExpiresAt": _iso(expires),
        },
        "portfolio": {
            "id": f"portfolio_{tag}",
            "cash": float(t.portfolio.get("cash", 0.0) or 0.0),
            "equity": float(t.portfolio.get("equity", 0.0) or 0.0),
            "marginRequirement": float(
                t.portfolio.get("margin_requirement", 0.25) or 0.25
            ),
            "marginUsed": float(t.portfolio.get("margin_used", 0.0) or 0.0),
        },
        "decision": {
            "id": f"dec_{tag}",
            "action": action,
            "quantity": quantity,
            "confidence": _norm_confidence(t.decision.get("confidence")),
            "reasoning": str(t.decision.get("reasoning", ""))[:2000],
            "accepted": accepted,
            "riskSourceSnapshotId": f"snap_{tag}",
            "signalSourceSnapshotId": f"snap_{tag}",
        },
    }


@dataclass
class SubstrateEmitter:
    """POSTs ArrowHedge snapshots to the substrate ingest route.

    base_url: e.g. http://127.0.0.1:8787
    tenant_id: substrate tenant with the finance-research profile installed.
    """

    base_url: str
    tenant_id: str
    timeout_seconds: float = 15.0

    def _url(self, path: str) -> str:
        return f"{self.base_url.rstrip('/')}/tenants/{self.tenant_id}{path}"

    def emit(self, snapshot: dict[str, Any]) -> dict[str, Any]:
        """POST one snapshot; return the parsed COP/ingest response."""
        data = json.dumps(snapshot).encode("utf-8")
        req = urllib.request.Request(
            self._url("/arrowhedge/snapshots"),
            data=data,
            headers={"content-type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout_seconds) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"substrate ingest {e.code}: {body}") from e

    def emit_tick(self, t: TickInputs) -> dict[str, Any]:
        return self.emit(tick_to_snapshot(t))

    def read_cop(self) -> dict[str, Any]:
        req = urllib.request.Request(self._url("/arrowhedge/cop"), method="GET")
        with urllib.request.urlopen(req, timeout=self.timeout_seconds) as resp:
            return json.loads(resp.read().decode("utf-8"))
