-- 0013_capability_input_schema.sql
--
-- G12 / ADR-0026 — invocation-input validation gate.
--
-- Adds an optional `input_schema` JSONB column to the capability registry.
-- Capabilities that declare an `inputSchema` field on their descriptor get
-- their resolved invocation inputs validated by the workflow runtime's
-- installed `InputValidator` BEFORE dispatch. Validation failure produces
-- a non-retryable `input_invalid` dead-letter, parallel to the
-- `permission_denied` / `capability_not_found` paths from G7 / G8.3.
--
-- Schema contents are intentionally open: the substrate doesn't constrain
-- the JSON Schema dialect. The substrate-shipped `builtinInputValidator()`
-- handles a useful subset (top-level type=object, required[], properties
-- with type, additionalProperties:false). Capabilities needing the full
-- spec wire ajv / hyperjump as a custom validator.
--
-- NULL is the default. Existing capabilities are unaffected (they default
-- to acceptAll behavior in the runtime). This is the migration-window
-- shape: capabilities opt into validation by setting `inputSchema`.

ALTER TABLE registry.capabilities
  ADD COLUMN IF NOT EXISTS input_schema JSONB;

COMMENT ON COLUMN registry.capabilities.input_schema IS
  'G12 / ADR-0026: optional JSON-Schema-shaped contract for resolved invocation inputs. NULL = no validation (legacy behavior).';
