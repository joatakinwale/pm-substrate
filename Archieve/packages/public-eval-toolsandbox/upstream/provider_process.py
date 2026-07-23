"""Out-of-process ToolSandbox provider-role boundary.

The benchmark driver remains the owner of ToolSandbox's ExecutionContext.  A
long-lived worker receives a JSON-safe snapshot, invokes exactly one upstream
agent role, and returns the updated context.  The supervisor validates that the
worker only appended agent messages before replacing the parent's context.

The process trace retains the exact canonical JSONL protocol frames.  That
lets an independent verifier recompute the frame hashes, replay each context
transition, and bind the worker's appended agent messages to the final public
trajectory.  Provider HTTP request/response evidence remains a separate D7
obligation.
"""

from __future__ import annotations

import ast
import base64
import contextlib
import hashlib
import json
import os
import secrets
import selectors
import signal
import subprocess
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional, TextIO

from tool_sandbox.cli.utils import AGENT_TYPE_TO_FACTORY, RoleImplType
from tool_sandbox.common.execution_context import (
    DatabaseNamespace,
    ExecutionContext,
    RoleType,
    get_current_context,
    set_current_context,
)
from tool_sandbox.common.message_conversion import Message
from tool_sandbox.roles.base_role import BaseRole

INIT_SCHEMA = "pm.public-eval.toolsandbox-provider-worker-init.v1"
HANDSHAKE_SCHEMA = "pm.public-eval.toolsandbox-provider-worker-handshake.v1"
REQUEST_SCHEMA = "pm.public-eval.toolsandbox-provider-worker-request.v1"
RESPONSE_SCHEMA = "pm.public-eval.toolsandbox-provider-worker-response.v1"
TRACE_SCHEMA = "pm.public-eval.toolsandbox-provider-process-trace-entry.v2"
SCRIPTED_AGENT = "PmScriptedStateProbe"
TARGET_CONTENT = "How's the new album coming along"
LOST_RESPONSE = (
    "The tool response was lost while the provider agent session restarted. "
    "The target-side outcome is unknown to this session."
)


def _now_iso() -> str:
    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def _canonical_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    ).encode("utf-8")


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _base64_bytes(value: bytes) -> str:
    return base64.b64encode(value).decode("ascii")


def _required_record(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise RuntimeError(f"{label} must be a JSON object")
    return value


def _required_string(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value:
        raise RuntimeError(f"{label} must be a non-empty string")
    return value


def _frame_bytes(value: Any) -> bytes:
    return _canonical_bytes(value) + b"\n"


def _write_frame(stream: TextIO, value: Any) -> bytes:
    raw = _frame_bytes(value)
    stream.write(raw.decode("utf-8"))
    stream.flush()
    return raw


def _read_json_line(stream: TextIO, label: str) -> tuple[dict[str, Any], bytes]:
    line = stream.readline()
    if line == "":
        raise RuntimeError(f"{label} closed before emitting a JSON frame")
    raw = line.encode("utf-8")
    try:
        value = json.loads(line)
    except json.JSONDecodeError as error:
        raise RuntimeError(f"{label} emitted malformed JSON") from error
    return _required_record(value, label), raw


class _TraceWriter:
    def __init__(
        self,
        path: Path,
        *,
        attempt_id: str,
        arm: str,
        evaluation_track: str,
    ) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        self._handle = path.open("x", encoding="utf-8")
        self._attempt_id = attempt_id
        self._arm = arm
        self._track = evaluation_track
        self._sequence = 0
        self._head_hash: Optional[str] = None

    @property
    def sequence(self) -> int:
        return self._sequence

    @property
    def head_hash(self) -> Optional[str]:
        return self._head_hash

    def append(self, event_type: str, details: dict[str, Any]) -> str:
        body = {
            "schemaVersion": TRACE_SCHEMA,
            "sequence": self._sequence + 1,
            "previousEntryHash": self._head_hash,
            "attemptId": self._attempt_id,
            "arm": self._arm,
            "evaluationTrack": self._track,
            "eventType": event_type,
            "recordedAt": _now_iso(),
            "details": details,
        }
        entry_hash = _sha256_bytes(_canonical_bytes(body))
        self._handle.write(
            json.dumps(
                {**body, "entryHash": entry_hash},
                sort_keys=True,
                ensure_ascii=False,
            )
            + "\n"
        )
        self._handle.flush()
        os.fsync(self._handle.fileno())
        self._sequence += 1
        self._head_hash = entry_hash
        return entry_hash

    def close(self) -> None:
        if not self._handle.closed:
            self._handle.flush()
            os.fsync(self._handle.fileno())
            self._handle.close()


class PmScriptedStateProbe(BaseRole):
    """Credential-free probe whose only state is the retained trajectory."""

    role_type: RoleType = RoleType.AGENT

    @staticmethod
    def _tool_call(name: str, arguments: dict[str, Any], call_id: str) -> Message:
        parameter_name = f"{call_id}_parameters"
        response_name = f"{call_id}_response"
        return Message(
            sender=RoleType.AGENT,
            recipient=RoleType.EXECUTION_ENVIRONMENT,
            content=(
                f"{parameter_name} = {arguments!r}\n"
                f"{response_name} = {name}(**{parameter_name})\n"
                f"print(repr({response_name}))"
            ),
            openai_tool_call_id=call_id,
            openai_function_name=name,
        )

    @staticmethod
    def _fredrik_phone(messages: list[Message]) -> str:
        for message in reversed(messages):
            if (
                message.sender == RoleType.EXECUTION_ENVIRONMENT
                and message.recipient == RoleType.AGENT
                and message.openai_function_name == "search_contacts"
                and message.tool_call_exception is None
            ):
                try:
                    result = ast.literal_eval(message.content)
                except (SyntaxError, ValueError) as error:
                    raise RuntimeError(
                        "scripted probe could not decode retained contact result"
                    ) from error
                if isinstance(result, list):
                    for contact in result:
                        if (
                            isinstance(contact, dict)
                            and contact.get("name") == "Fredrik Thordendal"
                            and isinstance(contact.get("phone_number"), str)
                        ):
                            return contact["phone_number"]
        raise RuntimeError("scripted probe has no retained Fredrik contact result")

    def respond(self, ending_index: Optional[int] = None) -> None:
        messages = self.get_messages(ending_index=ending_index)
        self.messages_validation(messages)
        messages = self.filter_messages(messages)
        calls = [
            message.openai_function_name
            for message in messages
            if message.sender == RoleType.AGENT
            and message.recipient == RoleType.EXECUTION_ENVIRONMENT
        ]
        if "set_cellular_service_status" not in calls:
            response = self._tool_call(
                "set_cellular_service_status", {"on": True}, "pm_probe_cellular_1"
            )
        elif "search_contacts" not in calls:
            response = self._tool_call(
                "search_contacts",
                {"name": "Fredrik Thordendal"},
                "pm_probe_search_1",
            )
        elif calls.count("send_message_with_phone_number") == 0:
            phone = self._fredrik_phone(messages)
            response = self._tool_call(
                "send_message_with_phone_number",
                {"phone_number": phone, "content": TARGET_CONTENT},
                "pm_probe_send_1",
            )
        elif calls.count("send_message_with_phone_number") == 1 and any(
            message.sender == RoleType.EXECUTION_ENVIRONMENT
            and message.openai_function_name == "send_message_with_phone_number"
            and message.content == LOST_RESPONSE
            for message in messages
        ):
            phone = self._fredrik_phone(messages)
            response = self._tool_call(
                "send_message_with_phone_number",
                {"phone_number": phone, "content": TARGET_CONTENT},
                "pm_probe_send_2",
            )
        else:
            response = Message(
                sender=RoleType.AGENT,
                recipient=RoleType.USER,
                content="Your message to Fredrik Thordendal has been sent saying: How's the new album coming along",
            )
        self.add_messages([response])


class ProviderProcessRole(BaseRole):
    """A ToolSandbox AGENT role backed by a supervised OS process."""

    role_type: RoleType = RoleType.AGENT

    def __init__(
        self,
        *,
        python_executable: str,
        agent: str,
        attempt_id: str,
        arm: str,
        evaluation_track: str,
        trace_path: Path,
        runner_path: Path,
        response_timeout_seconds: float = 900.0,
    ) -> None:
        if os.name != "posix":
            raise RuntimeError(
                "ToolSandbox provider-process proof requires POSIX process groups"
            )
        # Do not resolve a virtual-environment launcher symlink for execution:
        # invoking the base interpreter directly drops the venv's sys.path.
        self._python = Path(python_executable).absolute()
        self._worker_path = Path(__file__).resolve()
        self._runner_path = runner_path.resolve()
        self._agent = agent if agent == SCRIPTED_AGENT else str(RoleImplType(agent))
        self._attempt_id = attempt_id
        self._arm = arm
        self._track = evaluation_track
        self._timeout = response_timeout_seconds
        self._runner_sha256 = _sha256_file(self._runner_path)
        self._worker_sha256 = _sha256_file(self._worker_path)
        self._executable_sha256 = _sha256_file(self._python)
        self._trace = _TraceWriter(
            trace_path,
            attempt_id=attempt_id,
            arm=arm,
            evaluation_track=evaluation_track,
        )
        self._process: Optional[subprocess.Popen[str]] = None
        self._process_group_id: Optional[int] = None
        self._process_nonce: Optional[str] = None
        self._process_instance = 0
        self._request_sequence = 0
        self._restart_count = 0
        self._closed = False
        self._trace.append(
            "supervisor_initialized",
            {
                "runnerPid": os.getpid(),
                "runnerPpid": os.getppid(),
                "runnerSha256": self._runner_sha256,
                "workerSha256": self._worker_sha256,
                "pythonExecutableSha256": self._executable_sha256,
            },
        )
        try:
            self._spawn_worker(reason="initial")
        except Exception:
            self._trace.close()
            raise

    @property
    def restart_count(self) -> int:
        return self._restart_count

    @property
    def process_instance_count(self) -> int:
        return self._process_instance

    @property
    def trace_path(self) -> Path:
        return self._trace.path

    @property
    def trace_entry_count(self) -> int:
        return self._trace.sequence

    @property
    def trace_head_hash(self) -> str:
        head = self._trace.head_hash
        if head is None:
            raise RuntimeError("provider process trace has no head")
        return head

    @property
    def runner_sha256(self) -> str:
        return self._runner_sha256

    @property
    def worker_sha256(self) -> str:
        return self._worker_sha256

    @property
    def python_executable_sha256(self) -> str:
        return self._executable_sha256

    def _current_identity(self) -> dict[str, Any]:
        process = self._require_process()
        nonce = self._process_nonce
        process_group_id = self._process_group_id
        if nonce is None or process_group_id is None:
            raise RuntimeError("provider worker has no accepted process nonce")
        return {
            "processInstance": self._process_instance,
            "pid": process.pid,
            "processGroupId": process_group_id,
            "processNonce": nonce,
        }

    def _require_process(self) -> subprocess.Popen[str]:
        if self._process is None:
            raise RuntimeError("provider worker is not running")
        return self._process

    def _read_frame(self, label: str) -> tuple[dict[str, Any], bytes]:
        process = self._require_process()
        if process.stdout is None:
            raise RuntimeError("provider worker stdout is unavailable")
        with selectors.DefaultSelector() as selector:
            selector.register(process.stdout, selectors.EVENT_READ)
            if not selector.select(self._timeout):
                raise RuntimeError(f"{label} timed out")
        return _read_json_line(process.stdout, label)

    def _send_frame(self, value: dict[str, Any]) -> bytes:
        process = self._require_process()
        if process.poll() is not None:
            raise RuntimeError(
                f"provider worker exited unexpectedly with status {process.returncode}"
            )
        if process.stdin is None:
            raise RuntimeError("provider worker stdin is unavailable")
        return _write_frame(process.stdin, value)

    def _spawn_worker(self, *, reason: str) -> None:
        if self._process is not None:
            raise RuntimeError(
                "cannot spawn a second provider worker before reaping the first"
            )
        next_instance = self._process_instance + 1
        self._trace.append(
            "worker_spawn_requested",
            {
                "reason": reason,
                "processInstance": next_instance,
                "workerSha256": self._worker_sha256,
                "pythonExecutableSha256": self._executable_sha256,
            },
        )
        process = subprocess.Popen(
            [str(self._python), str(self._worker_path), "--worker"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            encoding="utf-8",
            bufsize=1,
            close_fds=True,
            start_new_session=True,
        )
        self._process = process
        self._process_group_id = process.pid
        self._process_instance = next_instance
        try:
            if os.getpgid(process.pid) != process.pid:
                raise RuntimeError(
                    "provider worker is not the leader of its isolated process group"
                )
            init = {
                "schemaVersion": INIT_SCHEMA,
                "agent": self._agent,
                "attemptId": self._attempt_id,
                "processInstance": next_instance,
                "expectedParentPid": os.getpid(),
                "expectedWorkerSha256": self._worker_sha256,
                "expectedPythonExecutableSha256": self._executable_sha256,
            }
            init_raw = self._send_frame(init)
            handshake, handshake_raw = self._read_frame("provider worker handshake")
            if set(handshake) != {
                "schemaVersion",
                "kind",
                "attemptId",
                "processInstance",
                "pid",
                "ppid",
                "processNonce",
                "workerSha256",
                "pythonExecutableSha256",
            }:
                raise RuntimeError("provider worker handshake has an unexpected shape")
            if (
                handshake["schemaVersion"] != HANDSHAKE_SCHEMA
                or handshake["kind"] != "handshake"
                or handshake["attemptId"] != self._attempt_id
                or handshake["processInstance"] != next_instance
                or handshake["pid"] != process.pid
                or handshake["ppid"] != os.getpid()
                or handshake["workerSha256"] != self._worker_sha256
                or handshake["pythonExecutableSha256"] != self._executable_sha256
            ):
                raise RuntimeError(
                    "provider worker handshake does not match the spawned process"
                )
            nonce = _required_string(handshake["processNonce"], "/processNonce")
            self._process_nonce = nonce
            self._trace.append(
                "worker_handshake_accepted",
                {
                    **self._current_identity(),
                    "ppid": handshake["ppid"],
                    "initFrameSha256": _sha256_bytes(init_raw),
                    "initFrameByteLength": len(init_raw),
                    "initFrameBase64": _base64_bytes(init_raw),
                    "handshakeFrameSha256": _sha256_bytes(handshake_raw),
                    "handshakeFrameByteLength": len(handshake_raw),
                    "handshakeFrameBase64": _base64_bytes(handshake_raw),
                    "runnerSha256": self._runner_sha256,
                    "workerSha256": self._worker_sha256,
                    "pythonExecutableSha256": self._executable_sha256,
                },
            )
        except BaseException as error:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait(timeout=self._timeout)
            self._trace.append(
                "worker_spawn_failed_closed",
                {
                    "processInstance": next_instance,
                    "pid": process.pid,
                    "returnCode": process.returncode,
                    "errorType": type(error).__name__,
                    "errorMessageSha256": _sha256_bytes(
                        str(error).encode("utf-8", errors="replace")
                    ),
                },
            )
            self._close_process_pipes(process)
            self._process = None
            self._process_group_id = None
            self._process_nonce = None
            raise

    @staticmethod
    def _validate_context_transition(
        before: dict[str, Any], after: dict[str, Any]
    ) -> int:
        if set(after) != set(before):
            raise RuntimeError("provider worker changed ExecutionContext shape")
        before_dbs = _required_record(before.get("_dbs"), "/context/before/_dbs")
        after_dbs = _required_record(after.get("_dbs"), "/context/after/_dbs")
        if set(after_dbs) != set(before_dbs):
            raise RuntimeError("provider worker changed ExecutionContext databases")
        for key in before:
            if key != "_dbs" and _canonical_bytes(before[key]) != _canonical_bytes(
                after[key]
            ):
                raise RuntimeError(
                    f"provider worker changed ExecutionContext field {key}"
                )
        for namespace in before_dbs:
            if namespace == str(DatabaseNamespace.SANDBOX):
                continue
            if _canonical_bytes(before_dbs[namespace]) != _canonical_bytes(
                after_dbs[namespace]
            ):
                raise RuntimeError(
                    f"provider worker changed non-message database {namespace}"
                )
        before_messages = before_dbs.get(str(DatabaseNamespace.SANDBOX))
        after_messages = after_dbs.get(str(DatabaseNamespace.SANDBOX))
        if not isinstance(before_messages, list) or not isinstance(
            after_messages, list
        ):
            raise RuntimeError("provider worker returned a malformed SANDBOX database")
        if after_messages[: len(before_messages)] != before_messages:
            raise RuntimeError("provider worker rewrote existing ToolSandbox messages")
        appended = after_messages[len(before_messages) :]
        prior_indexes = [
            row.get("sandbox_message_index")
            for row in before_messages
            if isinstance(row, dict)
            and isinstance(row.get("sandbox_message_index"), int)
        ]
        next_index = (max(prior_indexes) if prior_indexes else -1) + 1
        for offset, row in enumerate(appended):
            if not isinstance(row, dict) or row.get("sender") != str(RoleType.AGENT):
                raise RuntimeError("provider worker appended a non-agent message")
            if row.get("sandbox_message_index") != next_index + offset:
                raise RuntimeError(
                    "provider worker appended a non-monotonic message index"
                )
            if row.get("recipient") not in {
                str(RoleType.USER),
                str(RoleType.EXECUTION_ENVIRONMENT),
            }:
                raise RuntimeError(
                    "provider worker appended an invalid agent-message recipient"
                )
        return len(appended)

    def respond(self, ending_index: Optional[int] = None) -> None:
        if self._closed:
            raise RuntimeError("provider worker role is closed")
        parent_context = get_current_context()
        serialized = parent_context.to_dict(serialize_console=False)
        self._request_sequence += 1
        request_id = (
            f"{self._attempt_id}:provider:{self._process_instance}:"
            f"{self._request_sequence}"
        )
        context_hash_before = _sha256_bytes(_canonical_bytes(serialized))
        request = {
            "schemaVersion": REQUEST_SCHEMA,
            "kind": "respond",
            "requestId": request_id,
            "attemptId": self._attempt_id,
            "processInstance": self._process_instance,
            "processNonce": self._process_nonce,
            "endingIndex": ending_index,
            "contextHash": context_hash_before,
            "context": serialized,
        }
        request_raw = self._send_frame(request)
        self._trace.append(
            "context_request_sent",
            {
                **self._current_identity(),
                "requestId": request_id,
                "endingIndex": ending_index,
                "contextHashBefore": context_hash_before,
                "requestFrameSha256": _sha256_bytes(request_raw),
                "requestFrameByteLength": len(request_raw),
                "requestFrameBase64": _base64_bytes(request_raw),
            },
        )
        response, response_raw = self._read_frame("provider worker response")
        if response.get("kind") == "error":
            self._trace.append(
                "worker_error_received",
                {
                    **self._current_identity(),
                    "requestId": request_id,
                    "responseFrameSha256": _sha256_bytes(response_raw),
                    "responseFrameByteLength": len(response_raw),
                    "responseFrameBase64": _base64_bytes(response_raw),
                    "errorType": response.get("errorType"),
                    "errorMessageSha256": response.get("errorMessageSha256"),
                    "tracebackSha256": response.get("tracebackSha256"),
                },
            )
            raise RuntimeError(
                f"provider worker failed for {request_id}; "
                f"errorType={response.get('errorType')}"
            )
        if set(response) != {
            "schemaVersion",
            "kind",
            "requestId",
            "attemptId",
            "processInstance",
            "processNonce",
            "contextHashBefore",
            "contextHashAfter",
            "context",
        }:
            raise RuntimeError("provider worker response has an unexpected shape")
        if (
            response["schemaVersion"] != RESPONSE_SCHEMA
            or response["kind"] != "responded"
            or response["requestId"] != request_id
            or response["attemptId"] != self._attempt_id
            or response["processInstance"] != self._process_instance
            or response["processNonce"] != self._process_nonce
            or response["contextHashBefore"] != context_hash_before
        ):
            raise RuntimeError(
                "provider worker response identity does not match its request"
            )
        returned = _required_record(response["context"], "/workerResponse/context")
        context_hash_after = _sha256_bytes(_canonical_bytes(returned))
        if response["contextHashAfter"] != context_hash_after:
            raise RuntimeError(
                "provider worker response context hash does not recompute"
            )
        appended_count = self._validate_context_transition(serialized, returned)
        replacement = ExecutionContext.from_dict(returned)
        # Agent roles never own the REPL. Preserve the driver's live console so
        # an agent-process boundary cannot erase tool imports or executed state.
        replacement.interactive_console = parent_context.interactive_console
        set_current_context(replacement)
        self._trace.append(
            "context_response_accepted",
            {
                **self._current_identity(),
                "requestId": request_id,
                "contextHashBefore": context_hash_before,
                "contextHashAfter": context_hash_after,
                "responseFrameSha256": _sha256_bytes(response_raw),
                "responseFrameByteLength": len(response_raw),
                "responseFrameBase64": _base64_bytes(response_raw),
                "appendedAgentMessageCount": appended_count,
            },
        )

    def restart_after_sigkill(self, trigger: dict[str, Any]) -> str:
        if self._closed:
            raise RuntimeError("cannot restart a closed provider worker")
        expected_trigger_keys = {
            "targetCallId",
            "targetSideEffectReceiptHash",
            "lostResponseHash",
            "contextHashAfterLostResponse",
            "appliedAtTurn",
        }
        if set(trigger) != expected_trigger_keys:
            raise RuntimeError("provider restart trigger has an unexpected shape")
        for hash_key in (
            "targetSideEffectReceiptHash",
            "lostResponseHash",
            "contextHashAfterLostResponse",
        ):
            value = trigger[hash_key]
            if (
                not isinstance(value, str)
                or len(value) != 64
                or any(character not in "0123456789abcdef" for character in value)
            ):
                raise RuntimeError(
                    f"provider restart trigger {hash_key} is not SHA-256"
                )
        if not isinstance(trigger["targetCallId"], str) or not trigger["targetCallId"]:
            raise RuntimeError("provider restart trigger targetCallId is invalid")
        if (
            not isinstance(trigger["appliedAtTurn"], int)
            or trigger["appliedAtTurn"] < 0
        ):
            raise RuntimeError("provider restart trigger appliedAtTurn is invalid")
        current_context = get_current_context().to_dict(serialize_console=False)
        current_context_hash = _sha256_bytes(_canonical_bytes(current_context))
        if trigger["contextHashAfterLostResponse"] != current_context_hash:
            raise RuntimeError(
                "provider restart trigger does not bind the current lost-response context"
            )
        current_dbs = _required_record(
            current_context.get("_dbs"), "/restartContext/_dbs"
        )
        sandbox_rows = current_dbs.get(str(DatabaseNamespace.SANDBOX))
        if not isinstance(sandbox_rows, list) or not any(
            isinstance(row, dict)
            and row.get("sandbox_message_index") == trigger["appliedAtTurn"]
            and row.get("sender") == str(RoleType.EXECUTION_ENVIRONMENT)
            and row.get("recipient") == str(RoleType.AGENT)
            and isinstance(row.get("content"), str)
            and _sha256_bytes(row["content"].encode("utf-8"))
            == trigger["lostResponseHash"]
            for row in sandbox_rows
        ):
            raise RuntimeError(
                "provider restart trigger has no matching lost response in context"
            )
        process = self._require_process()
        identity = self._current_identity()
        if process.poll() is not None:
            raise RuntimeError("provider worker exited before scheduled SIGKILL")
        self._trace.append(
            "lost_response_fault_bound",
            {**identity, **trigger},
        )
        self._trace.append("restart_requested", identity)
        os.killpg(process.pid, signal.SIGKILL)
        self._trace.append(
            "sigkill_sent",
            {**identity, "signal": int(signal.SIGKILL)},
        )
        return_code = process.wait(timeout=self._timeout)
        if return_code != -int(signal.SIGKILL):
            raise RuntimeError(
                f"provider worker did not exit from SIGKILL (status={return_code})"
            )
        self._trace.append(
            "worker_reaped_after_sigkill",
            {
                **identity,
                "signal": int(signal.SIGKILL),
                "returnCode": return_code,
            },
        )
        self._close_process_pipes(process)
        self._process = None
        self._process_group_id = None
        self._process_nonce = None
        self._restart_count += 1
        self._spawn_worker(reason="scheduled_lost_response_restart")
        return (
            f"provider-process-{self._process_instance:03d}-{self._process_nonce[:12]}"
        )

    @staticmethod
    def _close_process_pipes(process: subprocess.Popen[str]) -> None:
        for stream in (process.stdin, process.stdout):
            if stream is not None:
                stream.close()

    def teardown(self) -> None:
        if self._closed:
            return
        try:
            process = self._require_process()
            identity = self._current_identity()
            if process.poll() is not None:
                self._trace.append(
                    "unexpected_worker_exit_observed",
                    {**identity, "returnCode": process.returncode},
                )
                raise RuntimeError(
                    f"provider worker exited before clean teardown ({process.returncode})"
                )
            self._request_sequence += 1
            request_id = (
                f"{self._attempt_id}:provider:{self._process_instance}:"
                f"shutdown-{self._request_sequence}"
            )
            raw = self._send_frame(
                {
                    "schemaVersion": REQUEST_SCHEMA,
                    "kind": "shutdown",
                    "requestId": request_id,
                    "attemptId": self._attempt_id,
                    "processInstance": self._process_instance,
                    "processNonce": self._process_nonce,
                }
            )
            self._trace.append(
                "clean_shutdown_requested",
                {
                    **identity,
                    "requestId": request_id,
                    "requestFrameSha256": _sha256_bytes(raw),
                    "requestFrameByteLength": len(raw),
                    "requestFrameBase64": _base64_bytes(raw),
                },
            )
            response, response_raw = self._read_frame("provider shutdown response")
            if (
                set(response)
                != {
                    "schemaVersion",
                    "kind",
                    "requestId",
                    "attemptId",
                    "processInstance",
                    "processNonce",
                }
                or response["schemaVersion"] != RESPONSE_SCHEMA
                or response["kind"] != "shutdown_acknowledged"
                or response["requestId"] != request_id
                or response["attemptId"] != self._attempt_id
                or response["processInstance"] != self._process_instance
                or response["processNonce"] != self._process_nonce
            ):
                raise RuntimeError(
                    "provider worker emitted an invalid shutdown acknowledgement"
                )
            self._trace.append(
                "clean_shutdown_acknowledged",
                {
                    **identity,
                    "requestId": request_id,
                    "responseFrameSha256": _sha256_bytes(response_raw),
                    "responseFrameByteLength": len(response_raw),
                    "responseFrameBase64": _base64_bytes(response_raw),
                },
            )
            return_code = process.wait(timeout=self._timeout)
            if return_code != 0:
                raise RuntimeError(
                    f"provider worker clean teardown returned status {return_code}"
                )
            self._trace.append(
                "worker_reaped_clean",
                {**identity, "returnCode": return_code},
            )
            self._close_process_pipes(process)
            self._process = None
            self._process_group_id = None
            self._process_nonce = None
        except BaseException as error:
            process = self._process
            if process is not None:
                if process.poll() is None:
                    os.killpg(process.pid, signal.SIGKILL)
                    return_code = process.wait(timeout=self._timeout)
                else:
                    return_code = process.returncode
                self._trace.append(
                    "forced_teardown_after_error",
                    {
                        "processInstance": self._process_instance,
                        "pid": process.pid,
                        "processGroupId": self._process_group_id,
                        "processNonce": self._process_nonce,
                        "returnCode": return_code,
                        "errorType": type(error).__name__,
                        "errorMessageSha256": _sha256_bytes(
                            str(error).encode("utf-8", errors="replace")
                        ),
                    },
                )
                self._close_process_pipes(process)
            self._process = None
            self._process_group_id = None
            self._process_nonce = None
            raise
        finally:
            self._closed = True
            self._trace.close()

    def trace_summary(self) -> dict[str, Any]:
        if not self._closed:
            raise RuntimeError(
                "provider process trace is not final until clean teardown"
            )
        return {
            "tracePath": str(self.trace_path),
            "traceSha256": _sha256_file(self.trace_path),
            "traceHeadHash": self.trace_head_hash,
            "traceEntryCount": self.trace_entry_count,
            "processInstanceCount": self.process_instance_count,
            "restartCount": self.restart_count,
            "restartSemantics": "provider_agent_os_process_group_sigkill_wait_then_fresh_process",
            "runnerSha256": self.runner_sha256,
            "workerSha256": self.worker_sha256,
            "pythonExecutableSha256": self.python_executable_sha256,
        }


def _worker_error(
    *,
    request: dict[str, Any],
    process_nonce: str,
    error: BaseException,
) -> dict[str, Any]:
    message = str(error).encode("utf-8", errors="replace")
    trace = traceback.format_exc().encode("utf-8", errors="replace")
    return {
        "schemaVersion": RESPONSE_SCHEMA,
        "kind": "error",
        "requestId": request.get("requestId"),
        "attemptId": request.get("attemptId"),
        "processInstance": request.get("processInstance"),
        "processNonce": process_nonce,
        "errorType": type(error).__name__,
        "errorMessageSha256": _sha256_bytes(message),
        "tracebackSha256": _sha256_bytes(trace),
    }


def _run_worker() -> int:
    init, _ = _read_json_line(sys.stdin, "provider worker init")
    if set(init) != {
        "schemaVersion",
        "agent",
        "attemptId",
        "processInstance",
        "expectedParentPid",
        "expectedWorkerSha256",
        "expectedPythonExecutableSha256",
    }:
        raise RuntimeError("provider worker init has an unexpected shape")
    if init["schemaVersion"] != INIT_SCHEMA:
        raise RuntimeError("provider worker init schema is invalid")
    worker_path = Path(__file__).resolve()
    executable_path = Path(sys.executable).resolve()
    worker_sha256 = _sha256_file(worker_path)
    executable_sha256 = _sha256_file(executable_path)
    if (
        init["expectedParentPid"] != os.getppid()
        or init["expectedWorkerSha256"] != worker_sha256
        or init["expectedPythonExecutableSha256"] != executable_sha256
    ):
        raise RuntimeError("provider worker init does not bind this process image")
    attempt_id = _required_string(init["attemptId"], "/init/attemptId")
    process_instance = init["processInstance"]
    if not isinstance(process_instance, int) or process_instance <= 0:
        raise RuntimeError("provider worker processInstance is invalid")
    agent_name = _required_string(init["agent"], "/init/agent")
    if agent_name == SCRIPTED_AGENT:
        agent = PmScriptedStateProbe()
    else:
        agent_type = RoleImplType(agent_name)
        agent = AGENT_TYPE_TO_FACTORY[agent_type]()
    process_nonce = secrets.token_hex(24)
    protocol_stdout = sys.stdout
    _write_frame(
        protocol_stdout,
        {
            "schemaVersion": HANDSHAKE_SCHEMA,
            "kind": "handshake",
            "attemptId": attempt_id,
            "processInstance": process_instance,
            "pid": os.getpid(),
            "ppid": os.getppid(),
            "processNonce": process_nonce,
            "workerSha256": worker_sha256,
            "pythonExecutableSha256": executable_sha256,
        },
    )
    while True:
        request, _ = _read_json_line(sys.stdin, "provider worker request")
        try:
            if (
                request.get("schemaVersion") != REQUEST_SCHEMA
                or request.get("attemptId") != attempt_id
                or request.get("processInstance") != process_instance
                or request.get("processNonce") != process_nonce
            ):
                raise RuntimeError("provider worker request identity is invalid")
            kind = request.get("kind")
            if kind == "shutdown":
                agent.teardown()
                _write_frame(
                    protocol_stdout,
                    {
                        "schemaVersion": RESPONSE_SCHEMA,
                        "kind": "shutdown_acknowledged",
                        "requestId": request.get("requestId"),
                        "attemptId": attempt_id,
                        "processInstance": process_instance,
                        "processNonce": process_nonce,
                    },
                )
                return 0
            if kind != "respond":
                raise RuntimeError("provider worker request kind is invalid")
            context_value = _required_record(
                request.get("context"), "/workerRequest/context"
            )
            context_hash_before = _sha256_bytes(_canonical_bytes(context_value))
            if request.get("contextHash") != context_hash_before:
                raise RuntimeError("provider worker request context hash is invalid")
            context = ExecutionContext.from_dict(context_value)
            set_current_context(context)
            # Keep provider/library stdout outside the protocol channel. stderr is
            # intentionally discarded by the supervisor to avoid retaining secrets.
            with contextlib.redirect_stdout(sys.stderr):
                agent.respond(ending_index=request.get("endingIndex"))
            returned = get_current_context().to_dict(serialize_console=False)
            context_hash_after = _sha256_bytes(_canonical_bytes(returned))
            _write_frame(
                protocol_stdout,
                {
                    "schemaVersion": RESPONSE_SCHEMA,
                    "kind": "responded",
                    "requestId": request.get("requestId"),
                    "attemptId": attempt_id,
                    "processInstance": process_instance,
                    "processNonce": process_nonce,
                    "contextHashBefore": context_hash_before,
                    "contextHashAfter": context_hash_after,
                    "context": returned,
                },
            )
        except BaseException as error:
            _write_frame(
                protocol_stdout,
                _worker_error(
                    request=request,
                    process_nonce=process_nonce,
                    error=error,
                ),
            )


if __name__ == "__main__":
    if sys.argv[1:] != ["--worker"]:
        raise SystemExit("usage: provider_process.py --worker")
    raise SystemExit(_run_worker())
