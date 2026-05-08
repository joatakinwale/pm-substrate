import type { PMEvent, TenantId, WorkflowId } from "@pm/types";

export interface PermissionCheck {
  readonly tenantId: TenantId;
  readonly workflowId: WorkflowId;
  readonly workflowName: string;
  readonly workflowVersion: number;
  readonly nodeId: string;
  readonly capability: string;
  readonly requiredPermissions: readonly string[];
  readonly triggerEvent: PMEvent;
}

export type PermissionDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: string };

export interface PermissionAuthorizer {
  authorize(ctx: PermissionCheck): Promise<PermissionDecision>;
}

export const allowAllAuthorizer = (): PermissionAuthorizer => ({
  async authorize(): Promise<PermissionDecision> {
    return { allowed: true };
  },
});
