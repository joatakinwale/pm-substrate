import type { Arm } from "./scenario.js";

export type LabInjectionType = "prompt_task" | "file_context";

export interface LabInjection {
  readonly id: string;
  readonly type: LabInjectionType;
  readonly targetAgentId?: string;
  readonly targetArm?: Arm | "both";
  readonly prompt?: string;
  readonly fileRefs?: readonly string[];
  readonly createdAt?: string;
}
