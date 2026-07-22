import type {
  ProductionStateFinalReceipt,
  RunningProductionStateSidecar,
} from "./production-state-sidecar.js";
import type {
  SentinelGeneralAnthropicProviderFinalReceipt,
  SentinelGeneralAnthropicProviderProxy,
} from "./sentinel-general-provider-proxy.js";
import type { SentinelProductionCell, SentinelProductionTask } from "./sentinel-production-plan.js";
import type {
  SentinelProductionCheckoutPreflight,
  SentinelProductionContinuityReplayExport,
  SentinelProductionContinuityTenantReceipt,
  SentinelProductionServiceBinding,
} from "./sentinel-production-runner-manifests.js";
import type {
  SentinelProductionAttemptTerminalReceipt,
  SentinelProductionExecutableIdentity,
} from "./sentinel-production-supervisor.js";

export interface SentinelProductionCellPorts {
  readonly state: number;
  readonly provider: number;
  readonly server: number;
  readonly frontend: number;
}

export interface SentinelProductionCellExecutionContext {
  readonly cell: SentinelProductionCell;
  readonly task: SentinelProductionTask;
  readonly blockSequence: number;
  readonly attemptId: string;
  readonly checkoutPath: string;
  readonly checkoutPreflight: SentinelProductionCheckoutPreflight;
  readonly cellRoot: string;
  readonly stateEvidenceRoot: string;
  readonly stateStoreRoot: string;
  readonly providerRoot: string;
  readonly upstreamRoot: string;
  readonly continuityRoot: string;
  readonly agentConfigPath: string;
  readonly ports: SentinelProductionCellPorts;
  readonly stateToken: string;
  readonly providerToken: string;
  readonly tenant: string;
  readonly agentId: string;
  readonly scope: string;
  readonly failures: { stage: string; message: string }[];
  state?: RunningProductionStateSidecar;
  provider?: SentinelGeneralAnthropicProviderProxy;
  tenantReceipt?: SentinelProductionContinuityTenantReceipt;
  stateBinding?: SentinelProductionServiceBinding["state"];
  providerBinding?: SentinelProductionServiceBinding["provider"];
  agentConfig?: SentinelProductionExecutableIdentity;
  supervisorReceipt?: SentinelProductionAttemptTerminalReceipt;
  attemptInvokedAt?: string;
  attemptStartedAt?: string;
  stateFinal?: ProductionStateFinalReceipt;
  providerFinal?: SentinelGeneralAnthropicProviderFinalReceipt;
  replayExport?: SentinelProductionContinuityReplayExport;
}
