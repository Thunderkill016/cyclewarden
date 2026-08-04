CREATE TABLE IF NOT EXISTS forge_change_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES forge_runs(id) ON DELETE CASCADE UNIQUE,
  workspace_id uuid NOT NULL REFERENCES forge_workspaces(id) ON DELETE CASCADE,
  snapshot_version integer NOT NULL CHECK (snapshot_version >= 0),
  base_commit_sha text NOT NULL,
  head_commit_sha text NOT NULL,
  changed_files jsonb NOT NULL DEFAULT '[]'::jsonb,
  unified_diff text NOT NULL,
  diff_digest text NOT NULL CHECK (diff_digest ~ '^[a-f0-9]{64}$'),
  contains_binary boolean NOT NULL DEFAULT false,
  contains_secret_finding boolean NOT NULL DEFAULT false,
  agent_summary text NOT NULL,
  unresolved_risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  usage_estimate jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS forge_change_sets_workspace_idx
  ON forge_change_sets(workspace_id, run_id);

ALTER TABLE forge_publications
  ADD COLUMN IF NOT EXISTS evidence_snapshot_version integer,
  ADD COLUMN IF NOT EXISTS diff_digest text,
  ADD COLUMN IF NOT EXISTS unresolved_risks jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS forge_publications_change_request_uq
  ON forge_publications(provider, external_repository_id, change_request_id)
  WHERE change_request_id IS NOT NULL;
