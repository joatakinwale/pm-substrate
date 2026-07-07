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
 * Follow-up lane (registered contract's before_tool_call_gate): Pi's
 * blockable `tool_call` event can require an admitted proposal per tool
 * call. Shadow-first doctrine says tools-only ships first.
 */

import { execFile } from "node:child_process";
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

export default function (pi: ExtensionAPI) {
  console.error(
    `[pi-substrate] loaded — substrate at ${SUBSTRATE_DIR} (governed writes default)`,
  );

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
