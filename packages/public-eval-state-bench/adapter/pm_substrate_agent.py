"""STATE-Bench Agent Learning Track hook for the pm-substrate sidecar.

Place or symlink this file under the pinned STATE-Bench checkout's repo-root
``agents/`` directory. STATE-Bench owns the agent loop, domain tools,
simulator, judge, tasks, and score. This hook is intentionally read-only.
"""

from __future__ import annotations

from dataclasses import dataclass
import json
import os
from typing import Any, Callable
from urllib import request

from state_bench.agents.base import AgentRuntimeContext
from state_bench.agents.state_bench import StateBenchAgent
from state_bench.client import LLMClient, PooledLLMClient


def _required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required for an identity-bound retrieval run")
    return value


@dataclass(frozen=True, slots=True)
class _RetrievalRuntimeContext:
    """The complete runtime context the retrieval adapter is allowed to retain."""

    task_id: str
    domain: str


def _redact_runtime_context(
    runtime_context: AgentRuntimeContext | None,
) -> _RetrievalRuntimeContext | None:
    if runtime_context is None:
        return None
    task_id = runtime_context.task_id
    domain = runtime_context.domain
    if not isinstance(task_id, str) or not task_id.strip():
        raise ValueError("STATE-Bench runtime_context.task_id must be a non-empty string")
    if not isinstance(domain, str) or not domain.strip():
        raise ValueError("STATE-Bench runtime_context.domain must be a non-empty string")
    return _RetrievalRuntimeContext(task_id=task_id, domain=domain)


class PmSubstrateAgent(StateBenchAgent):
    """Expose pm-substrate learnings through STATE-Bench's official seam."""

    def __init__(
        self,
        client: LLMClient | PooledLLMClient,
        system_prompt: str,
        tools: list[dict[str, Any]],
        tool_handlers: dict[str, Callable],
        runtime_context: AgentRuntimeContext | None = None,
        retrieve_learnings_top_k: int = 3,
        agent_reasoning_effort: str | None = None,
    ) -> None:
        # STATE-Bench constructs an oracle-bearing context for every custom
        # agent. Never pass that object to upstream initialization: the
        # retrieval sidecar needs only the exact task and domain identities.
        retrieval_context = _redact_runtime_context(runtime_context)
        runtime_context = None
        super().__init__(
            client=client,
            system_prompt=system_prompt,
            tools=tools,
            tool_handlers=tool_handlers,
            runtime_context=retrieval_context,  # type: ignore[arg-type]
            retrieve_learnings_top_k=retrieve_learnings_top_k,
            agent_reasoning_effort=agent_reasoning_effort,
        )

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
