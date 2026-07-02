import { existsSync, readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

export type PluggedInSocialBoundary =
  | "public_rls"
  | "internal_system_rls"
  | "internal_secret"
  | "public";

export type PluggedInSocialClosedLoopStageName =
  | "intake"
  | "strategy"
  | "content"
  | "approval"
  | "scheduling"
  | "publishing"
  | "metrics"
  | "report"
  | "next_action";

export const PLUGGED_IN_SOCIAL_REQUIRED_GOVERNANCE_GATES = [
  "publicRlsBoundary",
  "internalSystemRlsBoundary",
  "handoffScopeGuard",
  "approvalHashGate",
  "contentHashMutationGate",
  "publishContentHashGate",
  "capabilityGate",
  "sharedPayloadContract",
  "deployBinding",
  "publicationTerminal",
  "nextActionLedgerBinding",
  "nextActionExecutionBoundary",
  "nextActionApprovalSurface",
  "metricsReadyAnalyticsDispatch",
  "closedLoopRuntimeFixture",
  "externalIntegrationBoundary",
  "externalAdapterBoundary",
  "operatorRunMonitorSurface",
] as const;

export type PluggedInSocialGovernanceGate =
  (typeof PLUGGED_IN_SOCIAL_REQUIRED_GOVERNANCE_GATES)[number];

export type PluggedInSocialGovernance = Readonly<
  Record<PluggedInSocialGovernanceGate, boolean>
>;

export interface PluggedInSocialManifestRef {
  readonly kind: "source_record" | "document";
  readonly id: string;
  readonly label: string;
  readonly path: string;
}

export interface PluggedInSocialAgentManifest {
  readonly role: string;
  readonly sourcePath: string;
  readonly writes: readonly string[];
  readonly emits: readonly string[];
}

export interface PluggedInSocialQueueManifest {
  readonly worker: string;
  readonly queue: string;
  readonly configPath: string;
  readonly deadLetterQueue?: string;
}

export interface PluggedInSocialApiEndpointManifest {
  readonly method: string;
  readonly path: string;
  readonly sourcePath: string;
  readonly boundary: PluggedInSocialBoundary;
}

export type PluggedInSocialConfigurationKind =
  | "backend_settings"
  | "backend_test_dependencies"
  | "deploy_script"
  | "worker_wrangler";

export interface PluggedInSocialConfigurationManifest {
  readonly kind: PluggedInSocialConfigurationKind;
  readonly name: string;
  readonly sourcePath: string;
  readonly environmentKeys: readonly string[];
  readonly secrets: readonly string[];
  readonly queues: readonly string[];
  readonly workers: readonly string[];
  readonly schedules: readonly string[];
  readonly dependencies: readonly string[];
  readonly compatibilityDate?: string;
}

export type PluggedInSocialExternalAdapterType =
  | "browser_qa_harness"
  | "agent_harness";

export type PluggedInSocialExternalAdapterBoundary =
  | "external_process"
  | "sandboxed_process"
  | "containerized_process"
  | "hosted_service";

export interface PluggedInSocialExternalAdapterManifest {
  readonly id: string;
  readonly adapterType: PluggedInSocialExternalAdapterType;
  readonly sourcePath: string;
  readonly boundary: PluggedInSocialExternalAdapterBoundary;
  readonly capabilities: readonly string[];
  readonly inputContracts: readonly string[];
  readonly outputArtifacts: readonly string[];
  readonly requiredGates: readonly string[];
  readonly evidenceFields: readonly string[];
}

export interface PluggedInSocialDataModelManifest {
  readonly table: string;
  readonly model: string;
  readonly modelPath: string;
  readonly migrationPaths: readonly string[];
  readonly orgScoped: boolean;
  readonly timestamped: boolean;
  readonly durableEvidenceFields: readonly string[];
}

export interface PluggedInSocialClosedLoopStage {
  readonly stage: PluggedInSocialClosedLoopStageName;
  readonly present: boolean;
  readonly evidence: readonly string[];
}

export interface PluggedInSocialReadiness {
  readonly complete: boolean;
  readonly missing: readonly string[];
}

export interface PluggedInSocialSourceManifest {
  readonly sourceId: "plugged_in_social";
  readonly sourcePath: string;
  readonly agents: readonly PluggedInSocialAgentManifest[];
  readonly queues: readonly PluggedInSocialQueueManifest[];
  readonly apiEndpoints: readonly PluggedInSocialApiEndpointManifest[];
  readonly dataTables: readonly string[];
  readonly dataModels: readonly PluggedInSocialDataModelManifest[];
  readonly configurations: readonly PluggedInSocialConfigurationManifest[];
  readonly externalAdapters: readonly PluggedInSocialExternalAdapterManifest[];
  readonly governance: PluggedInSocialGovernance;
  readonly closedLoopStages: readonly PluggedInSocialClosedLoopStage[];
  readonly evidenceRefs: readonly PluggedInSocialManifestRef[];
  readonly substrateRefs: readonly PluggedInSocialManifestRef[];
  readonly readiness: PluggedInSocialReadiness;
}

export interface PluggedInSocialSourceManifestInput {
  readonly workspaceRoot?: string;
  readonly sourcePath?: string;
}

export const PLUGGED_IN_SOCIAL_DEFAULT_SOURCE_PATH = "./plugged_in_social";

const REQUIRED_SOURCE_FILES = [
  "AGENTS.md",
  "backend/app/api/integration.py",
  "backend/app/schemas/integration.py",
  "backend/app/api/virtual_agency.py",
  "backend/app/api/internal/virtual_agency.py",
  "backend/app/services/virtual_agency.py",
  "backend/app/services/virtual_agency_agents.py",
  "backend/app/services/virtual_agency_orchestration.py",
  "backend/app/models/virtual_agency.py",
  "backend/alembic/versions/022_virtual_agency_orchestration_ledger.py",
  "agents/packages/shared/src/messages.ts",
  "agents/scripts/deploy.sh",
  "agents/workers/queue-producer/wrangler.toml",
  "agents/workers/virtual-agency/src/index.ts",
  "agents/workers/virtual-agency/wrangler.toml",
  "backend/app/services/report_next_actions.py",
  "backend/tests/test_integration_api_contract.py",
  "frontend/src/app/admin/agency/page.tsx",
  "frontend/tests/test_agency_command_center_contract.py",
  "frontend/src/app/admin/page.tsx",
] as const;

const REQUIRED_TABLES = [
  "virtual_agency_tasks",
  "virtual_agency_events",
  "social_posts",
  "ai_content_requests",
  "client_reports",
  "automations",
] as const;

const REQUIRED_AGENT_ROLES = [
  "chief_of_staff",
  "content_creative",
  "scheduling_distribution",
  "community_engagement",
  "analytics_reporting",
] as const;

const REQUIRED_CONFIGURATION_NAMES = [
  "fastapi-settings",
  "backend-test-dependencies",
  "agents-deploy",
  "stevie-queue-producer",
  "stevie-virtual-agency",
  "stevie-social-cron",
] as const;

const REQUIRED_EXTERNAL_ADAPTER_IDS = [
  "browser_qa_harness",
  "agent_harness",
] as const;

const DURABLE_EVIDENCE_FIELD_NAMES = [
  "approval_payload_hash",
  "approved_version",
  "claimed_at",
  "completed_at",
  "created_by_agent",
  "event_hash",
  "latest_event_hash",
  "lineage",
  "metrics_snapshot",
  "payload_hash",
  "pdf_generated_at",
  "pdf_url",
  "platform_post_id",
  "platform_url",
  "published_at",
  "published_content_hash",
  "scheduled_content_hash",
  "sent_at",
  "status",
  "task_version",
  "version",
] as const;

function readSource(root: string, path: string): string {
  const absolutePath = resolve(root, path);
  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : "";
}

function listFiles(root: string, predicate: (path: string) => boolean): string[] {
  if (!existsSync(root)) {
    return [];
  }
  const found: string[] = [];
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) {
        continue;
      }
      const absolutePath = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      const relativePath = relative(root, absolutePath).replaceAll("\\", "/");
      if (predicate(relativePath)) {
        found.push(relativePath);
      }
    }
  };
  visit(root);
  return found.sort();
}

function extractQuotedSetValues(source: string): string[] {
  return Array.from(source.matchAll(/"([^"]+)"/g), (match) => match[1])
    .filter((value): value is string => value !== undefined)
    .sort();
}

function extractAgentCapabilities(
  source: string,
  role: string,
): Pick<PluggedInSocialAgentManifest, "writes" | "emits"> {
  const roleBlock = new RegExp(
    `"${role}"\\s*:\\s*\\{([\\s\\S]*?)\\n\\s*\\},`,
  ).exec(source)?.[1] ?? "";
  const writes = /"writes"\s*:\s*\{([^}]*)\}/.exec(roleBlock)?.[1] ?? "";
  const emits = /"emits"\s*:\s*\{([^}]*)\}/.exec(roleBlock)?.[1] ?? "";
  return {
    writes: extractQuotedSetValues(writes),
    emits: extractQuotedSetValues(emits),
  };
}

function extractAgents(
  sourceRoot: string,
): readonly PluggedInSocialAgentManifest[] {
  const roleSourcePath = "backend/app/services/virtual_agency.py";
  const rolesSource = readSource(sourceRoot, roleSourcePath);
  const capabilitiesSource = readSource(
    sourceRoot,
    "backend/app/services/virtual_agency_orchestration.py",
  );
  const roles = Array.from(
    rolesSource.matchAll(/^AGENT_[A-Z_]+\s*=\s*"([^"]+)"/gm),
    (match) => match[1],
  ).filter((role): role is string => role !== undefined);

  return roles.map((role) => ({
    role,
    sourcePath: roleSourcePath,
    ...extractAgentCapabilities(capabilitiesSource, role),
  }));
}

function extractQueues(sourceRoot: string): readonly PluggedInSocialQueueManifest[] {
  const workerRoot = resolve(sourceRoot, "agents/workers");
  return listFiles(workerRoot, (path) => path.endsWith("wrangler.toml"))
    .flatMap((configPath) => {
      const worker = configPath.split("/")[0] ?? "";
      const source = readSource(workerRoot, configPath);
      const queues = Array.from(
        source.matchAll(/^\s*queue\s*=\s*"([^"]+)"/gm),
        (match) => match[1],
      ).filter((queue): queue is string => queue !== undefined);
      const dlqs = Array.from(
        source.matchAll(/^\s*dead_letter_queue\s*=\s*"([^"]+)"/gm),
        (match) => match[1],
      ).filter((queue): queue is string => queue !== undefined);

      return queues.map((queue, index) => {
        const deadLetterQueue = dlqs[index];
        return deadLetterQueue === undefined
          ? {
              worker,
              queue,
              configPath: `agents/workers/${configPath}`,
            }
          : {
              worker,
              queue,
              deadLetterQueue,
              configPath: `agents/workers/${configPath}`,
            };
      });
    })
    .sort((a, b) => `${a.queue}:${a.worker}`.localeCompare(`${b.queue}:${b.worker}`));
}

function routerPrefix(source: string): string {
  return /APIRouter\(prefix="([^"]+)"/.exec(source)?.[1] ?? "";
}

function boundaryForRoute(path: string, source: string): PluggedInSocialBoundary {
  if (path.includes("/internal/")) {
    return source.includes("get_db_with_rls") && source.includes("RequestContext")
      ? "internal_system_rls"
      : "internal_secret";
  }
  if (source.includes("get_db_with_rls_dep")) {
    return "public_rls";
  }
  return "public";
}

function extractApiEndpoints(
  sourceRoot: string,
): readonly PluggedInSocialApiEndpointManifest[] {
  const routeFiles = [
    "backend/app/api/virtual_agency.py",
    "backend/app/api/internal/virtual_agency.py",
    "backend/app/api/ai_content.py",
    "backend/app/api/social.py",
    "backend/app/api/internal/social.py",
    "backend/app/api/internal/ai.py",
    "backend/app/api/internal/automations.py",
    "backend/app/api/integration.py",
  ];

  return routeFiles.flatMap((sourcePath) => {
    const source = readSource(sourceRoot, sourcePath);
    const prefix = routerPrefix(source);
    return Array.from(
      source.matchAll(/@router\.(get|post|put|patch|delete)\(\s*"([^"]*)"/g),
      (match): PluggedInSocialApiEndpointManifest | undefined => {
        const method = match[1]?.toUpperCase();
        const routePath = match[2];
        if (method === undefined || routePath === undefined) {
          return undefined;
        }
        const path = `${prefix}${routePath}`.replace(/\/$/, "") || "/";
        return {
          method,
          path,
          sourcePath,
          boundary: boundaryForRoute(prefix, source),
        };
      },
    ).filter((endpoint): endpoint is PluggedInSocialApiEndpointManifest => {
      return endpoint !== undefined;
    });
  });
}

function sourceIncludesAll(source: string, values: readonly string[]): boolean {
  return values.every((value) => source.includes(value));
}

function buildExternalAdapters(
  sourceRoot: string,
): readonly PluggedInSocialExternalAdapterManifest[] {
  const sourcePath = "backend/app/api/integration.py";
  const apiSource = readSource(sourceRoot, sourcePath);
  const schemaSource = readSource(sourceRoot, "backend/app/schemas/integration.py");
  const hasAdapterContract =
    schemaSource.includes("IntegrationExternalAdapterManifest") &&
    schemaSource.includes("external_adapters") &&
    apiSource.includes("_external_adapter_manifest") &&
    apiSource.includes('"/external-adapters"') &&
    apiSource.includes("external_adapter_manifest.read");

  if (!hasAdapterContract) {
    return [];
  }

  const adapters: PluggedInSocialExternalAdapterManifest[] = [];

  if (
    sourceIncludesAll(apiSource, [
      "browser_qa_harness",
      "sandboxed_process",
      "affected_flow_detection",
      "playwright_script_capture",
      "network_har",
      "trace_zip",
      "evidence_hash_gate",
      "no_secret_exfiltration",
      "script_hash",
      "console_error_count",
    ])
  ) {
    adapters.push({
      id: "browser_qa_harness",
      adapterType: "browser_qa_harness",
      sourcePath,
      boundary: "sandboxed_process",
      capabilities: [
        "affected_flow_detection",
        "browser_replay",
        "playwright_script_capture",
        "trace_capture",
        "network_har_capture",
        "console_log_capture",
        "self_contained_report",
      ],
      inputContracts: [
        "git_diff",
        "operator_flow_prompt",
        "target_url",
        "auth_context_ref",
      ],
      outputArtifacts: [
        "report_html",
        "playwright_script",
        "trace_zip",
        "network_har",
        "console_log",
        "screen_recording",
        "step_screenshots",
      ],
      requiredGates: [
        "tenant_rls",
        "approval_payload_hash",
        "evidence_hash_gate",
        "no_secret_exfiltration",
      ],
      evidenceFields: [
        "artifact_payload_hash",
        "report_uri",
        "trace_uri",
        "har_uri",
        "script_hash",
        "console_error_count",
      ],
    });
  }

  if (
    sourceIncludesAll(apiSource, [
      "agent_harness",
      "containerized_process",
      "multi_provider_llm",
      "tool_calling",
      "session_tree",
      "virtual_agency_task",
      "capability_grant",
      "tool_call_log",
      "sandbox_boundary",
      "durable_event_hash",
      "tool_call_hash",
      "output_payload_hash",
    ])
  ) {
    adapters.push({
      id: "agent_harness",
      adapterType: "agent_harness",
      sourcePath,
      boundary: "containerized_process",
      capabilities: [
        "multi_provider_llm",
        "tool_calling",
        "agent_loop_state",
        "session_tree",
        "json_mode",
        "rpc_mode",
        "sdk_embedding",
        "extension_packages",
      ],
      inputContracts: [
        "virtual_agency_task",
        "approval_payload_hash",
        "capability_grant",
        "tenant_context",
        "evidence_snapshot",
      ],
      outputArtifacts: [
        "agent_session_tree",
        "tool_call_log",
        "proposed_mutations",
        "artifact_payload",
        "next_action_proposal",
      ],
      requiredGates: [
        "tenant_rls",
        "capability_gate",
        "approval_payload_hash",
        "content_hash_gate",
        "sandbox_boundary",
        "durable_event_hash",
      ],
      evidenceFields: [
        "session_id",
        "tool_call_hash",
        "state_ref",
        "approval_payload_hash",
        "output_payload_hash",
      ],
    });
  }

  return adapters.sort((a, b) => a.id.localeCompare(b.id));
}

function extractTables(sourceRoot: string): readonly string[] {
  const modelRoot = resolve(sourceRoot, "backend/app/models");
  const tables = new Set<string>();
  for (const modelPath of listFiles(modelRoot, (path) => path.endsWith(".py"))) {
    const source = readSource(modelRoot, modelPath);
    for (const match of source.matchAll(/__tablename__\s*=\s*"([^"]+)"/g)) {
      if (match[1] !== undefined) {
        tables.add(match[1]);
      }
    }
  }
  return [...tables].sort();
}

function extractBackendEnvironmentKeys(source: string): readonly string[] {
  return Array.from(
    source.matchAll(/^    ([a-z][a-z0-9_]*):\s*[^=]+=/gm),
    (match) => match[1],
  )
    .filter((key): key is string => key !== undefined)
    .map((key) => key.toUpperCase())
    .sort();
}

function extractBashArrayValues(source: string, name: string): readonly string[] {
  const match = new RegExp(`${name}=\\(\\n([\\s\\S]*?)\\n\\)`).exec(source);
  const block = match?.[1] ?? "";
  return Array.from(block.matchAll(/^\s*([a-zA-Z0-9_-]+)\s*$/gm), (item) => item[1])
    .filter((item): item is string => item !== undefined)
    .sort();
}

function extractDeploySecrets(source: string): readonly string[] {
  return Array.from(
    source.matchAll(/set_secret_if_missing\s+(?:"[^"]+"|\$\w+|[^\s]+)\s+([A-Z0-9_]+)/g),
    (match) => match[1],
  )
    .filter((secret): secret is string => secret !== undefined)
    .filter((secret, index, secrets) => secrets.indexOf(secret) === index)
    .sort();
}

function extractTomlName(source: string): string {
  return /^name\s*=\s*"([^"]+)"/m.exec(source)?.[1] ?? "";
}

function extractTomlAssignments(source: string, key: string): readonly string[] {
  return Array.from(
    source.matchAll(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]+)"`, "gm")),
    (match) => match[1],
  )
    .filter((value): value is string => value !== undefined)
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort();
}

function extractTomlArray(source: string, key: string): readonly string[] {
  const match = new RegExp(`^\\s*${key}\\s*=\\s*\\[([^\\]]*)\\]`, "m").exec(source);
  const block = match?.[1] ?? "";
  return Array.from(block.matchAll(/"([^"]+)"/g), (item) => item[1])
    .filter((item): item is string => item !== undefined)
    .sort();
}

function extractCommentedSecrets(source: string): readonly string[] {
  return Array.from(source.matchAll(/^\s*#\s+([A-Z0-9_]+)\s+(?:\u2014|-)/gm), (match) => match[1])
    .filter((secret): secret is string => secret !== undefined)
    .filter((secret, index, secrets) => secrets.indexOf(secret) === index)
    .sort();
}

function buildConfigurations(
  sourceRoot: string,
): readonly PluggedInSocialConfigurationManifest[] {
  const backendSettingsPath = "backend/app/core/config.py";
  const backendTestRequirementsPath = "backend/requirements-dev.txt";
  const deployScriptPath = "agents/scripts/deploy.sh";
  const backendSettings = readSource(sourceRoot, backendSettingsPath);
  const backendTestRequirements = readSource(sourceRoot, backendTestRequirementsPath);
  const deployScript = readSource(sourceRoot, deployScriptPath);
  const configurations: PluggedInSocialConfigurationManifest[] = [];

  if (backendSettings !== "") {
    const environmentKeys = extractBackendEnvironmentKeys(backendSettings);
    configurations.push({
      kind: "backend_settings",
      name: "fastapi-settings",
      sourcePath: backendSettingsPath,
      environmentKeys,
      secrets: environmentKeys.filter((key) =>
        /(?:SECRET|TOKEN|KEY)$/.test(key),
      ),
      queues: [],
      workers: [],
      schedules: [],
      dependencies: [],
    });
  }

  if (backendTestRequirements !== "") {
    configurations.push({
      kind: "backend_test_dependencies",
      name: "backend-test-dependencies",
      sourcePath: backendTestRequirementsPath,
      environmentKeys: [],
      secrets: [],
      queues: [],
      workers: [],
      schedules: [],
      dependencies: backendTestRequirements
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line !== "" && !line.startsWith("#") && !line.startsWith("-r "))
        .map((line) => line.split(/[<>=~!]/)[0]?.trim() ?? "")
        .filter((dependency) => dependency !== "")
        .sort(),
    });
  }

  if (deployScript !== "") {
    configurations.push({
      kind: "deploy_script",
      name: "agents-deploy",
      sourcePath: deployScriptPath,
      environmentKeys: [],
      secrets: extractDeploySecrets(deployScript),
      queues: extractBashArrayValues(deployScript, "QUEUES"),
      workers: extractBashArrayValues(deployScript, "WORKERS"),
      schedules: [],
      dependencies: [],
    });
  }

  const workerRoot = resolve(sourceRoot, "agents/workers");
  for (const configPath of listFiles(workerRoot, (path) => path.endsWith("wrangler.toml"))) {
    const source = readSource(workerRoot, configPath);
    const workerDir = configPath.split("/")[0] ?? "";
    const queues = [
      ...extractTomlAssignments(source, "queue"),
      ...extractTomlAssignments(source, "dead_letter_queue"),
    ]
      .filter((queue, index, queueNames) => queueNames.indexOf(queue) === index)
      .sort();
    const schedules = extractTomlArray(source, "crons");

    const compatibilityDate = extractTomlAssignments(source, "compatibility_date")[0];
    configurations.push({
      kind: "worker_wrangler",
      name: extractTomlName(source) || workerDir,
      sourcePath: `agents/workers/${configPath}`,
      environmentKeys: source.includes("ENVIRONMENT") ? ["ENVIRONMENT"] : [],
      secrets: extractCommentedSecrets(source),
      queues,
      workers: [workerDir],
      schedules,
      dependencies: [],
      ...(compatibilityDate === undefined ? {} : { compatibilityDate }),
    });
  }

  return configurations.sort((a, b) =>
    `${a.kind}:${a.name}`.localeCompare(`${b.kind}:${b.name}`),
  );
}

function migrationPathsForTable(
  sourceRoot: string,
  table: string,
): readonly string[] {
  const migrationRoot = resolve(sourceRoot, "backend/alembic/versions");
  return listFiles(migrationRoot, (path) => path.endsWith(".py"))
    .filter((migrationPath) => {
      const source = readSource(migrationRoot, migrationPath);
      return source.includes(`"${table}"`) || source.includes(`'${table}'`);
    })
    .map((migrationPath) => `backend/alembic/versions/${migrationPath}`)
    .sort();
}

function extractDataModels(
  sourceRoot: string,
): readonly PluggedInSocialDataModelManifest[] {
  const modelRoot = resolve(sourceRoot, "backend/app/models");
  const models: PluggedInSocialDataModelManifest[] = [];

  for (const modelPath of listFiles(modelRoot, (path) => path.endsWith(".py"))) {
    const source = readSource(modelRoot, modelPath);
    const classBlocks = source.matchAll(
      /^class\s+([A-Za-z_][A-Za-z0-9_]*)\(([^)]*)\):([\s\S]*?)(?=^class\s+[A-Za-z_][A-Za-z0-9_]*\(|(?![\s\S]))/gm,
    );

    for (const match of classBlocks) {
      const model = match[1];
      const bases = match[2] ?? "";
      const body = match[3] ?? "";
      const table = /__tablename__\s*=\s*"([^"]+)"/.exec(body)?.[1];
      if (model === undefined || table === undefined) {
        continue;
      }
      const fields = Array.from(
        body.matchAll(/^\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*Mapped/gm),
        (field) => field[1],
      ).filter((field): field is string => field !== undefined);

      models.push({
        table,
        model,
        modelPath: `backend/app/models/${modelPath}`,
        migrationPaths: migrationPathsForTable(sourceRoot, table),
        orgScoped: bases.includes("OrgMixin") || fields.includes("org_id"),
        timestamped: bases.includes("TimestampMixin") || fields.includes("created_at"),
        durableEvidenceFields: fields.filter((field) =>
          DURABLE_EVIDENCE_FIELD_NAMES.includes(
            field as (typeof DURABLE_EVIDENCE_FIELD_NAMES)[number],
          ),
        ),
      });
    }
  }

  return models.sort((a, b) => a.table.localeCompare(b.table));
}

function buildGovernance(sourceRoot: string): PluggedInSocialGovernance {
  const publicApi = readSource(sourceRoot, "backend/app/api/virtual_agency.py");
  const integrationApi = readSource(sourceRoot, "backend/app/api/integration.py");
  const integrationSchemas = readSource(
    sourceRoot,
    "backend/app/schemas/integration.py",
  );
  const integrationTests = readSource(
    sourceRoot,
    "backend/tests/test_integration_api_contract.py",
  );
  const internalApi = readSource(
    sourceRoot,
    "backend/app/api/internal/virtual_agency.py",
  );
  const executor = readSource(
    sourceRoot,
    "backend/app/services/virtual_agency_agents.py",
  );
  const orchestration = readSource(
    sourceRoot,
    "backend/app/services/virtual_agency_orchestration.py",
  );
  const virtualAgency = readSource(sourceRoot, "backend/app/services/virtual_agency.py");
  const internalSocial = readSource(sourceRoot, "backend/app/api/internal/social.py");
  const socialCron = readSource(sourceRoot, "agents/workers/social-cron/src/index.ts");
  const socialPublisher = readSource(
    sourceRoot,
    "agents/workers/social-publisher/src/index.ts",
  );
  const messages = readSource(sourceRoot, "agents/packages/shared/src/messages.ts");
  const deploy = readSource(sourceRoot, "agents/scripts/deploy.sh");
  const publicationTerminal = readSource(
    resolve(sourceRoot, ".."),
    "packages/profile-agency/src/publication-terminal.ts",
  );
  const nextActionService = readSource(
    sourceRoot,
    "backend/app/services/report_next_actions.py",
  );
  const internalReports = readSource(
    sourceRoot,
    "backend/app/api/internal/reports.py",
  );
  const orchestrationTests = readSource(
    sourceRoot,
    "backend/tests/test_virtual_agency_orchestration.py",
  );
  const internalSocialTests = readSource(
    sourceRoot,
    "backend/tests/test_internal_social_hash_gate.py",
  );
  const internalVirtualAgencyTests = readSource(
    sourceRoot,
    "backend/tests/test_virtual_agency_api_contract.py",
  );
  const virtualAgencyWorkerTests = readSource(
    sourceRoot,
    "agents/workers/virtual-agency/src/index.test.ts",
  );
  const frontendApi = readSource(sourceRoot, "frontend/src/lib/api.ts");
  const agencyCommandCenter = readSource(
    sourceRoot,
    "frontend/src/app/admin/agency/page.tsx",
  );
  const agencyCommandCenterTests = readSource(
    sourceRoot,
    "frontend/tests/test_agency_command_center_contract.py",
  );

  return {
    publicRlsBoundary:
      publicApi.includes("get_db_with_rls_dep") &&
      publicApi.includes("get_current_user") &&
      !publicApi.includes("get_org_id"),
    internalSystemRlsBoundary:
      internalApi.includes("get_db_with_rls") &&
      internalApi.includes("RequestContext") &&
      internalApi.includes("role=\"system\""),
    handoffScopeGuard:
      executor.includes("_ensure_handoff_scope") &&
      executor.includes("ExecutionScopeError"),
    approvalHashGate:
      orchestration.includes("approval_payload_hash") &&
      orchestration.includes("ensure_approval_is_current"),
    contentHashMutationGate:
      orchestration.includes("def social_post_content_hash") &&
      orchestration.includes('"expected_content_hash"') &&
      orchestration.includes("Social post content hash conflict detected") &&
      orchestrationTests.includes(
        "test_scheduling_write_rejects_content_hash_mismatch",
      ),
    publishContentHashGate:
      internalSocial.includes("scheduled_content_hash") &&
      internalSocial.includes("content_hash_mismatch") &&
      socialCron.includes("expected_content_hash: p.expected_content_hash") &&
      socialPublisher.includes(
        "expected_content_hash: payload.expected_content_hash",
      ) &&
      messages.includes("validateSocialPublishMessage") &&
      internalSocialTests.includes(
        "test_publish_sync_rejects_scheduled_content_hash_mismatch",
      ),
    capabilityGate:
      orchestration.includes("AGENT_CAPABILITIES") &&
      orchestration.includes("ensure_capability"),
    sharedPayloadContract:
      internalApi.includes('type: Literal["virtual_agency.task"]') &&
      internalApi.includes("emitted_at: datetime") &&
      internalApi.includes("dependency_ids: list[uuid.UUID]") &&
      internalApi.includes("approval_payload_hash: str | None") &&
      internalApi.includes("VirtualAgencyTaskRequest") &&
      messages.includes("VirtualAgencyAgentRole") &&
      messages.includes("orchestration_task_id") &&
      messages.includes("task_version") &&
      messages.includes("approval_payload_hash") &&
      messages.includes("approval_payload_hash must be a SHA-256 hex digest") &&
      messages.includes("emitted_at must be a parseable timestamp") &&
      internalVirtualAgencyTests.includes(
        "test_internal_virtual_agency_payload_matches_worker_contract",
      ) &&
      virtualAgencyWorkerTests.includes("rejects invalid approval payload hash"),
    deployBinding:
      deploy.includes("stevie-virtual-agency") &&
      deploy.includes("virtual-agency") &&
      deploy.includes("BACKEND_BASE_URL"),
    publicationTerminal: publicationTerminal.includes(
      "buildAgencyPublicationActionOutcomeEnvelope",
    ),
    nextActionLedgerBinding:
      nextActionService.includes("create_next_action_proposal_task_for_report") &&
      nextActionService.includes("VirtualAgencyTask") &&
      nextActionService.includes("VirtualAgencyEventType.task_created") &&
      nextActionService.includes("plugged-in-social-axis-b-adapter.ts") &&
      nextActionService.includes("client_approval_before_execution") &&
      internalReports.includes("create_next_action_proposal_task_for_report") &&
      internalReports.indexOf("report.status = ReportStatus.generated.value") <
        internalReports.indexOf("create_next_action_proposal_task_for_report("),
    nextActionExecutionBoundary:
      executor.includes('task.task_type == "next_action_proposal"') &&
      executor.includes("build_next_action_proposal_completion_payload") &&
      orchestration.includes("marketing.next_action.proposed") &&
      orchestration.includes("build_next_action_proposal_completion_payload") &&
      orchestration.includes("_recommend_next_marketing_action"),
    nextActionApprovalSurface:
      publicApi.includes('"type": "orchestration_task"') &&
      publicApi.includes('if item_type == "orchestration_task":') &&
      publicApi.includes("VirtualAgencyTask.source_task_id.is_(None)") &&
      publicApi.includes('VirtualAgencyTask.status == "todo"') &&
      publicApi.includes("publish_agent_task("),
    metricsReadyAnalyticsDispatch:
      orchestration.includes("ensure_task_evidence_ready") &&
      orchestration.includes("post_has_metric_evidence") &&
      executor.includes("ensure_task_evidence_ready") &&
      virtualAgency.includes("dispatch_metrics_ready_analytics_tasks") &&
      virtualAgency.includes("virtual-agency:metrics-ready") &&
      virtualAgency.includes("build_agent_task_dispatch") &&
      internalSocial.includes("_dispatch_ready_analytics_tasks_sync") &&
      internalSocial.includes("virtual_agency_tasks") &&
      socialCron.includes("virtual_agency_tasks") &&
      socialCron.includes("/enqueue/stevie-virtual-agency"),
    closedLoopRuntimeFixture:
      orchestrationTests.includes(
        "test_virtual_agency_closed_loop_reaches_next_action_with_durable_evidence",
      ) &&
      orchestrationTests.includes("dispatch_metrics_ready_analytics_tasks") &&
      orchestrationTests.includes("create_next_action_proposal_task_for_report_async") &&
      orchestrationTests.includes("ReportStatus.generated.value") &&
      orchestrationTests.includes("build_handoff_payload(next_action_task)") &&
      orchestrationTests.includes('"pm_substrate_action_type": "marketing.next_action.propose"'),
    externalIntegrationBoundary:
      integrationApi.includes('APIRouter(prefix="/integration/v1"') &&
      integrationApi.includes("get_db_with_rls_dep") &&
      integrationApi.includes("get_current_user") &&
      integrationApi.includes('"/capabilities"') &&
      integrationApi.includes('"/platform-manifest"') &&
      integrationApi.includes('"/external-adapters"') &&
      integrationApi.includes('"/engagements"') &&
      integrationApi.includes('"/marketing-runs/{run_id}/artifacts"') &&
      integrationApi.includes('"/marketing-runs/{run_id}/tasks"') &&
      integrationApi.includes('"/marketing-runs/{run_id}/events"') &&
      integrationApi.includes('"/marketing-runs/{run_id}/evidence-summary"') &&
      integrationApi.includes('"/marketing-runs/{run_id}/evidence-snapshot"') &&
      integrationApi.includes('"/marketing-runs/{run_id}/reports"') &&
      integrationApi.includes('"/reports/{report_id}"') &&
      integrationApi.includes('"/approvals/{approval_id}/decision"') &&
      integrationApi.includes('"/events"') &&
      integrationApi.includes('"/webhooks"') &&
      integrationSchemas.includes("IntegrationCapabilityResponse") &&
      integrationSchemas.includes("IntegrationPlatformManifestEnvelope") &&
      integrationSchemas.includes("IntegrationAgentManifest") &&
      integrationSchemas.includes("IntegrationConfigurationRequirement") &&
      integrationSchemas.includes("IntegrationDataResourceManifest") &&
      integrationSchemas.includes("IntegrationExternalAdapterManifest") &&
      integrationSchemas.includes("IntegrationMarketingRunEnvelope") &&
      integrationSchemas.includes("IntegrationArtifactEnvelope") &&
      integrationSchemas.includes("IntegrationTaskEnvelope") &&
      integrationSchemas.includes("IntegrationRunEventEnvelope") &&
      integrationSchemas.includes("IntegrationEvidenceSummaryEnvelope") &&
      integrationSchemas.includes("IntegrationRunEvidenceSnapshotEnvelope") &&
      integrationSchemas.includes("IntegrationClientReportEnvelope") &&
      integrationTests.includes("test_integration_router_uses_rls_and_has_no_substrate_imports") &&
      !integrationApi.includes("pm_substrate") &&
      !integrationApi.includes("packages.profile") &&
      !integrationApi.includes("packages/evals"),
    externalAdapterBoundary:
      integrationApi.includes("_external_adapter_manifest") &&
      integrationApi.includes("get_external_adapters") &&
      integrationApi.includes("external_adapter_manifest.read") &&
      integrationApi.includes("browser_qa_harness") &&
      integrationApi.includes("agent_harness") &&
      integrationApi.includes("sandboxed_process") &&
      integrationApi.includes("containerized_process") &&
      integrationApi.includes("evidence_hash_gate") &&
      integrationApi.includes("sandbox_boundary") &&
      integrationApi.includes("no_secret_exfiltration") &&
      integrationApi.includes("tool_call_hash") &&
      integrationApi.includes("network_har") &&
      integrationSchemas.includes("IntegrationExternalAdapterManifest") &&
      integrationSchemas.includes("external_adapters") &&
      integrationTests.includes("external_adapter_manifest.read") &&
      integrationTests.includes("browser_qa_harness") &&
      integrationTests.includes("sandbox_boundary"),
    operatorRunMonitorSurface:
      frontendApi.includes("export interface IntegrationTask") &&
      frontendApi.includes("export interface IntegrationRunEvidenceSnapshot") &&
      frontendApi.includes("export interface IntegrationClientReport") &&
      frontendApi.includes("export interface IntegrationExternalAdapter") &&
      frontendApi.includes("listIntegrationRunTasks") &&
      frontendApi.includes("getIntegrationRunEvidenceSnapshot") &&
      frontendApi.includes("listIntegrationExternalAdapters") &&
      frontendApi.includes("report_count") &&
      frontendApi.includes("reports: IntegrationClientReport[]") &&
      frontendApi.includes("/api/integration/v1/marketing-runs/") &&
      frontendApi.includes("/tasks") &&
      frontendApi.includes("/evidence-snapshot") &&
      frontendApi.includes("/api/integration/v1/external-adapters") &&
      agencyCommandCenter.includes("Closed-loop Progress") &&
      agencyCommandCenter.includes("Governance Gates") &&
      agencyCommandCenter.includes("External Adapter Boundary") &&
      agencyCommandCenter.includes("Agent Task Queue") &&
      agencyCommandCenter.includes("CLOSED_LOOP_STAGES") &&
      agencyCommandCenter.includes("externalAdapters") &&
      agencyCommandCenter.includes("getIntegrationRunEvidenceSnapshot") &&
      agencyCommandCenter.includes("listIntegrationExternalAdapters") &&
      agencyCommandCenter.includes("clientReports") &&
      agencyCommandCenter.includes("approval_payload_hash") &&
      agencyCommandCenter.includes("latest_event_hash") &&
      agencyCommandCenter.includes("social_post_content_hashes") &&
      agencyCommandCenter.includes("client_report_hashes") &&
      agencyCommandCenter.includes("Report Status") &&
      agencyCommandCenterTests.includes(
        "test_agency_command_center_route_exposes_autonomous_run_monitor",
      ) &&
      agencyCommandCenterTests.includes("External Adapter Boundary"),
  };
}

function evidenceForExisting(sourceRoot: string, paths: readonly string[]): string[] {
  return paths.filter((path) => existsSync(resolve(sourceRoot, path)));
}

function buildClosedLoopStages(
  sourceRoot: string,
): readonly PluggedInSocialClosedLoopStage[] {
  const nextActionProposalPath =
    "../packages/profile-agency/src/next-action-proposal.ts";
  const nextActionAdapterPath =
    "../packages/profile-agency/src/plugged-in-social-axis-b-adapter.ts";
  const nextActionServicePath = "backend/app/services/report_next_actions.py";
  const internalReportsPath = "backend/app/api/internal/reports.py";
  const nextActionProposalSource = readSource(sourceRoot, nextActionProposalPath);
  const nextActionAdapterSource = readSource(sourceRoot, nextActionAdapterPath);
  const nextActionServiceSource = readSource(sourceRoot, nextActionServicePath);
  const internalReportsSource = readSource(sourceRoot, internalReportsPath);
  const hasNextActionProposal = nextActionProposalSource.includes(
    "buildAgencyMarketingNextActionProposal",
  );
  const hasNextActionAdapter = nextActionAdapterSource.includes(
    "buildPluggedInSocialAxisBNextActionAdapterResult",
  );
  const hasNextActionLedgerBinding =
    nextActionServiceSource.includes("create_next_action_proposal_task_for_report") &&
    internalReportsSource.includes("create_next_action_proposal_task_for_report");
  const hasNextActionExecutionBoundary =
    readSource(sourceRoot, "backend/app/services/virtual_agency_agents.py").includes(
      'task.task_type == "next_action_proposal"',
    ) &&
    readSource(
      sourceRoot,
      "backend/app/services/virtual_agency_orchestration.py",
    ).includes("build_next_action_proposal_completion_payload");
  const hasNextActionApprovalSurface =
    readSource(sourceRoot, "backend/app/api/virtual_agency.py").includes(
      '"type": "orchestration_task"',
    ) &&
    readSource(sourceRoot, "frontend/src/app/admin/page.tsx").includes(
      "orchestration_task",
    );
  const hasMetricsReadyAnalyticsDispatch =
    readSource(
      sourceRoot,
      "backend/app/services/virtual_agency_orchestration.py",
    ).includes("post_has_metric_evidence") &&
    readSource(sourceRoot, "backend/app/services/virtual_agency.py").includes(
      "dispatch_metrics_ready_analytics_tasks",
    ) &&
    readSource(sourceRoot, "backend/app/api/internal/social.py").includes(
      "virtual_agency_tasks",
    ) &&
    readSource(sourceRoot, "agents/workers/social-cron/src/index.ts").includes(
      "/enqueue/stevie-virtual-agency",
    );

  return [
    {
      stage: "intake",
      present: evidenceForExisting(sourceRoot, [
        "backend/app/api/leads.py",
        "backend/app/api/forms.py",
        "backend/app/models/email_campaign.py",
      ]).length > 0,
      evidence: evidenceForExisting(sourceRoot, [
        "backend/app/api/leads.py",
        "backend/app/api/forms.py",
        "backend/app/models/email_campaign.py",
      ]),
    },
    {
      stage: "strategy",
      present: readSource(sourceRoot, "backend/app/services/virtual_agency.py").includes(
        "start_campaign_planning",
      ),
      evidence: ["backend/app/services/virtual_agency.py"],
    },
    {
      stage: "content",
      present:
        readSource(
          sourceRoot,
          "backend/app/services/virtual_agency_orchestration.py",
        ).includes("create_content_mutations") &&
        existsSync(resolve(sourceRoot, "agents/workers/ai-content/src/index.ts")),
      evidence: [
        "backend/app/services/virtual_agency_orchestration.py",
        "agents/workers/ai-content/src/index.ts",
      ],
    },
    {
      stage: "approval",
      present:
        readSource(sourceRoot, "backend/app/api/virtual_agency.py").includes(
          "/inbox",
        ) &&
        existsSync(resolve(sourceRoot, "../packages/profile-agency/src/publication-terminal.ts")),
      evidence: [
        "backend/app/api/virtual_agency.py",
        "../packages/profile-agency/src/publication-terminal.ts",
      ],
    },
    {
      stage: "scheduling",
      present: readSource(
        sourceRoot,
        "backend/app/services/virtual_agency_orchestration.py",
      ).includes("create_scheduling_mutations"),
      evidence: ["backend/app/services/virtual_agency_orchestration.py"],
    },
    {
      stage: "publishing",
      present:
        existsSync(resolve(sourceRoot, "agents/workers/social-publisher/src/index.ts")) &&
        existsSync(resolve(sourceRoot, "agents/workers/social-cron/src/index.ts")),
      evidence: [
        "agents/workers/social-publisher/src/index.ts",
        "agents/workers/social-cron/src/index.ts",
      ],
    },
    {
      stage: "metrics",
      present:
        hasMetricsReadyAnalyticsDispatch ||
        readSource(sourceRoot, "agents/workers/social-cron/src/index.ts").includes(
          "metrics",
        ) ||
        extractTables(sourceRoot).includes("analytics_daily"),
      evidence: hasMetricsReadyAnalyticsDispatch
        ? [
            "agents/workers/social-cron/src/index.ts",
            "backend/app/api/internal/social.py",
            "backend/app/services/virtual_agency.py",
            "backend/app/services/virtual_agency_orchestration.py",
          ]
        : ["agents/workers/social-cron/src/index.ts", "backend/app/models/analytics.py"],
    },
    {
      stage: "report",
      present:
        existsSync(resolve(sourceRoot, "agents/workers/report-builder/src/index.ts")) &&
        extractTables(sourceRoot).includes("client_reports"),
      evidence: [
        "agents/workers/report-builder/src/index.ts",
        "backend/app/models/report.py",
      ],
    },
    {
      stage: "next_action",
      present:
        hasNextActionProposal &&
        hasNextActionAdapter &&
        hasNextActionLedgerBinding &&
        hasNextActionExecutionBoundary &&
        hasNextActionApprovalSurface,
      evidence:
        hasNextActionProposal &&
        hasNextActionAdapter &&
        hasNextActionLedgerBinding &&
        hasNextActionExecutionBoundary &&
        hasNextActionApprovalSurface
          ? [
              nextActionProposalPath,
              nextActionAdapterPath,
              nextActionServicePath,
              internalReportsPath,
              "backend/app/services/virtual_agency_agents.py",
              "backend/app/services/virtual_agency_orchestration.py",
              "backend/app/api/virtual_agency.py",
              "frontend/src/app/admin/page.tsx",
            ]
          : [],
    },
  ];
}

function buildEvidenceRefs(): readonly PluggedInSocialManifestRef[] {
  return [
    {
      kind: "source_record",
      id: "plugged_in_social:worker:virtual-agency",
      label: "Virtual agency Worker",
      path: "agents/workers/virtual-agency/src/index.ts",
    },
    {
      kind: "source_record",
      id: "plugged_in_social:worker:queue-producer",
      label: "Queue producer Worker",
      path: "agents/workers/queue-producer/wrangler.toml",
    },
    {
      kind: "source_record",
      id: "plugged_in_social:api:virtual-agency",
      label: "Virtual agency FastAPI routes",
      path: "backend/app/api/virtual_agency.py",
    },
    {
      kind: "source_record",
      id: "plugged_in_social:api:integration-v1",
      label: "Neutral PluggedInSocial integration API",
      path: "backend/app/api/integration.py",
    },
    {
      kind: "source_record",
      id: "plugged_in_social:api:external-adapter-manifest",
      label: "External QA and agent harness adapter manifest",
      path: "backend/app/api/integration.py",
    },
    {
      kind: "source_record",
      id: "plugged_in_social:ledger:virtual-agency",
      label: "Virtual agency orchestration ledger",
      path: "backend/app/models/virtual_agency.py",
    },
    {
      kind: "source_record",
      id: "plugged_in_social:test:closed-loop-runtime-fixture",
      label: "Closed-loop virtual agency runtime fixture",
      path: "backend/tests/test_virtual_agency_orchestration.py",
    },
    {
      kind: "source_record",
      id: "plugged_in_social:config:virtual-agency-worker",
      label: "Virtual agency Worker runtime configuration",
      path: "agents/workers/virtual-agency/wrangler.toml",
    },
    {
      kind: "source_record",
      id: "plugged_in_social:config:agents-deploy",
      label: "Agents deploy and secret inventory",
      path: "agents/scripts/deploy.sh",
    },
    {
      kind: "source_record",
      id: "plugged_in_social:data-model:virtual-agency-tasks",
      label: "Virtual agency task data model and ledger fields",
      path: "backend/app/models/virtual_agency.py",
    },
  ];
}

function buildSubstrateRefs(): readonly PluggedInSocialManifestRef[] {
  return [
    {
      kind: "document",
      id: "pm_substrate:profile-agency:profile",
      label: "Agency profile definition",
      path: "packages/profile-agency/src/profile.ts",
    },
    {
      kind: "document",
      id: "pm_substrate:profile-agency:publication-terminal",
      label: "Agency publication terminal admission",
      path: "packages/profile-agency/src/publication-terminal.ts",
    },
    {
      kind: "document",
      id: "pm_substrate:profile-agency:next-action-proposal",
      label: "Agency marketing next-action proposal",
      path: "packages/profile-agency/src/next-action-proposal.ts",
    },
    {
      kind: "document",
      id: "pm_substrate:profile-agency:plugged-in-social-axis-b-adapter",
      label: "PluggedInSocial Axis B next-action adapter",
      path: "packages/profile-agency/src/plugged-in-social-axis-b-adapter.ts",
    },
  ];
}

function missingReadinessItems(
  sourceRoot: string,
  manifest: Omit<PluggedInSocialSourceManifest, "readiness">,
): readonly string[] {
  const missing = new Set<string>();

  for (const path of REQUIRED_SOURCE_FILES) {
    if (!existsSync(resolve(sourceRoot, path))) {
      missing.add(`missing file: ${path}`);
    }
  }
  for (const role of REQUIRED_AGENT_ROLES) {
    if (!manifest.agents.some((agent) => agent.role === role)) {
      missing.add(`missing agent role: ${role}`);
    }
  }
  for (const table of REQUIRED_TABLES) {
    if (!manifest.dataTables.includes(table)) {
      missing.add(`missing data table: ${table}`);
    }
    const dataModel = manifest.dataModels.find((model) => model.table === table);
    if (dataModel === undefined) {
      missing.add(`missing data model: ${table}`);
    } else if (dataModel.migrationPaths.length === 0) {
      missing.add(`missing data migration: ${table}`);
    }
  }
  for (const configuration of REQUIRED_CONFIGURATION_NAMES) {
    if (!manifest.configurations.some((config) => config.name === configuration)) {
      missing.add(`missing configuration: ${configuration}`);
    }
  }
  for (const adapterId of REQUIRED_EXTERNAL_ADAPTER_IDS) {
    const adapter = manifest.externalAdapters.find((item) => item.id === adapterId);
    if (adapter === undefined) {
      missing.add(`missing external adapter: ${adapterId}`);
      continue;
    }
    if (adapter.requiredGates.length === 0) {
      missing.add(`missing external adapter gates: ${adapterId}`);
    }
    if (adapter.outputArtifacts.length === 0) {
      missing.add(`missing external adapter artifacts: ${adapterId}`);
    }
    if (adapter.evidenceFields.length === 0) {
      missing.add(`missing external adapter evidence fields: ${adapterId}`);
    }
  }
  for (const gate of PLUGGED_IN_SOCIAL_REQUIRED_GOVERNANCE_GATES) {
    if (!manifest.governance[gate]) {
      missing.add(`missing governance gate: ${gate}`);
    }
  }
  if (
    !manifest.queues.some(
      (queue) =>
        queue.worker === "virtual-agency" &&
        queue.queue === "stevie-virtual-agency" &&
        queue.deadLetterQueue === "stevie-virtual-agency-dlq",
    )
  ) {
    missing.add("missing virtual-agency queue consumer binding");
  }
  if (
    !manifest.queues.some(
      (queue) =>
        queue.worker === "queue-producer" &&
        queue.queue === "stevie-virtual-agency",
    )
  ) {
    missing.add("missing queue-producer virtual-agency binding");
  }

  return [...missing].sort();
}

export function readPluggedInSocialSourceManifest(
  input: PluggedInSocialSourceManifestInput = {},
): PluggedInSocialSourceManifest {
  const workspaceRoot = input.workspaceRoot ?? process.cwd();
  const sourcePath = input.sourcePath ?? PLUGGED_IN_SOCIAL_DEFAULT_SOURCE_PATH;
  const sourceRoot = resolve(workspaceRoot, sourcePath);

  const partial = {
    sourceId: "plugged_in_social" as const,
    sourcePath,
    agents: extractAgents(sourceRoot),
    queues: extractQueues(sourceRoot),
    apiEndpoints: extractApiEndpoints(sourceRoot),
    dataTables: extractTables(sourceRoot),
    dataModels: extractDataModels(sourceRoot),
    configurations: buildConfigurations(sourceRoot),
    externalAdapters: buildExternalAdapters(sourceRoot),
    governance: buildGovernance(sourceRoot),
    closedLoopStages: buildClosedLoopStages(sourceRoot),
    evidenceRefs: buildEvidenceRefs(),
    substrateRefs: buildSubstrateRefs(),
  };
  const missing = missingReadinessItems(sourceRoot, partial);

  return {
    ...partial,
    readiness: {
      complete: missing.length === 0,
      missing,
    },
  };
}
