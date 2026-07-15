import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  SENTINEL_ANTHROPIC_PROVIDER_PROXY_INTEGRATION,
  startSentinelAnthropicProviderProxy,
} from "./sentinel-anthropic-provider-proxy.js";

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
      throw new Error("invalid Anthropic provider proxy CLI arguments");
    }
  }
  if (outputRoot === null) throw new Error("--output-root is required");
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error("--port must be an integer from 0 through 65535");
  }
  return { outputRoot, port };
}

async function main(): Promise<void> {
  try {
    const arguments_ = parseArguments(process.argv.slice(2));
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    const authorizationToken = process.env.PM_SENTINEL_PROXY_AUTH_TOKEN;
    if (anthropicApiKey === undefined || authorizationToken === undefined) {
      throw new Error("required Anthropic provider proxy environment is missing");
    }
    const proxy = await startSentinelAnthropicProviderProxy({
      ...arguments_,
      anthropicApiKey,
      authorizationToken,
    });
    process.stdout.write(`${JSON.stringify({
      schemaVersion: "pm.public-eval-corners.sentinel-anthropic-provider-proxy-cli-ready.v1",
      origin: proxy.origin,
      endpointPath: SENTINEL_ANTHROPIC_PROVIDER_PROXY_INTEGRATION.endpointPath,
      providerEndpoint: SENTINEL_ANTHROPIC_PROVIDER_PROXY_INTEGRATION.providerEndpoint,
      anthropicVersion: SENTINEL_ANTHROPIC_PROVIDER_PROXY_INTEGRATION.anthropicVersion,
      pinnedModel: SENTINEL_ANTHROPIC_PROVIDER_PROXY_INTEGRATION.pinnedModel,
      readyReceiptPath: proxy.readyReceiptPath,
      authorizationTokenEnvironment: "PM_SENTINEL_PROXY_AUTH_TOKEN",
    })}\n`);
    await new Promise<void>((resolveSignal) => {
      process.once("SIGINT", resolveSignal);
      process.once("SIGTERM", resolveSignal);
    });
    await proxy.close();
  } catch {
    process.stderr.write("sentinel Anthropic provider proxy failed closed\n");
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
  void main();
}
