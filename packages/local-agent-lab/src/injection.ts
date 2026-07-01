export type LabInjectionType = "prompt_task" | "file_context";

export interface LabInjection {
  readonly id: string;
  readonly type: LabInjectionType;
  readonly targetAgentId?: string;
  readonly prompt?: string;
  readonly fileRefs?: readonly string[];
  readonly createdAt?: string;
}
