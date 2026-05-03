/**
 * @pm/profile-registry — ProfileDefinition installation + write-time validator.
 *
 * Architecture rule (architecture.md, Layered ontology):
 *   "Profiles are libraries you ship, not hardcoded modules."
 *
 * Tenants opt into one or more profiles by registering ProfileDefinitions
 * here at provisioning time. The validator consults installed profiles at
 * every node/edge write to enforce the declared catalog.
 */

export type {
  ProfileRegistry,
  ProfileValidator,
  NodeWriteCheck,
  EdgeWriteCheck,
  LifecycleCheck,
} from "./interfaces.js";
export { PostgresProfileRegistry } from "./postgres.js";
export { ProfileValidationError } from "./errors.js";
