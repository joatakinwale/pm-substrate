"""Live ArrowHedgeLab -> pm-substrate bridge.

Maps a live hedge-fund decision tick (the output of run_hedge_fund) into the
ArrowHedge snapshot contract the substrate finance adapter consumes, and POSTs
it to the substrate HTTP ingest route. See
research/arrowhedge-live-substrate-bridge_2026-06-18.md.
"""

from .emitter import (
    SubstrateEmitter,
    TickInputs,
    tick_to_snapshot,
)

__all__ = ["SubstrateEmitter", "TickInputs", "tick_to_snapshot"]
