#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const deployScript = read("scripts/deploy.sh");
const queueProducerSource = read("workers/queue-producer/src/index.ts");
const queueProducerConfig = read("workers/queue-producer/wrangler.toml");
const virtualAgencyConfig = read("workers/virtual-agency/wrangler.toml");

const queues = extractBashArray(deployScript, "QUEUES");
const workers = extractBashArray(deployScript, "WORKERS");
const producerAllowList = extractQueueAllowList(queueProducerSource);
const producerQueues = new Set(
  parseTomlBlocks(queueProducerConfig, "queues.producers").map((item) => item.queue),
);
const productionProducerQueues = new Set(
  parseTomlBlocks(queueProducerConfig, "env.production.queues.producers").map(
    (item) => item.queue,
  ),
);
const stagingProducerQueues = new Set(
  parseTomlBlocks(queueProducerConfig, "env.staging.queues.producers").map(
    (item) => item.queue,
  ),
);
const virtualAgencyConsumers = parseTomlBlocks(
  virtualAgencyConfig,
  "queues.consumers",
);
const productionVirtualAgencyConsumers = parseTomlBlocks(
  virtualAgencyConfig,
  "env.production.queues.consumers",
);
const stagingVirtualAgencyConsumers = parseTomlBlocks(
  virtualAgencyConfig,
  "env.staging.queues.consumers",
);

const failures = [];

requireWorker(workers, "queue-producer");
requireWorker(workers, "virtual-agency");
for (const worker of workers) {
  if (!existsSync(resolve(root, "workers", worker, "wrangler.toml"))) {
    failures.push(`worker ${worker} is in deploy.sh but has no wrangler.toml`);
  }
}

for (const queue of queues) {
  const binding = producerAllowList.get(queue);
  if (binding === undefined) {
    failures.push(`queue-producer allow-list missing ${queue}`);
  }
  if (!producerQueues.has(queue)) {
    failures.push(`queue-producer dev wrangler missing producer queue ${queue}`);
  }
  if (!productionProducerQueues.has(`${queue}-production`)) {
    failures.push(`queue-producer production wrangler missing ${queue}-production`);
  }
  if (!stagingProducerQueues.has(`${queue}-staging`)) {
    failures.push(`queue-producer staging wrangler missing ${queue}-staging`);
  }
}

requireConsumer(virtualAgencyConsumers, {
  queue: "stevie-virtual-agency",
  deadLetterQueue: "stevie-virtual-agency-dlq",
  label: "dev",
});
requireConsumer(productionVirtualAgencyConsumers, {
  queue: "stevie-virtual-agency-production",
  deadLetterQueue: "stevie-virtual-agency-production-dlq",
  label: "production",
});
requireConsumer(stagingVirtualAgencyConsumers, {
  queue: "stevie-virtual-agency-staging",
  deadLetterQueue: "stevie-virtual-agency-staging-dlq",
  label: "staging",
});

if (producerAllowList.get("stevie-virtual-agency") !== "QUEUE_VIRTUAL_AGENCY") {
  failures.push("stevie-virtual-agency must map to QUEUE_VIRTUAL_AGENCY");
}

if (failures.length > 0) {
  console.error("Deploy contract validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Deploy contract validation passed.");

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function extractBashArray(source, name) {
  const match = new RegExp(`^${name}=\\(([\\s\\S]*?)\\)`, "m").exec(source);
  if (match === null) {
    throw new Error(`Missing ${name} array in deploy.sh`);
  }
  return match[1]
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, "").trim())
    .filter(Boolean);
}

function extractQueueAllowList(source) {
  const match = /const QUEUE_BINDINGS:[\s\S]*?=\s*\{([\s\S]*?)\};/m.exec(source);
  if (match === null) {
    throw new Error("Missing QUEUE_BINDINGS allow-list");
  }
  return new Map(
    Array.from(
      match[1].matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g),
      (item) => [item[1], item[2]],
    ),
  );
}

function parseTomlBlocks(source, tableName) {
  const blocks = [];
  let current = null;
  for (const line of source.split(/\r?\n/)) {
    const header = /^\s*\[\[([^\]]+)\]\]\s*$/.exec(line);
    if (header !== null) {
      if (current !== null) {
        blocks.push(current);
      }
      current = header[1] === tableName ? {} : null;
      continue;
    }
    if (current === null) {
      continue;
    }
    const value = /^\s*([A-Za-z0-9_]+)\s*=\s*"([^"]+)"\s*$/.exec(line);
    if (value !== null) {
      current[value[1]] = value[2];
    }
  }
  if (current !== null) {
    blocks.push(current);
  }
  return blocks;
}

function requireWorker(workers, worker) {
  if (!workers.includes(worker)) {
    failures.push(`deploy.sh WORKERS missing ${worker}`);
  }
}

function requireConsumer(consumers, { queue, deadLetterQueue, label }) {
  const consumer = consumers.find((item) => item.queue === queue);
  if (consumer === undefined) {
    failures.push(`virtual-agency ${label} consumer missing ${queue}`);
    return;
  }
  if (consumer.dead_letter_queue !== deadLetterQueue) {
    failures.push(
      `virtual-agency ${label} consumer ${queue} missing DLQ ${deadLetterQueue}`,
    );
  }
}
