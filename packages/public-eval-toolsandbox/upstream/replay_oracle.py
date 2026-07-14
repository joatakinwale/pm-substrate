"""Replay the pinned ToolSandbox oracle from retained execution-context bytes.

The caller supplies only a clean checkout path and one execution_context.json
path.  Scenario identity, evaluator selection, metric interpretation, and the
strict-success rule are pinned here; no caller-authored score or oracle result
is accepted.
"""

from __future__ import annotations

import contextlib
import hashlib
import io
import json
import math
import os
import random
import stat
import subprocess
import sys
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any, NoReturn


INPUT_SCHEMA = "pm.public-eval.toolsandbox-oracle-replay-input.v1"
RECEIPT_SCHEMA = "pm.public-eval.toolsandbox-oracle-replay.v2"
RECEIPT_PREFIX = "PM_TOOL_SANDBOX_ORACLE_REPLAY="
ERROR_PREFIX = "PM_TOOL_SANDBOX_ORACLE_REPLAY_ERROR="
REPOSITORY_URL = "https://github.com/apple/ToolSandbox"
PINNED_ORIGIN_URL = "https://github.com/apple/ToolSandbox.git"
PINNED_REVISION = "165848b9a78cead7ca7fe7c89c688b58e6501219"
PINNED_TREE = "060c6eb2a9d4370c56586d4340401d87fa155eda"
SCENARIO = "send_message_with_contact_content_cellular_off_multiple_user_turn"
EXPECTED_MAX_MESSAGES = 30
EXPECTED_MILESTONE_COUNT = 4
EXPECTED_MILESTONE_EDGES = ((0, 2), (1, 2), (2, 3))
EXPECTED_MINEFIELD_COUNT = 0
EXPECTED_MINEFIELD_EDGES: tuple[tuple[int, int], ...] = ()
EXPECTED_CONTEXT_KEYS = {
    "_dbs",
    "interactive_console",
    "tool_allow_list",
    "tool_deny_list",
    "trace_tool",
    "tool_augmentation_list",
    "preferred_tool_backend",
}
EXPECTED_DATABASES = {"SANDBOX", "SETTING", "CONTACT", "MESSAGING", "REMINDER"}
STARTING_CONTEXT_NORMALIZATION_RULE_ID = (
    "pm.public-eval.toolsandbox-starting-context.exact-timestamp-paths.v1"
)
VOLATILE_TIMESTAMP_VALUE_MARKER = "<volatile-timestamp>"
EXPECTED_VOLATILE_TIMESTAMP_PATHS: frozenset[tuple[str | int, ...]] = frozenset(
    {
        ("_dbs", "MESSAGING", 1, "creation_timestamp"),
        ("_dbs", "MESSAGING", 2, "creation_timestamp"),
        ("_dbs", "MESSAGING", 3, "creation_timestamp"),
        ("_dbs", "MESSAGING", 4, "creation_timestamp"),
        ("_dbs", "MESSAGING", 5, "creation_timestamp"),
        ("_dbs", "REMINDER", 1, "creation_timestamp"),
        ("_dbs", "REMINDER", 1, "reminder_timestamp"),
        ("_dbs", "REMINDER", 2, "creation_timestamp"),
        ("_dbs", "REMINDER", 2, "reminder_timestamp"),
        ("_dbs", "REMINDER", 3, "creation_timestamp"),
        ("_dbs", "REMINDER", 3, "reminder_timestamp"),
    }
)
# Row zero in each database is ToolSandbox's schema row. These timestamp-named
# cells are stable nulls, are not volatile numeric values, and must not be
# silently admitted as additional normalization targets.
EXPECTED_NULL_TIMESTAMP_PATHS: frozenset[tuple[str | int, ...]] = frozenset(
    {
        ("_dbs", "MESSAGING", 0, "creation_timestamp"),
        ("_dbs", "REMINDER", 0, "creation_timestamp"),
        ("_dbs", "REMINDER", 0, "reminder_timestamp"),
    }
)
EXPECTED_NORMALIZED_STARTING_CONTEXT_SHA256 = (
    "62717eafc44807b3b6729f8c5b5f0f47fbeffba30093c421d90689ac30da2d04"
)
EXPECTED_VOLATILE_TIMESTAMP_VALUE_COUNT = 11
EXPECTED_STARTING_SANDBOX_ROW_COUNT = 29
MAX_CONFIG_BYTES = 1_048_576
MAX_CONTEXT_BYTES = 256 * 1024 * 1024


class ReplayError(Exception):
    """A fail-closed input, checkout, import, or replay failure."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def _canonical_json(value: Any) -> str:
    try:
        return json.dumps(
            value,
            allow_nan=False,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        )
    except (TypeError, ValueError) as error:
        raise ReplayError("non_canonical_value", "receipt contains unsupported JSON") from error


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _sha256_json(value: Any) -> str:
    return _sha256_bytes(_canonical_json(value).encode("utf-8"))


def _reject_duplicate_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ReplayError("duplicate_json_key", f"JSON object duplicates key {key!r}")
        result[key] = value
    return result


def _parse_json_bytes(value: bytes, label: str) -> Any:
    try:
        text = value.decode("utf-8", errors="strict")
    except UnicodeDecodeError as error:
        raise ReplayError("invalid_utf8", f"{label} must be UTF-8") from error
    try:
        return json.loads(text, object_pairs_hook=_reject_duplicate_object)
    except ReplayError:
        raise
    except (json.JSONDecodeError, ValueError) as error:
        raise ReplayError("invalid_json", f"{label} must be valid JSON") from error


def _record(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ReplayError("invalid_schema", f"{label} must be an object")
    return value


def _exact_keys(value: Mapping[str, Any], expected: set[str], label: str) -> None:
    actual = set(value)
    if actual != expected:
        missing = sorted(expected - actual)
        extra = sorted(actual - expected)
        raise ReplayError(
            "invalid_schema",
            f"{label} keys differ (missing={missing}; extra={extra})",
        )


def _nonempty_string(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ReplayError("invalid_schema", f"{label} must be a non-empty string")
    return value


def _absolute_regular_file(value: Any, label: str) -> Path:
    raw = Path(_nonempty_string(value, label))
    if not raw.is_absolute():
        raise ReplayError("invalid_path", f"{label} must be absolute")
    try:
        file_status = os.lstat(raw)
    except OSError as error:
        raise ReplayError("invalid_path", f"{label} cannot be opened") from error
    if stat.S_ISLNK(file_status.st_mode) or not stat.S_ISREG(file_status.st_mode):
        raise ReplayError("invalid_path", f"{label} must be a regular non-symlink file")
    try:
        return raw.resolve(strict=True)
    except OSError as error:
        raise ReplayError("invalid_path", f"{label} cannot be resolved") from error


def _absolute_directory(value: Any, label: str) -> Path:
    raw = Path(_nonempty_string(value, label))
    if not raw.is_absolute():
        raise ReplayError("invalid_path", f"{label} must be absolute")
    try:
        resolved = raw.resolve(strict=True)
    except OSError as error:
        raise ReplayError("invalid_path", f"{label} cannot be resolved") from error
    if not resolved.is_dir():
        raise ReplayError("invalid_path", f"{label} must be a directory")
    return resolved


def _git(checkout: Path, arguments: Sequence[str], label: str) -> str:
    try:
        completed = subprocess.run(
            ["git", "-C", str(checkout), *arguments],
            capture_output=True,
            check=False,
            encoding="utf-8",
            errors="strict",
            shell=False,
        )
    except (OSError, UnicodeError) as error:
        raise ReplayError("git_failed", f"cannot inspect checkout {label}") from error
    if completed.returncode != 0:
        raise ReplayError("git_failed", f"cannot inspect checkout {label}")
    return completed.stdout.strip()


def _verify_clean_checkout(checkout: Path) -> None:
    if _git(checkout, ["rev-parse", "HEAD"], "revision") != PINNED_REVISION:
        raise ReplayError("revision_mismatch", "checkout revision is not pinned ToolSandbox")
    if _git(checkout, ["rev-parse", "HEAD^{tree}"], "tree") != PINNED_TREE:
        raise ReplayError("tree_mismatch", "checkout tree is not pinned ToolSandbox")
    if _git(checkout, ["remote", "get-url", "origin"], "origin") != PINNED_ORIGIN_URL:
        raise ReplayError("origin_mismatch", "checkout origin is not pinned ToolSandbox")
    status_output = _git(
        checkout,
        ["status", "--porcelain=v1", "--untracked-files=all"],
        "status",
    )
    if status_output:
        raise ReplayError("dirty_checkout", "ToolSandbox checkout is not clean")


def _read_input() -> dict[str, Any]:
    first_line = sys.stdin.buffer.readline(MAX_CONFIG_BYTES + 1)
    if not first_line:
        raise ReplayError("missing_input", "one config JSON line is required")
    if len(first_line) > MAX_CONFIG_BYTES:
        raise ReplayError("input_too_large", "config JSON line is too large")
    trailing = sys.stdin.buffer.read()
    if trailing.strip():
        raise ReplayError("trailing_input", "only one config JSON line is permitted")
    root = _record(_parse_json_bytes(first_line, "config"), "config")
    _exact_keys(root, {"schemaVersion", "checkoutPath", "executionContextPath"}, "config")
    if root["schemaVersion"] != INPUT_SCHEMA:
        raise ReplayError("invalid_schema", "config schemaVersion is unsupported")
    return root


def _read_execution_context(path: Path) -> tuple[bytes, dict[str, Any]]:
    try:
        size = path.stat().st_size
    except OSError as error:
        raise ReplayError("invalid_path", "executionContextPath cannot be inspected") from error
    if size <= 0 or size > MAX_CONTEXT_BYTES:
        raise ReplayError(
            "invalid_context_size",
            f"execution_context.json must contain 1..{MAX_CONTEXT_BYTES} bytes",
        )
    try:
        first = path.read_bytes()
        second = path.read_bytes()
    except OSError as error:
        raise ReplayError("invalid_path", "executionContextPath cannot be read") from error
    if first != second:
        raise ReplayError("context_changed", "execution context changed while being read")
    root = _record(_parse_json_bytes(first, "execution_context.json"), "execution_context.json")
    _exact_keys(root, EXPECTED_CONTEXT_KEYS, "execution_context.json")
    databases = _record(root["_dbs"], "execution_context.json._dbs")
    _exact_keys(databases, EXPECTED_DATABASES, "execution_context.json._dbs")
    if root["interactive_console"] is not None:
        raise ReplayError(
            "unsafe_console_payload",
            "retained execution context must not contain a serialized interactive console",
        )
    for namespace, rows in databases.items():
        if not isinstance(rows, list) or not rows:
            raise ReplayError(
                "invalid_schema",
                f"execution_context.json._dbs.{namespace} must be a non-empty array",
            )
        if any(not isinstance(row, dict) for row in rows):
            raise ReplayError(
                "invalid_schema",
                f"execution_context.json._dbs.{namespace} rows must be objects",
            )
    if not isinstance(root["trace_tool"], bool):
        raise ReplayError("invalid_schema", "execution_context.json.trace_tool must be boolean")
    if not isinstance(root["tool_augmentation_list"], list) or any(
        not isinstance(entry, str) for entry in root["tool_augmentation_list"]
    ):
        raise ReplayError(
            "invalid_schema",
            "execution_context.json.tool_augmentation_list must be a string array",
        )
    return first, root


def _normalized_number(value: Any, label: str) -> int | float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ReplayError("invalid_oracle_result", f"{label} must be numeric")
    number = float(value)
    if not math.isfinite(number):
        raise ReplayError("invalid_oracle_result", f"{label} must be finite")
    if number.is_integer():
        return int(number)
    return number


def _mapping(value: Any, label: str) -> dict[str, list[int | float]]:
    if not isinstance(value, Mapping):
        raise ReplayError("invalid_oracle_result", f"{label} must be a mapping")
    result: dict[str, list[int | float]] = {}
    for raw_key, raw_entry in value.items():
        if isinstance(raw_key, bool) or not isinstance(raw_key, int) or raw_key < 0:
            raise ReplayError("invalid_oracle_result", f"{label} owns an invalid node index")
        if not isinstance(raw_entry, (tuple, list)) or len(raw_entry) != 2:
            raise ReplayError("invalid_oracle_result", f"{label}[{raw_key}] must be a pair")
        snapshot_index = _normalized_number(raw_entry[0], f"{label}[{raw_key}][0]")
        # ToolSandbox uses -1 as the pre-user/no-match snapshot sentinel on
        # structurally valid trajectories that never contain a user turn.
        if not isinstance(snapshot_index, int) or snapshot_index < -1:
            raise ReplayError(
                "invalid_oracle_result",
                f"{label}[{raw_key}][0] must be an integer >= -1",
            )
        similarity = _normalized_number(raw_entry[1], f"{label}[{raw_key}][1]")
        if float(similarity) < 0 or float(similarity) > 1:
            raise ReplayError(
                "invalid_oracle_result",
                f"{label}[{raw_key}][1] must be within [0, 1]",
            )
        result[str(raw_key)] = [snapshot_index, similarity]
    return dict(sorted(result.items(), key=lambda entry: int(entry[0])))


def _import_pinned_tool_sandbox(checkout: Path) -> tuple[Any, Any, Any]:
    sys.path.insert(0, str(checkout))
    try:
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            import tool_sandbox  # type: ignore[import-not-found]
            from tool_sandbox.cli.utils import resolve_scenarios  # type: ignore[import-not-found]
            from tool_sandbox.common.execution_context import (  # type: ignore[import-not-found]
                ExecutionContext,
            )
            from tool_sandbox.common.tool_discovery import (  # type: ignore[import-not-found]
                ToolBackend,
            )
    except Exception as error:
        raise ReplayError("upstream_import_failed", "cannot import pinned ToolSandbox") from error
    package_file = Path(tool_sandbox.__file__).resolve(strict=True)
    try:
        package_file.relative_to(checkout)
    except ValueError as error:
        raise ReplayError(
            "upstream_import_substitution",
            "ToolSandbox imported outside the pinned checkout",
        ) from error
    return ExecutionContext, resolve_scenarios, ToolBackend


def _normalize_starting_context(
    value: Any,
    path: tuple[str | int, ...] = (),
) -> tuple[Any, frozenset[tuple[str | int, ...]], int]:
    """Replace only the pinned scenario's exact finite timestamp values.

    The marker is deliberately a JSON string, so a volatile timestamp cannot be
    confused with a real benchmark number after normalization. The explicit
    path set prevents an injected timestamp-named field from being normalized
    away. The three known schema-row nulls are retained and checked separately.
    """

    if isinstance(value, Mapping):
        normalized: dict[str, Any] = {}
        seen_timestamp_paths: set[tuple[str | int, ...]] = set()
        replacement_count = 0
        for raw_key, child in value.items():
            if not isinstance(raw_key, str):
                raise ReplayError(
                    "invalid_starting_context",
                    "pinned starting context contains a non-string object key",
                )
            child_path = (*path, raw_key)
            if "timestamp" in raw_key.casefold():
                seen_timestamp_paths.add(child_path)
                if child_path in EXPECTED_VOLATILE_TIMESTAMP_PATHS:
                    if (
                        isinstance(child, bool)
                        or not isinstance(child, (int, float))
                        or (isinstance(child, float) and not math.isfinite(child))
                    ):
                        raise ReplayError(
                            "scenario_starting_context_mismatch",
                            "pinned volatile timestamp path is not a finite number",
                        )
                    normalized[raw_key] = VOLATILE_TIMESTAMP_VALUE_MARKER
                    replacement_count += 1
                    continue
                if child_path in EXPECTED_NULL_TIMESTAMP_PATHS:
                    if child is not None:
                        raise ReplayError(
                            "scenario_starting_context_mismatch",
                            "pinned schema-row timestamp path is not null",
                        )
                    normalized[raw_key] = None
                    continue
                raise ReplayError(
                    "scenario_starting_context_mismatch",
                    "pinned starting context contains an unexpected timestamp path",
                )
            normalized_child, child_paths, child_count = _normalize_starting_context(
                child,
                child_path,
            )
            normalized[raw_key] = normalized_child
            seen_timestamp_paths.update(child_paths)
            replacement_count += child_count
        return normalized, frozenset(seen_timestamp_paths), replacement_count
    if isinstance(value, (list, tuple)):
        normalized_items: list[Any] = []
        seen_timestamp_paths: set[tuple[str | int, ...]] = set()
        replacement_count = 0
        for index, child in enumerate(value):
            normalized_child, child_paths, child_count = _normalize_starting_context(
                child,
                (*path, index),
            )
            normalized_items.append(normalized_child)
            seen_timestamp_paths.update(child_paths)
            replacement_count += child_count
        return normalized_items, frozenset(seen_timestamp_paths), replacement_count
    if value is None or isinstance(value, (bool, int, float, str)):
        return value, frozenset(), 0
    raise ReplayError(
        "invalid_starting_context",
        "pinned starting context contains a non-JSON value",
    )


def _starting_context_binding(scenario: Any) -> dict[str, Any]:
    try:
        serialized = scenario.starting_context.to_dict(serialize_console=False)
    except Exception as error:
        raise ReplayError(
            "starting_context_serialization_failed",
            "cannot serialize the pinned scenario starting context",
        ) from error
    # Force all StrEnum and other JSON-compatible scalar subclasses through the
    # same canonical JSON representation that is ultimately hashed.
    serialized_round_trip = _record(
        _parse_json_bytes(
            _canonical_json(serialized).encode("utf-8"),
            "pinned starting context",
        ),
        "pinned starting context",
    )
    databases = _record(
        serialized_round_trip.get("_dbs"),
        "pinned starting context._dbs",
    )
    sandbox_rows = databases.get("SANDBOX")
    if (
        not isinstance(sandbox_rows, list)
        or len(sandbox_rows) != EXPECTED_STARTING_SANDBOX_ROW_COUNT
    ):
        raise ReplayError(
            "scenario_starting_context_mismatch",
            "pinned starting context SANDBOX row count changed",
        )
    normalized, seen_timestamp_paths, replacement_count = _normalize_starting_context(
        serialized_round_trip,
    )
    expected_timestamp_paths = (
        EXPECTED_VOLATILE_TIMESTAMP_PATHS | EXPECTED_NULL_TIMESTAMP_PATHS
    )
    if seen_timestamp_paths != expected_timestamp_paths:
        raise ReplayError(
            "scenario_starting_context_mismatch",
            "pinned starting context timestamp path set changed",
        )
    normalized_sha256 = _sha256_json(normalized)
    if replacement_count != EXPECTED_VOLATILE_TIMESTAMP_VALUE_COUNT:
        raise ReplayError(
            "scenario_starting_context_mismatch",
            "pinned starting context volatile timestamp count changed",
        )
    if normalized_sha256 != EXPECTED_NORMALIZED_STARTING_CONTEXT_SHA256:
        raise ReplayError(
            "scenario_starting_context_mismatch",
            "pinned normalized starting context changed",
        )
    return {
        "normalizationRuleId": STARTING_CONTEXT_NORMALIZATION_RULE_ID,
        "normalizedContextSha256": normalized_sha256,
        "volatileTimestampValueCount": replacement_count,
    }


def _replay(
    checkout: Path,
    serialized_context: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    ExecutionContext, resolve_scenarios, ToolBackend = _import_pinned_tool_sandbox(checkout)
    try:
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            random.seed(42)
            scenarios = resolve_scenarios(
                desired_scenario_names=[SCENARIO],
                preferred_tool_backend=ToolBackend.DEFAULT,
            )
            scenario = scenarios[SCENARIO]
    except Exception as error:
        raise ReplayError("scenario_resolution_failed", "cannot resolve pinned scenario") from error

    milestone_matcher = scenario.evaluation.milestone_matcher
    minefield_matcher = scenario.evaluation.minefield_matcher
    milestone_edges = tuple(tuple(edge) for edge in milestone_matcher.edge_list)
    minefield_edges = tuple(tuple(edge) for edge in minefield_matcher.edge_list)
    if (
        scenario.max_messages != EXPECTED_MAX_MESSAGES
        or len(milestone_matcher.milestones) != EXPECTED_MILESTONE_COUNT
        or milestone_edges != EXPECTED_MILESTONE_EDGES
        or len(minefield_matcher.milestones) != EXPECTED_MINEFIELD_COUNT
        or minefield_edges != EXPECTED_MINEFIELD_EDGES
    ):
        raise ReplayError("scenario_definition_mismatch", "resolved scenario is not the pinned oracle")
    starting_context = _starting_context_binding(scenario)

    try:
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            execution_context = ExecutionContext.from_dict(serialized_context)
            evaluation = scenario.evaluation.evaluate(
                execution_context=execution_context,
                max_turn_count=scenario.max_messages,
            )
    except Exception as error:
        raise ReplayError("oracle_replay_failed", "pinned oracle could not evaluate context") from error

    milestone_mapping = _mapping(evaluation.milestone_mapping, "milestoneMapping")
    minefield_mapping = _mapping(evaluation.minefield_mapping, "minefieldMapping")
    similarity = _normalized_number(evaluation.similarity, "similarity")
    milestone_similarity = _normalized_number(
        evaluation.milestone_similarity,
        "milestoneSimilarity",
    )
    minefield_similarity = _normalized_number(
        evaluation.minefield_similarity,
        "minefieldSimilarity",
    )
    turn_count = _normalized_number(evaluation.turn_count, "turnCount")
    if not isinstance(turn_count, int) or turn_count < 0:
        raise ReplayError("invalid_oracle_result", "turnCount must be a non-negative integer")

    expected_milestone_keys = {str(index) for index in range(EXPECTED_MILESTONE_COUNT)}
    all_milestones_present = set(milestone_mapping) == expected_milestone_keys
    all_milestones_exact = all_milestones_present and all(
        entry[1] == 1 for entry in milestone_mapping.values()
    )
    no_minefield_matches = len(minefield_mapping) == 0
    rule_inputs = {
        "allMilestonesExact": all_milestones_exact,
        "allMilestonesPresent": all_milestones_present,
        "expectedMilestoneCount": EXPECTED_MILESTONE_COUNT,
        "expectedMinefieldCount": EXPECTED_MINEFIELD_COUNT,
        "milestoneSimilarity": milestone_similarity,
        "minefieldSimilarity": minefield_similarity,
        "noMinefieldMatches": no_minefield_matches,
        "observedMilestoneCount": len(milestone_mapping),
        "observedMinefieldCount": len(minefield_mapping),
        "similarity": similarity,
    }
    strict_task_success = (
        similarity == 1
        and milestone_similarity == 1
        and minefield_similarity == 0
        and all_milestones_exact
        and no_minefield_matches
    )
    oracle = {
        "maxTurnCount": scenario.max_messages,
        "metrics": {
            "milestoneSimilarity": milestone_similarity,
            "minefieldSimilarity": minefield_similarity,
            "similarity": similarity,
            "turnCount": turn_count,
        },
        "milestoneMapping": milestone_mapping,
        "minefieldMapping": minefield_mapping,
        "strictTaskSuccessRule": {
            "inputs": rule_inputs,
            "result": strict_task_success,
            "ruleId": "pm.public-eval.toolsandbox-strict-task-success.v1",
        },
    }
    return oracle, starting_context


def _run() -> dict[str, Any]:
    config = _read_input()
    checkout = _absolute_directory(config["checkoutPath"], "config.checkoutPath")
    context_path = _absolute_regular_file(
        config["executionContextPath"],
        "config.executionContextPath",
    )
    _verify_clean_checkout(checkout)
    context_bytes, serialized_context = _read_execution_context(context_path)
    oracle, starting_context = _replay(checkout, serialized_context)
    script_path = Path(__file__).resolve(strict=True)
    script_bytes = script_path.read_bytes()
    body = {
        "schemaVersion": RECEIPT_SCHEMA,
        "benchmark": {
            "repositoryUrl": REPOSITORY_URL,
            "revision": PINNED_REVISION,
            "scenario": SCENARIO,
            "treeHash": PINNED_TREE,
        },
        "bindings": {
            "executionContextByteLength": len(context_bytes),
            "executionContextSha256": _sha256_bytes(context_bytes),
            "replayScriptByteLength": len(script_bytes),
            "replayScriptSha256": _sha256_bytes(script_bytes),
        },
        "startingContext": starting_context,
        "oracle": oracle,
    }
    return {**body, "receiptHash": _sha256_json(body)}


def _fail(error: ReplayError) -> NoReturn:
    payload = {"code": error.code, "message": str(error)}
    print(ERROR_PREFIX + _canonical_json(payload), file=sys.stderr)
    raise SystemExit(2)


def main() -> None:
    try:
        receipt = _run()
    except ReplayError as error:
        _fail(error)
    except Exception:
        _fail(ReplayError("unexpected_failure", "oracle replay failed closed"))
    print(RECEIPT_PREFIX + _canonical_json(receipt))


if __name__ == "__main__":
    main()
