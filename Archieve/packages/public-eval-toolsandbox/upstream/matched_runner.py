"""Run one pinned ToolSandbox arm without modifying the upstream checkout.

The official scenario and evaluator stay upstream-owned. Sham and substrate
tool proposals cross a startup-bound authenticated HTTP sidecar before the
official execution environment executes them. Every provider role runs in a
separate supervised OS process. The derivative drops the first successful send
response and kills/reaps that provider process only after the target-side
outcome and lost-response context have been persisted.
"""

from __future__ import annotations

import ast
import base64
import hashlib
import json
import os
import random
import re
import sys
import traceback
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Optional

import polars as pl

from tool_sandbox.cli import write_result_summary
from tool_sandbox.cli.utils import (
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

from provider_process import ProviderProcessRole, SCRIPTED_AGENT

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


def idempotency_key(domain: str, *components: str) -> str:
    """Return a bounded, domain-separated key regardless of public IDs' length."""
    digest = canonical_hash(
        {
            "domain": f"pm.public-eval.toolsandbox-http-idempotency.{domain}.v1",
            "components": list(components),
        }
    )
    return f"pm-ts-{domain}-{digest}"


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


class HttpBoundary:
    def __init__(self, config: dict[str, Any]) -> None:
        self.arm = config["arm"]
        self.track = config["evaluationTrack"]
        self.attempt_id = config["attemptId"]
        self.origin = config["boundaryOrigin"]
        if re.fullmatch(r"http://127\.0\.0\.1:[1-9][0-9]{0,4}", self.origin) is None:
            raise ValueError("boundaryOrigin must be an explicit IPv4 loopback origin")
        self.bearer_token = config["boundaryBearerToken"]
        if not isinstance(self.bearer_token, str) or len(self.bearer_token) < 32:
            raise ValueError("boundaryBearerToken is invalid")
        self.timeout_seconds = float(config.get("boundaryHttpTimeoutSeconds", 30.0))
        self.state_path = config["statePath"]
        self.trace_path = Path(config["boundaryTracePath"])
        self.trace_path.parent.mkdir(parents=True, exist_ok=True)
        self.allowed = 0
        self.blocked = 0
        self.block_reason_codes: set[str] = set()
        self.trace_sequence = 0
        self.trace_head_hash = "0" * 64

    def _call(
        self,
        command: str,
        payload: dict[str, Any],
        operation_key: str,
    ) -> dict[str, Any]:
        endpoint = {
            "admit-tool": "/v1/admit-tool",
            "record-tool-outcome": "/v1/record-tool-outcome",
        }[command]
        request_bytes = json.dumps(
            payload,
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
            allow_nan=False,
        ).encode("utf-8")
        request = urllib.request.Request(
            self.origin + endpoint,
            data=request_bytes,
            method="POST",
            headers={
                "Authorization": f"Bearer {self.bearer_token}",
                "Content-Type": "application/json",
                "Idempotency-Key": operation_key,
            },
        )
        try:
            with urllib.request.urlopen(
                request,
                timeout=self.timeout_seconds,
            ) as response:
                status = response.status
                response_bytes = response.read()
                content_type = response.headers.get("Content-Type")
                request_id = response.headers.get("X-PM-Request-ID")
        except urllib.error.HTTPError as error:
            response_bytes = error.read()
            raise RuntimeError(
                f"HTTP boundary {command} failed: status={error.code}; "
                f"responseSha256={hashlib.sha256(response_bytes).hexdigest()}"
            ) from error
        except urllib.error.URLError as error:
            raise RuntimeError(f"HTTP boundary {command} transport failed") from error
        if status != 200 or content_type != "application/json" or not request_id:
            raise RuntimeError(
                f"HTTP boundary {command} returned invalid protocol metadata"
            )
        try:
            result = json.loads(response_bytes.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise RuntimeError(
                f"HTTP boundary {command} returned invalid JSON bytes"
            ) from error
        if not isinstance(result, dict):
            raise RuntimeError(f"HTTP boundary {command} result must be an object")
        self.trace_sequence += 1
        body = {
            "schemaVersion": "pm.public-eval.toolsandbox-boundary-http-client.v1",
            "sequence": self.trace_sequence,
            "previousEntryHash": self.trace_head_hash,
            "command": command,
            "request": payload,
            "response": result,
            "http": {
                "endpointPath": endpoint,
                "operationKeySha256": sha256_text(operation_key),
                "request": {
                    "bodyByteLength": len(request_bytes),
                    "bodyBytesBase64": base64.b64encode(request_bytes).decode("ascii"),
                    "bodySha256": hashlib.sha256(request_bytes).hexdigest(),
                },
                "response": {
                    "status": status,
                    "contentType": content_type,
                    "requestId": request_id,
                    "bodyByteLength": len(response_bytes),
                    "bodyBytesBase64": base64.b64encode(response_bytes).decode("ascii"),
                    "bodySha256": hashlib.sha256(response_bytes).hexdigest(),
                },
            },
        }
        entry_hash = canonical_hash(body)
        with self.trace_path.open("a", encoding="utf-8") as handle:
            handle.write(
                json.dumps(
                    {**body, "entryHash": entry_hash},
                    sort_keys=True,
                    ensure_ascii=False,
                )
                + "\n"
            )
            handle.flush()
            os.fsync(handle.fileno())
        self.trace_head_hash = entry_hash
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
            idempotency_key("admit", self.attempt_id, session_id, call_id),
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
                "evaluationTrack": self.track,
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
            idempotency_key(
                "outcome",
                self.attempt_id,
                proposal["proposalId"],
                call_id,
            ),
        )


class InterceptingExecutionEnvironment(ExecutionEnvironment):
    def __init__(
        self,
        config: dict[str, Any],
        restart_agent: Callable[[dict[str, Any]], str],
    ) -> None:
        self.arm = config["arm"]
        self.track = config["evaluationTrack"]
        self.session_id = "session-001"
        self.restart_agent = restart_agent
        self.boundary = (
            None if self.arm == "native" else HttpBoundary(config)
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
                applied_at_turn = get_current_context().max_sandbox_message_index
                self.session_id = self.restart_agent(
                    {
                        "targetCallId": call_id,
                        "targetSideEffectReceiptHash": outcome_receipt[
                            "targetSideEffectReceiptHash"
                        ],
                        "lostResponseHash": sha256_text(lost),
                        "contextHashAfterLostResponse": canonical_hash(
                            get_current_context().to_dict(serialize_console=False)
                        ),
                        "appliedAtTurn": applied_at_turn,
                    }
                )
                self.restart_count += 1
                self.fault_applied = True
                self.fault_evidence = {
                    "status": "applied",
                    "targetCallId": call_id,
                    "targetSideEffectReceiptHash": outcome_receipt[
                        "targetSideEffectReceiptHash"
                    ],
                    "restartedAgentSessionId": self.session_id,
                    "appliedAtTurn": applied_at_turn,
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
    configured_agent = config["agent"]
    agent_type = (
        configured_agent
        if configured_agent == SCRIPTED_AGENT
        else str(RoleImplType(configured_agent))
    )
    user_type = RoleImplType(config["user"])
    user_factory = USER_TYPE_TO_FACTORY[user_type]
    provider_process = ProviderProcessRole(
        python_executable=sys.executable,
        agent=agent_type,
        attempt_id=config["attemptId"],
        arm=config["arm"],
        evaluation_track=config["evaluationTrack"],
        trace_path=output / "provider-process.jsonl",
        runner_path=Path(__file__),
        response_timeout_seconds=float(
            config.get("providerProcessResponseTimeoutSeconds", 900.0)
        ),
    )
    roles: dict[RoleType, BaseRole] = {
        RoleType.AGENT: provider_process,
        RoleType.USER: user_factory(),
    }

    def restart_agent(trigger: dict[str, Any]) -> str:
        return provider_process.restart_after_sigkill(trigger)

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
        # ToolSandbox deliberately retains the partial execution context in the
        # play_and_evaluate finally block. Never invent score-zero evidence for
        # that context: replay the pinned evaluator so result_summary.json and
        # the retained trajectory remain mutually checkable.
        partial_evaluation = scenario.evaluation.evaluate(
            execution_context=get_current_context(),
            max_turn_count=scenario.max_messages,
        )
        scenario_result = {
            "name": SCENARIO,
            "categories": scenario.categories,
            "traceback": traceback.format_exc(),
            "exception_type": type(error).__name__,
            "milestone_similarity": partial_evaluation.milestone_similarity,
            "minefield_similarity": partial_evaluation.minefield_similarity,
            "similarity": partial_evaluation.similarity,
            "turn_count": partial_evaluation.turn_count,
            "milestone_mapping": partial_evaluation.milestone_mapping,
            "minefield_mapping": partial_evaluation.minefield_mapping,
        }
    finally:
        for role in roles.values():
            role.teardown()

    provider_process_summary = provider_process.trace_summary()
    if provider_process_summary["restartCount"] != environment.restart_count:
        raise RuntimeError(
            "provider process trace restart count does not match fault runner telemetry"
        )

    write_result_summary(
        result_summary=[scenario_result],
        category_summary=get_category_summary([scenario_result]),
        output_directory=output,
    )
    completed_at = now_iso()
    metadata = {
        "schemaVersion": "pm.public-eval.toolsandbox-arm-run.v3",
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
        "providerProcessTracePath": provider_process_summary["tracePath"],
        "providerProcess": provider_process_summary,
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
