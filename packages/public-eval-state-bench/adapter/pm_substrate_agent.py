"""STATE-Bench Agent Learning Track hook for the pm-substrate sidecar.

Place or symlink this file under the pinned STATE-Bench checkout's repo-root
``agents/`` directory. STATE-Bench owns the agent loop, domain tools,
simulator, judge, tasks, and score. This hook is intentionally read-only.
"""

from __future__ import annotations

import json
import os
from urllib import request

from state_bench.agents.state_bench import StateBenchAgent


def _required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required for an identity-bound retrieval run")
    return value


class PmSubstrateAgent(StateBenchAgent):
    """Expose pm-substrate learnings through STATE-Bench's official seam."""

    def retrieve_learnings(self, query: str, top_k: int = 3) -> list[str]:
        if top_k != 3:
            raise ValueError("official pm-substrate runs require top_k=3")
        context = self.runtime_context
        if context is None or not context.task_id or not context.domain:
            raise RuntimeError("STATE-Bench runtime_context with task and domain is required")
        endpoint = os.environ.get(
            "PM_STATE_BENCH_RETRIEVAL_URL",
            "http://127.0.0.1:4319/retrieve",
        )
        payload = json.dumps(
            {
                "query": query,
                "top_k": top_k,
                "identity": {
                    "experimentId": _required_env("PM_STATE_BENCH_EXPERIMENT_ID"),
                    "configSha256": _required_env("PM_STATE_BENCH_CONFIG_SHA256"),
                    "runId": _required_env("PM_STATE_BENCH_RUN_ID"),
                    "taskId": context.task_id,
                    "domain": context.domain,
                    "modelId": _required_env("PM_STATE_BENCH_MODEL_ID"),
                },
            }
        ).encode("utf-8")
        http_request = request.Request(
            endpoint,
            data=payload,
            headers={"content-type": "application/json"},
            method="POST",
        )
        with request.urlopen(http_request, timeout=10) as response:
            body = json.loads(response.read().decode("utf-8"))
        learnings = body.get("learnings")
        if not isinstance(learnings, list) or not all(
            isinstance(item, str) for item in learnings
        ):
            raise TypeError("pm-substrate retrieval must return list[str]")
        return learnings
