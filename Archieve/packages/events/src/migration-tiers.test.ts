import { readdirSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../../..");
const CORE_DIR = resolve(ROOT, "db/migrations");
const PROVENANCE_DIR = resolve(ROOT, "db/migrations-provenance");

const sqlFiles = (directory: string): string[] =>
  readdirSync(directory)
    .filter((filename) => filename.endsWith(".sql") && !filename.startsWith("._"))
    .sort();

const migrationNumber = (filename: string): number =>
  Number.parseInt(filename.slice(0, 4), 10);

describe("core/provenance migration boundary", () => {
  it("keeps quarantined agent-state migrations out of the default core tier", () => {
    const core = sqlFiles(CORE_DIR);
    const provenance = sqlFiles(PROVENANCE_DIR);
    const provenanceNumbers = provenance.map(migrationNumber);

    expect(provenance.length).toBeGreaterThan(0);
    expect(core.filter((filename) => filename.includes("_agent_state_"))).toEqual(
      [],
    );
    expect(
      core.filter((filename) => {
        const number = migrationNumber(filename);
        return number >= 24 && number <= 146;
      }),
    ).toEqual([]);
    expect(
      provenance.filter((filename) => !filename.includes("_agent_state_")),
    ).toEqual([]);
    expect(Math.min(...provenanceNumbers)).toBe(24);
    expect(Math.max(...provenanceNumbers)).toBe(146);
  });

  it("never presents the same migration filename from both tiers", () => {
    const core = new Set(sqlFiles(CORE_DIR));
    const overlap = sqlFiles(PROVENANCE_DIR).filter((filename) =>
      core.has(filename),
    );

    expect(overlap).toEqual([]);
  });
});

