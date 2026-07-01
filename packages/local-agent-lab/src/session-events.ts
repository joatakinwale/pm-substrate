import type { Arm, EvalResult, IntendedAction, Observation } from "./scenario.js";

export type LabSessionMode = "substrate" | "no_substrate" | "ab_pair";

export type LabSessionStatus = "running" | "completed" | "stopped" | "failed";

export type LabSessionEventType =
  | "session_created"
  | "agent_started"
  | "agent_stopped"
  | "arm_started"
  | "world_seeded"
  | "agent_observed"
  | "representation_stored"
  | "injection_created"
  | "injection_applied"
  | "mutation_created"
  | "mutation_applied"
  | "action_proposed"
  | "unsafe_action_attempted"
  | "action_admitted"
  | "action_refused"
  | "oracle_verdict"
  | "arm_completed"
  | "arm_diverged"
  | "session_stopped"
  | "session_completed"
  | "session_failed";

export interface LabSessionEvent {
  readonly id: string;
  readonly type: LabSessionEventType;
  readonly sessionId: string;
  readonly scenarioId: string;
  readonly failureClass: string;
  readonly occurredAt: string;
  readonly agentId?: string;
  readonly arm?: Arm;
  readonly message: string;
  readonly observation?: Observation;
  readonly action?: IntendedAction;
  readonly result?: EvalResult;
  readonly payload?: Readonly<Record<string, unknown>>;
}

export type LabSessionEventListener = (event: LabSessionEvent) => void;
