/**
 * First registered adapters (decision chk_565b7eb9): pi harness and canary.
 *
 * These are DATA, not imports — the substrate never links against the tools.
 * Contracts are expressed generically (no app-specific vocabulary) and pinned
 * to the exact commits already reviewed in the owner's app checkout; the
 * `derivedFrom` note records that provenance. Liquid joins as a
 * `mapping_proposer` the moment its repo location is supplied
 * (decision-needed chk_e21b8d6b).
 */

import type { ExternalAdapterContract } from "./adapter-registry.js";

/** Pi (earendil-works/pi): external agent runtime run under substrate gates. */
export const PI_HARNESS_ADAPTER: ExternalAdapterContract = {
  id: "pi_harness",
  name: "Pi harness",
  adapterType: "agent_harness",
  boundary: "containerized_process",
  purpose:
    "Execute external agent loops against approved task contracts while the substrate retains tenant, capability, approval, and evidence gates.",
  capabilities: [
    "orchestrator_spawn",
    "rpc_command_execution",
    "multi_provider_llm",
    "tool_calling",
    "agent_event_stream",
    "before_tool_call_gate",
    "after_tool_call_audit",
    "session_tree",
    "session_branching",
    "context_compaction",
    "subagent_delegation",
  ],
  inputContracts: [
    "task_contract",
    "approval_payload_hash",
    "capability_grant",
    "tenant_context",
    "evidence_snapshot",
  ],
  outputArtifacts: [
    "agent_session_tree",
    "agent_event_stream",
    "tool_call_log",
    "session_jsonl",
    "proposed_mutations",
    "next_action_proposal",
  ],
  requiredGates: [
    "tenant_rls",
    "capability_gate",
    "approval_payload_hash",
    "sandbox_boundary",
    "durable_event_hash",
  ],
  evidenceFields: [
    "instance_id",
    "session_id",
    "turn_id",
    "tool_call_hash",
    "tool_result_hash",
    "approval_payload_hash",
    "output_payload_hash",
  ],
  source: {
    url: "https://github.com/earendil-works/pi",
    commit: "e285e90fdbf9b05934ce90168156e2aa511d9a7c",
  },
  notes: {
    derivedFrom:
      "plugged_in_social/backend/app/services/external_adapter_contracts.py (reviewed 2026-07-06)",
  },
};

/** Canary (LopeWale/canary): sandboxed browser-intelligence missions. */
export const CANARY_ADAPTER: ExternalAdapterContract = {
  id: "canary_web_inspector",
  name: "Canary Web Inspector",
  adapterType: "browser_qa_harness",
  boundary: "sandboxed_process",
  purpose:
    "Run browser intelligence missions (debugging, funnel/SEO/copy audits, walkthrough recording, post-change verification) against external sites with no direct state mutation.",
  capabilities: [
    "site_debugging",
    "conversion_funnel_audit",
    "seo_inspection",
    "copy_review",
    "competitor_frontend_research",
    "walkthrough_recording",
    "post_change_verification",
    "browser_replay",
    "playwright_script_capture",
    "trace_capture",
    "network_har_capture",
    "console_log_capture",
    "self_contained_report",
  ],
  inputContracts: [
    "mission_spec",
    "inspection_questions",
    "target_url",
    "allowed_browser_actions",
    "auth_context_ref",
  ],
  outputArtifacts: [
    "results_manifest",
    "walkthrough_recording",
    "har_capture",
    "console_logs",
    "step_screenshots",
  ],
  requiredGates: ["tenant_rls", "sandbox_boundary", "allowed_actions_gate"],
  evidenceFields: [
    "mission_id",
    "session_id",
    "step_hashes",
    "artifact_hashes",
  ],
  source: {
    url: "https://github.com/LopeWale/canary",
    commit: "36a29a052987aec11815422bd774368412e92b08",
  },
  notes: {
    derivedFrom:
      "plugged_in_social/backend/app/services/external_adapter_contracts.py (reviewed 2026-07-06)",
  },
};

export const KNOWN_EXTERNAL_ADAPTERS: readonly ExternalAdapterContract[] = [
  PI_HARNESS_ADAPTER,
  CANARY_ADAPTER,
];
