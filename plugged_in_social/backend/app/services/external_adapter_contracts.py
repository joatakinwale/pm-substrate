"""Shared external adapter contracts for autonomous agency orchestration."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


AdapterType = Literal["browser_qa_harness", "agent_harness"]
AdapterBoundary = Literal[
    "external_process",
    "sandboxed_process",
    "containerized_process",
    "hosted_service",
]

PI_HARNESS_ADAPTER_ID = "pi_harness"

EXTERNAL_ADAPTER_ALIASES = {
    "agent_harness": PI_HARNESS_ADAPTER_ID,
}


def canonical_external_adapter_id(adapter_id: str) -> str:
    normalized = adapter_id.strip()
    return EXTERNAL_ADAPTER_ALIASES.get(normalized, normalized)


@dataclass(frozen=True, slots=True)
class ExternalAdapterContract:
    id: str
    name: str
    adapter_type: AdapterType
    boundary: AdapterBoundary
    description: str
    purpose: str
    capabilities: tuple[str, ...]
    input_contracts: tuple[str, ...]
    output_artifacts: tuple[str, ...]
    required_gates: tuple[str, ...]
    evidence_fields: tuple[str, ...]
    source_url: str
    source_commit: str
    compatible_protocols: tuple[str, ...]
    runner_commands: tuple[str, ...] = ()
    provider_packages: tuple[str, ...] = ()
    required_event_types: tuple[str, ...] = ()
    required_result_shape: dict[str, Any] | None = None
    notes: dict[str, Any] = field(default_factory=dict)

    def strategy_requirement(self) -> dict[str, Any]:
        return {
            "adapter_id": self.id,
            "purpose": self.purpose,
            "adapter_source": {
                "source_url": self.source_url,
                "source_commit": self.source_commit,
            },
            "compatible_protocols": list(self.compatible_protocols),
            "runner_commands": list(self.runner_commands),
            "required_event_types": list(self.required_event_types),
            "required_result_shape": self.required_result_shape,
            "input_contracts": list(self.input_contracts),
            "expected_output_artifacts": list(self.output_artifacts),
            "required_gates": list(self.required_gates),
            "required_evidence_fields": list(self.evidence_fields),
        }


EXTERNAL_ADAPTER_CONTRACTS: tuple[ExternalAdapterContract, ...] = (
    ExternalAdapterContract(
        id="browser_qa_harness",
        name="Browser QA harness",
        adapter_type="browser_qa_harness",
        boundary="sandboxed_process",
        description=(
            "Runs external browser verification flows and returns reproducible "
            "evidence artifacts without direct PluggedInSocial state mutation."
        ),
        purpose="client_platform_and_market_research",
        capabilities=(
            "affected_flow_detection",
            "browser_replay",
            "playwright_script_capture",
            "canary_session_lifecycle",
            "quickjs_sandboxed_playwright",
            "trace_capture",
            "network_har_capture",
            "console_log_capture",
            "self_contained_report",
        ),
        input_contracts=(
            "git_diff",
            "operator_flow_prompt",
            "target_url",
            "auth_context_ref",
            "canary_session_start",
            "canary_execute_step",
            "canary_session_end",
        ),
        output_artifacts=(
            "session_manifest",
            "results_json",
            "report_html",
            "playwright_script",
            "trace_zip",
            "network_har",
            "console_log",
            "screen_recording",
            "step_screenshots",
        ),
        required_gates=(
            "tenant_rls",
            "approval_payload_hash",
            "evidence_hash_gate",
            "no_secret_exfiltration",
        ),
        evidence_fields=(
            "session_id",
            "session_phase",
            "run_count",
            "artifact_manifest_path",
            "artifact_payload_hash",
            "report_uri",
            "trace_uri",
            "har_uri",
            "report_html_hash",
            "playwright_script_hash",
            "trace_zip_hash",
            "network_har_hash",
            "console_log_hash",
            "screenshot_hashes",
            "console_error_count",
        ),
        source_url="https://github.com/LopeWale/canary",
        source_commit="36a29a052987aec11815422bd774368412e92b08",
        compatible_protocols=(
            "canary.session-start",
            "canary.execute",
            "canary.session-end",
        ),
        runner_commands=(
            "canary session start",
            "canary run",
            "canary session end",
            "canary-browser",
        ),
        required_result_shape={
            "session": [
                "sessionId",
                "phase",
                "runCount",
                "artifactsDir",
            ],
            "artifacts": ["kind", "path", "bytes"],
            "artifact_kinds": [
                "trace",
                "video",
                "har",
                "console",
                "screenshot",
            ],
        },
        notes={
            "inspired_by": "canary",
            "coupling": "adapter_contract_only",
        },
    ),
    ExternalAdapterContract(
        id=PI_HARNESS_ADAPTER_ID,
        name="Pi harness",
        adapter_type="agent_harness",
        boundary="containerized_process",
        description=(
            "Executes Pi external agent loops against approved task contracts while "
            "PluggedInSocial retains tenant, capability, approval, and evidence gates."
        ),
        purpose="repository_context_review",
        capabilities=(
            "pi_harness_embedding",
            "pi_orchestrator_spawn",
            "pi_rpc_command_execution",
            "multi_provider_llm",
            "tool_calling",
            "agent_event_stream",
            "before_tool_call_gate",
            "after_tool_call_audit",
            "parallel_tool_execution",
            "agent_loop_state",
            "session_tree",
            "session_branching",
            "context_compaction",
            "queue_drain_modes",
            "json_mode",
            "rpc_mode",
            "sdk_embedding",
            "extension_packages",
        ),
        input_contracts=(
            "virtual_agency_task",
            "approval_payload_hash",
            "capability_grant",
            "tenant_context",
            "evidence_snapshot",
            "pi_spawn_request",
            "pi_rpc_command",
            "agent_event_stream",
        ),
        output_artifacts=(
            "agent_session_tree",
            "agent_event_stream",
            "tool_call_log",
            "tool_execution_events",
            "session_jsonl",
            "compaction_summary",
            "proposed_mutations",
            "artifact_payload",
            "next_action_proposal",
        ),
        required_gates=(
            "tenant_rls",
            "capability_gate",
            "approval_payload_hash",
            "content_hash_gate",
            "sandbox_boundary",
            "durable_event_hash",
        ),
        evidence_fields=(
            "instance_id",
            "session_id",
            "session_file",
            "agent_event_hash",
            "turn_id",
            "tool_call_id",
            "tool_call_hash",
            "tool_result_hash",
            "rpc_command_hash",
            "state_ref",
            "approval_payload_hash",
            "output_payload_hash",
        ),
        source_url="https://github.com/earendil-works/pi",
        source_commit="e285e90fdbf9b05934ce90168156e2aa511d9a7c",
        compatible_protocols=(
            "pi.orchestrator.spawn",
            "pi.orchestrator.rpc",
            "pi.agent_event_stream",
        ),
        runner_commands=(
            "pi orchestrator spawn",
            "pi rpc",
            "pi agent events",
        ),
        provider_packages=(
            "@earendil-works/pi-agent-core",
            "@earendil-works/pi-coding-agent",
            "@earendil-works/pi-ai",
        ),
        required_event_types=(
            "agent_start",
            "turn_start",
            "message_start",
            "message_end",
            "tool_execution_start",
            "tool_execution_end",
            "turn_end",
            "agent_end",
        ),
        notes={
            "inspired_by": "pi",
            "coupling": "adapter_contract_only",
            "aliases": ("agent_harness",),
            "security": (
                "External harnesses without built-in permission systems must run "
                "behind PluggedInSocial gates and a containerized boundary."
            ),
        },
    ),
)


def list_external_adapter_contracts() -> list[ExternalAdapterContract]:
    return list(EXTERNAL_ADAPTER_CONTRACTS)


def get_external_adapter_contract(
    adapter_id: str,
) -> ExternalAdapterContract | None:
    canonical_id = canonical_external_adapter_id(adapter_id)
    return next(
        (
            contract
            for contract in EXTERNAL_ADAPTER_CONTRACTS
            if contract.id == canonical_id
        ),
        None,
    )


def external_adapter_strategy_requirement(adapter_id: str) -> dict[str, Any] | None:
    contract = get_external_adapter_contract(adapter_id)
    if contract is None:
        return None
    return contract.strategy_requirement()
