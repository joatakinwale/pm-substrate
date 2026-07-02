import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

import {
  reviewArrowHedgeRunEnvelopeOffline,
  type ArrowHedgeRunEnvelopeOfflineReview,
} from "../packages/capability-finance-research-ingest/src/arrowhedge.js";
import { FINANCE_RESEARCH_PROFILE } from "../packages/profile-finance-research/src/profile.js";
import { tenantId as tenantIdValue, timestamp } from "../packages/types/src/index.js";

export interface ReviewArrowHedgeEnvelopeFileInput {
  readonly envelopePath: string;
  readonly outPath: string;
  readonly tenantId: string;
  readonly adapterStartedAt?: string;
}

export async function reviewArrowHedgeEnvelopeFile(
  input: ReviewArrowHedgeEnvelopeFileInput,
): Promise<ArrowHedgeRunEnvelopeOfflineReview> {
  const envelope = JSON.parse(readFileSync(input.envelopePath, "utf8")) as unknown;
  const review = await reviewArrowHedgeRunEnvelopeOffline(envelope, {
    tenantId: tenantIdValue(input.tenantId),
    profile: FINANCE_RESEARCH_PROFILE,
    adapterStartedAt: timestamp(
      input.adapterStartedAt ?? new Date().toISOString(),
    ),
  });
  mkdirSync(dirname(input.outPath), { recursive: true });
  writeFileSync(input.outPath, `${JSON.stringify(review, null, 2)}\n`, "utf8");
  return review;
}

function parseArgs(argv: readonly string[]): ReviewArrowHedgeEnvelopeFileInput {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error(
        "usage: tsx scripts/review-arrowhedge-envelope-offline.ts --envelope <path> --out <path> --tenant <tenant-id> [--adapter-started-at <iso>]",
      );
    }
    args.set(key, value);
  }

  const envelopePath = args.get("--envelope");
  const outPath = args.get("--out");
  const tenantId = args.get("--tenant");
  if (!envelopePath || !outPath || !tenantId) {
    throw new Error("--envelope, --out, and --tenant are required");
  }

  return {
    envelopePath,
    outPath,
    tenantId,
    ...(args.has("--adapter-started-at")
      ? { adapterStartedAt: args.get("--adapter-started-at")! }
      : {}),
  };
}

async function main(): Promise<void> {
  const review = await reviewArrowHedgeEnvelopeFile(parseArgs(process.argv.slice(2)));
  console.log(
    JSON.stringify({
      valid: review.valid,
      snapshots: review.expanded.snapshots,
      blockedEventIds: review.ingested.blockedEventIds.length,
    }),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
