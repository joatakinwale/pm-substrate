import type { Arm } from "./scenario.js";

export type LabMutationType =
  | "stale_state"
  | "conflicting_context"
  | "invalidated_assumption"
  | "changed_working_condition";

export interface LabMutation {
  readonly id: string;
  readonly type: LabMutationType;
  readonly targetAgentId?: string;
  readonly targetArm?: Arm | "both";
  readonly description: string;
  readonly createdAt?: string;
}
