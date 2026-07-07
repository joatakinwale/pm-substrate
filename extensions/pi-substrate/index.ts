/**
 * pi-substrate — the Pi-harness integration (adapter `pi_harness` in the
 * substrate registry; runtime lane of the contract).
 *
 * Pi has NO MCP by design — its native seam is extensions. This extension
 * gives any Pi agent the substrate's session discipline as first-class
 * tools, each shelling to the SAME CLIs the dev loop uses (process
 * boundary; no imports; governed-by-default semantics ride along):
 *
 *   - substrate_resume     session-start briefing from the continuity
 *                          ledger — call FIRST, never trust chat memory
 *   - substrate_checkpoint governed write: observe → propose → admit; a
 *                          stale basis BLOCKS (exit 3) and the tool tells
 *                          the agent to re-observe — the gate, not advice
 *   - substrate_status     the five-questions control plane, as text
 *
 * Usage (owner machine):
 *   pi -e /path/to/pm-substrate/extensions/pi-substrate/index.ts
 *   # or `pi install <source>` per Pi packaging docs
 *
 * Env: PM_SUBSTRATE_DIR (repo root; default $PWD), PM_DATABASE_URL
 * (required), PM_DEV_TENANT_ID / PM_DEV_AGENT_ID / PM_DEV_SCOPE optional —
 * set PM_DEV_AGENT_ID per agent so each Pi agent extends its own chain.
 *
 * Tool-call governance (the contract's before_tool_call_gate /
 * after_tool_call_audit), shadow-first per hard req 5:
 *
 *   - SHADOW (default): every tool call is audited in memory and flushed
 *     at agent_end as ONE governed checkpoint — the "what the agent did"
 *     evidence trail with per-tool counts and a content hash per call.
 *     Zero behavior change, zero per-call latency.
 *   - BLOCK (PM_PI_GATE=block): additionally refuses denylisted tool
 *     calls at the seam (`{ block: true, reason }`) and records the
 *     refusal in the same trail. Deny rules: PM_PI_DENY as
 *     comma-separated `tool` or `tool:substring` entries
 *     (e.g. "write,bash:rm -rf").
 */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const SUBSTRATE_DIR = process.env["PM_SUBSTRATE_DIR"] ?? process.cwd();
const TIMEOUT_MS = 60_000;

function runDevSession(
  args: readonly string[],
): Promise<{ output: string; code: number }> {
  return new Promise((resolve) => {
    execFile(
      "npx",
      ["tsx", "scripts/dev-session.ts", ...args],
      { cwd: SUBSTRATE_DIR, timeout: TIMEOUT_MS, env: process.env },
      (error, stdout, stderr) => {
        const code =
          error && typeof (error as { code?: unknown }).code === "number"
            ? ((error as { code: number }).code ?? 1)
            : error
              ? 1
              : 0;
        resolve({ output: `${stdout}${stderr}`.trim(), code });
      },
    );
  });
}

const text = (value: string) => ({
  content: [{ type: "text" as const, text: value }],
});

interface ToolCallAudit {
  readonly toolName: string;
  readonly toolCallId: string;
  readonly inputHash: string;
  readonly at: string;
  readonly blocked?: string;
}

function parseDenyRules(): readonly { tool: string; substring?: string }[] {
  return (process.env["PM_PI_DENY"] ?? "")
    .split(",")
    .map((raw) => raw.trim())
    .filter((raw) => raw.length > 0)
    .map((raw) => {
      const i = raw.indexOf(":");
      return i === -1
        ? { tool: raw }
        : { tool: raw.slice(0, i), substring: raw.slice(i + 1) };
    });
}

export default function (pi: ExtensionAPI) {
  const gateMode = process.env["PM_PI_GATE"] === "block" ? "block" : "shadow";
  const denyRules = parseDenyRules();
  const audits: ToolCallAudit[] = [];
  let flushed = false;

  console.error(
    `[pi-substrate] loaded — substrate at ${SUBSTRATE_DIR} (governed writes default, tool gate: ${gateMode})`,
  );

  // before_tool_call_gate / after_tool_call_audit — shadow-first.
  pi.on(
    "tool_call",
    async (event: { toolName: string; toolCallId: string; input: unknown }) => {
      const inputHash = createHash("sha256")
        .update(JSON.stringify(event.input ?? null))
        .digest("hex")
        .slice(0, 16);
      const entry: ToolCallAudit = {
        toolName: event.toolName,
        toolCallId: event.toolCallId,
        inputHash,
        at: new Date().toISOString(),
      };
      if (gateMode === "block") {
        const inputText = JSON.stringify(event.input ?? "");
        const hit = denyRules.find(
          (r) =>
            r.tool === event.toolName &&
            (r.substring === undefined || inputText.includes(r.substring)),
        );
        if (hit) {
          const reason = `pm-substrate gate: tool "${event.toolName}" denied${hit.substring ? ` (matched "${hit.substring}")` : ""}`;
          audits.push({ ...entry, blocked: reason });
          return { block: true, reason };
        }
      }
      audits.push(entry);
      return undefined;
    },
  );

  // after_tool_call_audit: flush ONE governed checkpoint per agent run.
  pi.on("agent_end", async () => {
    if (flushed || audits.length === 0) return;
    flushed = true;
    const counts = new Map<string, number>();
    for (const a of audits) {
      counts.set(a.toolName, (counts.get(a.toolName) ?? 0) + 1);
    }
    const blocked = audits.filter((a) => a.blocked !== undefined);
    const summary =
      `Pi tool-call audit (${gateMode} mode): ${audits.length} calls — ` +
      [...counts.entries()].map(([t, n]) => `${t}:${n}`).join(", ") +
      (blocked.length > 0
        ? `; BLOCKED ${blocked.length}: ${blocked
            .map((b) => `${b.toolName}#${b.inputHash}`)
            .join(", ")}`
        : "; none blocked") +
      `. Call hashes: ${audits
        .slice(0, 20)
        .map((a) => `${a.toolName}#${a.inputHash}`)
        .join(" ")}${audits.length > 20 ? " …" : ""}`;
    const { output, code } = await runDevSession([
      "checkpoint",
      "--",
      "--kind",
      "research",
      "--title",
      `Pi session tool-call audit (${audits.length} calls)`,
      "--summary",
      summary,
    ]);
    console.error(
      code === 0
        ? `[pi-substrate] audit flushed: ${output.split("\n").pop() ?? ""}`
        : `[pi-substrate] audit flush failed (${code}): ${output.slice(0, 200)}`,
    );
  });

  pi.registerTool({
    name: "substrate_resume",
    description:
      "Session-start briefing from the pm-substrate continuity ledger (last handoff, open work, standing decisions, lessons) — hash-chain verified. Call this FIRST in every session; never reconstruct state from chat memory.",
    parameters: Type.Object({}),
    async execute() {
      const { output } = await runDevSession(["resume"]);
      return text(output);
    },
  });

  pi.registerTool({
    name: "substrate_checkpoint",
    description:
      "Record a governed checkpoint (work/decision/lesson/research/claim/handoff) through the substrate's gate: observe → propose → admit. If the basis is stale the write is BLOCKED — re-run substrate_resume and re-propose from fresh state. Close work items with status=closed.",
    parameters: Type.Object({
      kind: Type.Union(
        [
          Type.Literal("work"),
          Type.Literal("decision"),
          Type.Literal("lesson"),
          Type.Literal("research"),
          Type.Literal("claim"),
          Type.Literal("handoff"),
        ],
        { description: "Checkpoint kind" },
      ),
      title: Type.String({ description: "Short stable title" }),
      summary: Type.String({ description: "What/why — the next session reads this" }),
      status: Type.Optional(
        Type.Union([Type.Literal("open"), Type.Literal("closed")], {
          description: "Work-item status",
        }),
      ),
    }),
    async execute(_id, params: { kind: string; title: string; summary: string; status?: string }) {
      const args = [
        "checkpoint",
        "--",
        "--kind",
        params.kind,
        "--title",
        params.title,
        "--summary",
        params.summary,
      ];
      if (params.status) args.push("--status", params.status);
      const { output, code } = await runDevSession(args);
      if (code === 3) {
        return text(
          `BLOCKED by the gate (stale/conflicted basis):\n${output}\n\nRe-run substrate_resume, then propose again from the fresh state.`,
        );
      }
      if (code !== 0) return text(`substrate_checkpoint failed (${code}):\n${output}`);
      return text(output);
    },
  });

  pi.registerTool({
    name: "substrate_status",
    description:
      "pm-substrate control plane (five questions from the admitted log): open work, governance activity, token costs, results, integrity.",
    parameters: Type.Object({}),
    async execute() {
      const { output } = await runDevSession(["status"]);
      return text(output);
    },
  });
}
