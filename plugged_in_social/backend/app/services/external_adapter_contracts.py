"""Shared external adapter contracts for autonomous agency orchestration."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal


AdapterType = Literal["browser_qa_harness", "agent_harness"]
AdapterBoundary = Literal[
    "external_process",
    "sandboxed_process",
    "containerized_process",
    "hosted_service",
]


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
    notes: dict[str, Any]

    def strategy_requirement(self) -> dict[str, Any]:
        return {
            "adapter_id": self.id,
            "purpose": self.purpose,
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
        notes={
            "inspired_by": "canary",
            "coupling": "adapter_contract_only",
            "source": "https://github.com/LopeWale/canary",
            "compatible_protocols": [
                "canary.session-start",
                "canary.execute",
                "canary.session-end",
            ],
            "required_result_shape": {
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
        },
    ),
    ExternalAdapterContract(
        id="agent_harness",
        name="External agent harness",
        adapter_type="agent_harness",
        boundary="containerized_process",
        description=(
            "Executes external agent loops against approved task contracts while "
            "PluggedInSocial retains tenant, capability, approval, and evidence gates."
        ),
        purpose="repository_context_review",
        capabilities=(
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
        notes={
            "inspired_by": "pi",
            "coupling": "adapter_contract_only",
            "source": "https://github.com/earendil-works/pi",
            "compatible_protocols": [
                "pi.orchestrator.spawn",
                "pi.orchestrator.rpc",
                "pi.agent_event_stream",
            ],
            "required_event_types": [
                "agent_start",
                "turn_start",
                "message_start",
                "message_end",
                "tool_execution_start",
                "tool_execution_end",
                "turn_end",
                "agent_end",
            ],
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
    return next(
        (
            contract
            for contract in EXTERNAL_ADAPTER_CONTRACTS
            if contract.id == adapter_id
        ),
        None,
    )


def external_adapter_strategy_requirement(adapter_id: str) -> dict[str, Any] | None:
    contract = get_external_adapter_contract(adapter_id)
    if contract is None:
        return None
    return contract.strategy_requirement()
