/**
 * @pm/capability-wedding-contracts — owns Contract entities + lifecycle.
 *
 * Profile-bound capability: only valid for tenants with the wedding profile
 * installed. Demonstrates the second tier of the architecture — Tier-2 tools
 * that bind to specific profile shapes — alongside the Tier-1 audit tool.
 *
 * Operations:
 *   - draft(input)           — create a Contract in state "draft"
 *   - send(contractId)       — draft → sent     (emits wedding.contract.sent)
 *   - sign(contractId)       — sent  → signed   (emits wedding.contract.signed)
 *   - startWork(contractId)  — signed → in_progress
 *   - complete(contractId)   — in_progress → completed
 *   - cancel(contractId)     — any non-terminal → cancelled
 *
 * Each transition writes the new state to the graph AND publishes the
 * corresponding event in the same Postgres transaction. ADR-0004 (NOTIFY
 * transactionality) + the @pm/graph atomicity test cover the contract.
 */

export { WEDDING_CONTRACTS_CAPABILITY } from "./capability.js";
export { WeddingContracts } from "./service.js";
export type { DraftContractInput } from "./service.js";
