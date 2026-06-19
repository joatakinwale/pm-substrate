"""Unit tests for the live tick -> ArrowHedge snapshot mapping.

Pure mapping only; no network. Mirrors the snapshot contract asserted by the
substrate finance integration test.
"""

import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.substrate.emitter import TickInputs, tick_to_snapshot  # noqa: E402


def _base_tick(freshness_minutes: int = 10) -> TickInputs:
    return TickInputs(
        ticker="AAPL",
        observed_at=datetime(2026, 6, 3, 14, 0, 0, tzinfo=timezone.utc),
        decision={
            "action": "buy",
            "quantity": 120,
            "confidence": 76,  # 0-100 scale
            "reasoning": "Breakout signal passed risk gate.",
        },
        risk={
            "current_price": 189.25,
            "remaining_position_limit": 50000,
            "max_shares": 120,
            "volatility": 0.21,
        },
        portfolio={
            "cash": 250000,
            "equity": 1000000,
            "margin_requirement": 0.25,
            "margin_used": 0.11,
        },
        signal={"agent_id": "analyst_momentum", "signal": "buy", "confidence": 0.82},
        backtest_id="bt_aapl_breakout",
        freshness_minutes=freshness_minutes,
    )


def test_maps_required_top_level_fields():
    snap = tick_to_snapshot(_base_tick())
    for key in (
        "snapshotId",
        "observedAt",
        "authority",
        "backtestRun",
        "researchRun",
        "ticker",
        "evidence",
        "signal",
        "risk",
        "portfolio",
        "decision",
    ):
        assert key in snap, f"missing {key}"


def test_confidence_normalized_to_unit_interval():
    snap = tick_to_snapshot(_base_tick())
    # 76 (0-100) -> 0.76; signal 0.82 stays 0.82
    assert abs(snap["decision"]["confidence"] - 0.76) < 1e-9
    assert abs(snap["signal"]["confidence"] - 0.82) < 1e-9


def test_authority_and_ids_are_tick_scoped():
    snap = tick_to_snapshot(_base_tick())
    assert snap["authority"] == "arrowhedge:backtest:bt_aapl_breakout"
    # snapshot id, decision id, risk id all share the tick tag
    tag = snap["snapshotId"].removeprefix("snap_")
    assert snap["decision"]["id"] == f"dec_{tag}"
    assert snap["risk"]["id"] == f"risk_{tag}"
    assert snap["decision"]["riskSourceSnapshotId"] == snap["snapshotId"]


def test_clean_tick_freshness_window_is_after_observed():
    snap = tick_to_snapshot(_base_tick(freshness_minutes=10))
    assert snap["observedAt"] == "2026-06-03T14:00:00.000Z"
    assert snap["risk"]["freshnessExpiresAt"] == "2026-06-03T14:10:00.000Z"


def test_stale_tick_shrinks_freshness_window():
    # A 0-minute freshness horizon makes the risk read expire at observed time,
    # so any later action proposal is stale. This is the experiment lever.
    snap = tick_to_snapshot(_base_tick(freshness_minutes=0))
    assert snap["risk"]["freshnessExpiresAt"] == snap["observedAt"]


def test_decision_accepted_only_when_actionable():
    t = _base_tick()
    t.decision = {"action": "hold", "quantity": 0, "confidence": 50, "reasoning": "x"}
    snap = tick_to_snapshot(t)
    assert snap["decision"]["accepted"] is False
    assert snap["decision"]["action"] == "hold"


def test_evidence_documents_have_required_fields():
    snap = tick_to_snapshot(_base_tick())
    assert len(snap["evidence"]) == 2
    for ev in snap["evidence"]:
        for key in ("id", "sha256", "mimeType", "filename", "freshnessExpiresAt"):
            assert key in ev
        assert len(ev["sha256"]) == 64


if __name__ == "__main__":
    # Allow running without pytest installed.
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
