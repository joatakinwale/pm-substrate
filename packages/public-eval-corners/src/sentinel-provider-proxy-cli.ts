import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  SENTINEL_PROVIDER_PROXY_INTEGRATION,
  startSentinelProviderProxy,
} from "./sentinel-provider-proxy.js";

function parseArguments(argv: readonly string[]): {
  readonly outputRoot: string;
  readonly port: number;
} {
  let outputRoot: string | null = null;
  let port = 0;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === "--output-root" && value !== undefined) {
      outputRoot = resolve(value);
      index += 1;
    } else if (argument === "--port" && value !== undefined) {
      port = Number(value);
      index += 1;
    } else {
      throw new Error("invalid provider proxy CLI arguments");
    }
  }
  if (outputRoot === null) throw new Error("--output-root is required");
  return { outputRoot, port };
}

async function main(): Promise<void> {
  try {
    const arguments_ = parseArguments(process.argv.slice(2));
    const openAiApiKey = process.env.OPENAI_API_KEY;
    const authorizationToken = process.env.PM_SENTINEL_PROXY_AUTH_TOKEN;
    if (openAiApiKey === undefined || authorizationToken === undefined) {
      throw new Error("required provider proxy environment is missing");
    }
    const proxy = await startSentinelProviderProxy({
      ...arguments_,
      openAiApiKey,
      authorizationToken,
    });
    process.stdout.write(`${JSON.stringify({
      schemaVersion: "pm.public-eval-corners.sentinel-provider-proxy-cli-ready.v1",
      origin: proxy.origin,
      endpointPath: SENTINEL_PROVIDER_PROXY_INTEGRATION.endpointPath,
      pinnedModel: SENTINEL_PROVIDER_PROXY_INTEGRATION.pinnedModel,
      readyReceiptPath: proxy.readyReceiptPath,
      authorizationTokenEnvironment: "PM_SENTINEL_PROXY_AUTH_TOKEN",
    })}\n`);
    await new Promise<void>((resolveSignal) => {
      process.once("SIGINT", resolveSignal);
      process.once("SIGTERM", resolveSignal);
    });
    await proxy.close();
  } catch {
    process.stderr.write("sentinel provider proxy failed closed\n");
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined &&
  import.meta.url === pathToFileURL(resolve(invokedPath)).href
) {
  void main();
}
