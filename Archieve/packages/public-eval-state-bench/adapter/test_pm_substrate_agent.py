from __future__ import annotations

import inspect

import pytest

from pm_substrate_agent import PmSubstrateAgent
from state_bench.agents.base import AgentRuntimeContext
from state_bench.client import LLMClient


def _agent(runtime_context: AgentRuntimeContext) -> PmSubstrateAgent:
    return PmSubstrateAgent(
        client=object.__new__(LLMClient),
        system_prompt="system",
        tools=[],
        tool_handlers={},
        runtime_context=runtime_context,
    )


def test_custom_agent_retains_only_task_and_domain_from_runtime_context() -> None:
    original = AgentRuntimeContext(
        task_id="task-001",
        user_id="secret-user",
        domain="travel",
        now="2026-07-13T00:00:00Z",
        output_dir="/secret/output",
        run_idx=5,
        task_summary="oracle task summary",
        state_requirements=[{"oracle": "state"}],
        task_requirements=[{"oracle": "task"}],
        config={"secret": "configuration"},
    )

    agent = _agent(original)
    retained = agent.runtime_context

    assert retained is not original
    assert retained is not None
    assert retained.task_id == "task-001"
    assert retained.domain == "travel"
    assert set(retained.__slots__) == {"task_id", "domain"}
    for forbidden in (
        "user_id",
        "now",
        "output_dir",
        "run_idx",
        "task_summary",
        "state_requirements",
        "task_requirements",
        "config",
        "__dict__",
    ):
        with pytest.raises(AttributeError):
            getattr(retained, forbidden)

    # Redaction must not mutate the runner's context; the mitigation is a
    # one-way boundary inside the adapter, not benchmark state corruption.
    assert original.task_summary == "oracle task summary"
    assert original.state_requirements == [{"oracle": "state"}]
    assert original.task_requirements == [{"oracle": "task"}]


def test_custom_agent_keeps_the_pinned_upstream_constructor_interface() -> None:
    signature = inspect.signature(PmSubstrateAgent)

    assert tuple(signature.parameters) == tuple(inspect.signature(PmSubstrateAgent.__mro__[1]).parameters)
    agent = _agent(
        AgentRuntimeContext(
            task_id="task-002",
            user_id="user",
            domain="shopping",
            now="2026-07-13T00:00:00Z",
        )
    )
    assert callable(agent.tool_handlers["retrieve_learnings"])
    assert any(tool.get("name") == "retrieve_learnings" for tool in agent.tools)
