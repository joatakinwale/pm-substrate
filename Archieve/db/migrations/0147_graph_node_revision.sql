-- 0147_graph_node_revision.sql
--
-- Split profile schema version from optimistic-concurrency revision.
-- `graph.nodes.schema_version` is the profile entity schema version. Older
-- graph updates incremented it as a row revision, which could make valid
-- profile-bound updates fail profile validation after the first mutation.

ALTER TABLE graph.nodes
  ADD COLUMN IF NOT EXISTS revision INTEGER;

UPDATE graph.nodes
   SET revision = GREATEST(1, schema_version)
 WHERE revision IS NULL;

WITH installed_profile_versions AS (
  SELECT
    n.id,
    (p.definition -> 'entityTypes' -> n.concrete ->> 'schemaVersion')::INTEGER
      AS profile_schema_version
    FROM graph.nodes n
    JOIN profiles.installations p
      ON p.tenant_id = n.tenant_id
     AND p.name = n.profile
   WHERE n.profile IS NOT NULL
     AND p.definition -> 'entityTypes' ? n.concrete
     AND p.definition -> 'entityTypes' -> n.concrete ? 'schemaVersion'
)
UPDATE graph.nodes n
   SET schema_version = installed_profile_versions.profile_schema_version
  FROM installed_profile_versions
 WHERE n.id = installed_profile_versions.id
   AND installed_profile_versions.profile_schema_version IS NOT NULL;

ALTER TABLE graph.nodes
  ALTER COLUMN revision SET DEFAULT 1,
  ALTER COLUMN revision SET NOT NULL;

COMMENT ON COLUMN graph.nodes.schema_version IS
  'Profile entity schema version the node identity was written under.';

COMMENT ON COLUMN graph.nodes.revision IS
  'Monotonic row revision used for optimistic concurrency on identity updates.';
