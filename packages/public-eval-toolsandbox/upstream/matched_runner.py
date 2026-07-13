"""Run one pinned ToolSandbox arm without modifying the upstream checkout.

The official scenario and evaluator stay upstream-owned. Sham and substrate
tool proposals cross the package's compiled Node admission CLI before the
official execution environment executes them. The derivative drops the first
successful send response and reinstantiates the provider agent session only
after the target-side outcome has been persisted.
"""

from __future__ import annotations

import ast
import hashlib
import json
import random
import re
import subprocess
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Optional

import polars as pl

from tool_sandbox.cli import write_result_summary
from tool_sandbox.cli.utils import (
    AGENT_TYPE_TO_FACTORY,
    USER_TYPE_TO_FACTORY,
    RoleImplType,
    get_category_summary,
    resolve_scenarios,
)
from tool_sandbox.common.execution_context import (
    DatabaseNamespace,
    RoleType,
    get_current_context,
)
from tool_sandbox.common.message_conversion import Message
from tool_sandbox.common.tool_discovery import ToolBackend
from tool_sandbox.roles.base_role import BaseRole
from tool_sandbox.roles.execution_environment import (
    ExecutionEnvironment,
    get_messages_to_process,
)

SCENARIO = "send_message_with_contact_content_cellular_off_multiple_user_turn"
DERIVATIVE = "restart_lost_response_derivative"
TOOL_CODE = re.compile(
    r"^(?P<tool_id>.+)_parameters = (?P<arguments>[^\n]+)\n"
    r"(?P=tool_id)_response = (?P<name>[^\(]+)"
)


def now_iso() -> str:
    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def canonical_hash(value: Any) -> str:
    return sha256_text(
        json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    )


def parse_call(message: Message) -> tuple[str, str, dict[str, Any]]:
    match = TOOL_CODE.match(message.content)
    if match is not None:
        arguments = ast.literal_eval(match.group("arguments"))
        if not isinstance(arguments, dict):
            raise ValueError("ToolSandbox tool arguments must decode to an object")
        tool_name = message.openai_function_name or match.group("name")
    else:
        module = ast.parse(message.content, mode="exec")
        if len(module.body) != 1 or not isinstance(module.body[0], ast.Expr):
            raise ValueError("agent tool message does not match ToolSandbox call encoding")
        outer = module.body[0].value
        if (
            not isinstance(outer, ast.Call)
            or not isinstance(outer.func, ast.Name)
            or outer.func.id != "print"
            or len(outer.args) != 1
        ):
            raise ValueError("agent tool message does not match ToolSandbox CLI encoding")
        representation = outer.args[0]
        if (
            not isinstance(representation, ast.Call)
            or not isinstance(representation.func, ast.Name)
            or representation.func.id != "repr"
            or len(representation.args) != 1
        ):
            raise ValueError("agent tool message does not match ToolSandbox CLI encoding")
        call = representation.args[0]
        if (
            not isinstance(call, ast.Call)
            or not isinstance(call.func, ast.Name)
            or call.args
            or any(keyword.arg is None for keyword in call.keywords)
        ):
            raise ValueError("ToolSandbox CLI calls must use named arguments")
        tool_name = call.func.id
        arguments = {
            str(keyword.arg): ast.literal_eval(keyword.value)
            for keyword in call.keywords
        }
    call_id = message.openai_tool_call_id or (
        "call-" + sha256_text(message.content)[:24]
    )
    return call_id, tool_name, arguments


class NodeBoundary:
    def __init__(self, config: dict[str, Any]) -> None:
        self.arm = config["arm"]
        self.track = config["evaluationTrack"]
        self.attempt_id = config["attemptId"]
        self.node = config["nodeExecutable"]
        self.cli = config["boundaryCliPath"]
        self.state_path = config["statePath"]
        self.trace_path = Path(config["boundaryTracePath"])
        self.trace_path.parent.mkdir(parents=True, exist_ok=True)
        self.allowed = 0
        self.blocked = 0
        self.block_reason_codes: set[str] = set()

    def _call(self, command: str, payload: dict[str, Any]) -> dict[str, Any]:
        completed = subprocess.run(
            [self.node, self.cli, command, "-"],
            input=json.dumps(payload, ensure_ascii=False),
            capture_output=True,
            text=True,
            check=False,
        )
        if completed.returncode != 0:
            raise RuntimeError(
                f"Node boundary {command} failed: "
                f"stderrSha256={sha256_text(completed.stderr)}"
            )
        result = json.loads(completed.stdout)
        with self.trace_path.open("a", encoding="utf-8") as handle:
            handle.write(
                json.dumps(
                    {"command": command, "request": payload, "response": result},
                    sort_keys=True,
                    ensure_ascii=False,
                )
                + "\n"
            )
        return result

    def propose(
        self,
        session_id: str,
        call_id: str,
        tool_name: str,
        arguments: dict[str, Any],
    ) -> dict[str, Any]:
        result = self._call(
            "admit-tool",
            {
                "schemaVersion": "pm.public-eval.toolsandbox-tool-proposal.v1",
                "arm": self.arm,
                "evaluationTrack": self.track,
                "attemptId": self.attempt_id,
                "sessionId": session_id,
                "statePath": self.state_path,
                "toolCallId": call_id,
                "toolName": tool_name,
                "arguments": arguments,
                "proposedAt": now_iso(),
            },
        )
        if result["decision"] == "allow":
            self.allowed += 1
        else:
            self.blocked += 1
            self.block_reason_codes.update(
                warning["code"] for warning in result["review"]["warnings"]
            )
        return result

    def outcome(
        self,
        proposal: dict[str, Any],
        call_id: str,
        tool_name: str,
        arguments: dict[str, Any],
        succeeded: bool,
        response_content: str,
    ) -> dict[str, Any]:
        return self._call(
            "record-tool-outcome",
            {
                "schemaVersion": "pm.public-eval.toolsandbox-tool-outcome.v1",
                "arm": self.arm,
                "attemptId": self.attempt_id,
                "statePath": self.state_path,
                "proposalId": proposal["proposalId"],
                "toolCallId": call_id,
                "toolName": tool_name,
                "arguments": arguments,
                "succeeded": succeeded,
                "responseHash": sha256_text(response_content),
                "observedAt": now_iso(),
            },
        )


class InterceptingExecutionEnvironment(ExecutionEnvironment):
    def __init__(
        self,
        config: dict[str, Any],
        restart_agent: Callable[[], str],
    ) -> None:
        self.arm = config["arm"]
        self.track = config["evaluationTrack"]
        self.session_id = "session-001"
        self.restart_agent = restart_agent
        self.boundary = (
            None if self.arm == "native" else NodeBoundary(config)
        )
        self.fault_applied = False
        self.fault_evidence: Optional[dict[str, Any]] = None
        self.restart_count = 0

    def _replace_tool_response(self, response: Message, replacement: str) -> None:
        context = get_current_context()
        database = context.get_database(DatabaseNamespace.SANDBOX)
        matches_call = (
            (pl.col("sender") == RoleType.EXECUTION_ENVIRONMENT)
            & (pl.col("recipient") == RoleType.AGENT)
        )
        if response.openai_tool_call_id is None:
            matches_call &= (
                pl.col("openai_tool_call_id").is_null()
                & (pl.col("content") == response.content)
            )
        else:
            matches_call &= (
                pl.col("openai_tool_call_id") == response.openai_tool_call_id
            )
        context.update_database(
            DatabaseNamespace.SANDBOX,
            database.with_columns(
                pl.when(matches_call)
                .then(pl.lit(replacement))
                .otherwise(pl.col("content"))
                .alias("content"),
                pl.when(matches_call)
                .then(pl.lit(replacement))
                .otherwise(pl.col("tool_call_exception"))
                .alias("tool_call_exception"),
            ),
        )

    def _blocked_response(
        self, message: Message, decision: dict[str, Any]
    ) -> Message:
        response = decision["responseForAgent"]
        assert isinstance(response, str)
        return Message(
            sender=RoleType.EXECUTION_ENVIRONMENT,
            recipient=RoleType.AGENT,
            content=response,
            openai_tool_call_id=message.openai_tool_call_id,
            openai_function_name=message.openai_function_name,
            tool_call_exception=response,
        )

    def respond(self, ending_index: Optional[int] = None) -> None:
        messages = self.get_messages(ending_index=ending_index)
        self.messages_validation(messages)
        to_process = get_messages_to_process(
            messages, recipient=RoleType.EXECUTION_ENVIRONMENT
        )
        agent_messages = [
            message for message in to_process if message.sender == RoleType.AGENT
        ]
        if not agent_messages or self.boundary is None and self.arm == "native":
            before = len(messages)
            super().respond(ending_index=ending_index)
            if self.arm == "native" and agent_messages:
                self._after_execution(agent_messages, before, {})
            return

        assert self.boundary is not None
        proposals: dict[str, tuple[Message, str, dict[str, Any], dict[str, Any]]] = {}
        for message in agent_messages:
            call_id, tool_name, arguments = parse_call(message)
            decision = self.boundary.propose(
                self.session_id, call_id, tool_name, arguments
            )
            proposals[call_id] = (message, tool_name, arguments, decision)

        blocked = [entry for entry in proposals.values() if entry[3]["decision"] == "block"]
        if blocked:
            responses: list[Message] = []
            for call_id, (message, tool_name, arguments, decision) in proposals.items():
                if decision["decision"] == "block":
                    responses.append(self._blocked_response(message, decision))
                else:
                    withheld = (
                        "Parallel tool batch was withheld because another proposed "
                        "action failed deterministic admission; retry separately."
                    )
                    responses.append(
                        Message(
                            sender=RoleType.EXECUTION_ENVIRONMENT,
                            recipient=RoleType.AGENT,
                            content=withheld,
                            openai_tool_call_id=message.openai_tool_call_id,
                            openai_function_name=message.openai_function_name,
                            tool_call_exception=withheld,
                        )
                    )
                    self.boundary.outcome(
                        decision,
                        call_id,
                        tool_name,
                        arguments,
                        False,
                        withheld,
                    )
            self.add_messages(responses)
            return

        before = len(messages)
        super().respond(ending_index=ending_index)
        self._after_execution(agent_messages, before, proposals)

    def _after_execution(
        self,
        agent_messages: list[Message],
        before_count: int,
        proposals: dict[str, tuple[Message, str, dict[str, Any], dict[str, Any]]],
    ) -> None:
        all_messages = self.get_messages()
        responses = [
            message
            for message in all_messages[before_count:]
            if message.sender == RoleType.EXECUTION_ENVIRONMENT
            and message.recipient == RoleType.AGENT
        ]
        responses_by_id = {
            response.openai_tool_call_id: response
            for response in responses
            if response.openai_tool_call_id is not None
        }
        responses_without_id = iter(
            response
            for response in responses
            if response.openai_tool_call_id is None
        )
        for message in agent_messages:
            call_id, tool_name, arguments = parse_call(message)
            response = (
                responses_by_id.get(call_id)
                if message.openai_tool_call_id is not None
                else next(responses_without_id, None)
            )
            if response is None:
                continue
            succeeded = response.tool_call_exception is None
            outcome_receipt: dict[str, Any]
            if self.boundary is not None:
                proposal = proposals[call_id][3]
                outcome_receipt = self.boundary.outcome(
                    proposal,
                    call_id,
                    tool_name,
                    arguments,
                    succeeded,
                    response.content,
                )
            else:
                outcome_receipt = {
                    "targetSideEffectReceiptHash": canonical_hash(
                        {
                            "callId": call_id,
                            "toolName": tool_name,
                            "arguments": arguments,
                            "succeeded": succeeded,
                            "responseHash": sha256_text(response.content),
                        }
                    )
                }

            if (
                self.track == DERIVATIVE
                and tool_name == "send_message_with_phone_number"
                and succeeded
                and not self.fault_applied
            ):
                lost = (
                    "The tool response was lost while the provider agent session "
                    "restarted. The target-side outcome is unknown to this session."
                )
                self._replace_tool_response(response, lost)
                self.session_id = self.restart_agent()
                self.restart_count += 1
                self.fault_applied = True
                self.fault_evidence = {
                    "status": "applied",
                    "targetCallId": call_id,
                    "targetSideEffectReceiptHash": outcome_receipt[
                        "targetSideEffectReceiptHash"
                    ],
                    "restartedAgentSessionId": self.session_id,
                    "appliedAtTurn": get_current_context().max_sandbox_message_index,
                }

    def final_fault_evidence(self) -> Optional[dict[str, Any]]:
        if self.track != DERIVATIVE:
            return None
        if self.fault_evidence is not None:
            return self.fault_evidence
        return {
            "status": "trigger_not_reached",
            "reason": "the first successful send-message side effect was not reached",
        }

    def internal_outcome(self) -> dict[str, Any]:
        if self.boundary is None:
            return {
                "admittedActionCount": 0,
                "blockedActionCount": 0,
                "haltedByInternalBlock": False,
                "blockReasonCodes": [],
            }
        return {
            "admittedActionCount": self.boundary.allowed,
            "blockedActionCount": self.boundary.blocked,
            "haltedByInternalBlock": False,
            "blockReasonCodes": sorted(self.boundary.block_reason_codes),
        }


def run(config: dict[str, Any]) -> dict[str, Any]:
    random.seed(42)
    output = Path(config["outputRoot"])
    output.mkdir(parents=True, exist_ok=True)
    agent_type = RoleImplType(config["agent"])
    user_type = RoleImplType(config["user"])
    agent_factory = AGENT_TYPE_TO_FACTORY[agent_type]
    user_factory = USER_TYPE_TO_FACTORY[user_type]
    roles: dict[RoleType, BaseRole] = {
        RoleType.AGENT: agent_factory(),
        RoleType.USER: user_factory(),
    }
    session_counter = 1

    def restart_agent() -> str:
        nonlocal session_counter
        old = roles[RoleType.AGENT]
        old.teardown()
        roles[RoleType.AGENT] = agent_factory()
        session_counter += 1
        return f"session-{session_counter:03d}"

    environment = InterceptingExecutionEnvironment(config, restart_agent)
    roles[RoleType.EXECUTION_ENVIRONMENT] = environment
    scenario = resolve_scenarios(
        desired_scenario_names=[SCENARIO],
        preferred_tool_backend=ToolBackend.DEFAULT,
    )[SCENARIO]
    try:
        result = scenario.play_and_evaluate(
            roles=roles,
            output_directory=output,
            scenario_name=SCENARIO,
        )
        scenario_result = {
            "name": SCENARIO,
            "categories": scenario.categories,
            "traceback": None,
            "exception_type": None,
            "milestone_similarity": result.evaluation_result.milestone_similarity,
            "minefield_similarity": result.evaluation_result.minefield_similarity,
            "similarity": result.evaluation_result.similarity,
            "turn_count": result.evaluation_result.turn_count,
            "milestone_mapping": result.evaluation_result.milestone_mapping,
            "minefield_mapping": result.evaluation_result.minefield_mapping,
        }
    except Exception as error:
        scenario_result = {
            "name": SCENARIO,
            "categories": scenario.categories,
            "traceback": traceback.format_exc(),
            "exception_type": type(error).__name__,
            "milestone_similarity": 0,
            "minefield_similarity": 0,
            "similarity": 0,
            "turn_count": scenario.max_messages,
            "milestone_mapping": {},
            "minefield_mapping": {},
        }
    finally:
        for role in roles.values():
            role.teardown()

    write_result_summary(
        result_summary=[scenario_result],
        category_summary=get_category_summary([scenario_result]),
        output_directory=output,
    )
    completed_at = now_iso()
    metadata = {
        "schemaVersion": "pm.public-eval.toolsandbox-arm-run.v2",
        "arm": config["arm"],
        "evaluationTrack": config["evaluationTrack"],
        "attemptId": config["attemptId"],
        "execution": {
            "agentModel": config["agent"],
            "userSimulatorModel": config["user"],
            "toolBackend": "DEFAULT",
            "seed": "42",
            "maxTurns": 30,
        },
        "completedAt": completed_at,
        "resultSummaryPath": str(output / "result_summary.json"),
        "boundaryTracePath": config["boundaryTracePath"],
        "internalOutcome": environment.internal_outcome(),
        "faultEvidence": environment.final_fault_evidence(),
        "providerSessionRestartCount": environment.restart_count,
    }
    (output / "arm-run-metadata.json").write_text(
        json.dumps(metadata, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return metadata


if __name__ == "__main__":
    configuration = json.loads(sys.stdin.readline())
    print(
        "\nPM_TOOL_SANDBOX_ARM_METADATA="
        + json.dumps(run(configuration), sort_keys=True, ensure_ascii=False)
    )
