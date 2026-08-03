CREATE TABLE IF NOT EXISTS forge_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  default_interface_locale text NOT NULL DEFAULT 'vi',
  default_technical_output_language text NOT NULL DEFAULT 'en',
  active_run_limit integer NOT NULL DEFAULT 1 CHECK (active_run_limit > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS forge_workspace_members (
  workspace_id uuid NOT NULL REFERENCES forge_workspaces(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT forge_workspace_members_identity_uq UNIQUE (workspace_id, user_id)
);
CREATE INDEX IF NOT EXISTS forge_workspace_members_user_idx ON forge_workspace_members(user_id);

CREATE TABLE IF NOT EXISTS forge_provider_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES forge_workspaces(id) ON DELETE CASCADE,
  provider_kind text NOT NULL,
  provider_key text NOT NULL,
  external_account_id text,
  display_name text NOT NULL,
  secret_handle text,
  status text NOT NULL,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS forge_provider_connections_workspace_idx ON forge_provider_connections(workspace_id);

CREATE TABLE IF NOT EXISTS forge_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES forge_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  source_connection_id uuid REFERENCES forge_provider_connections(id) ON DELETE SET NULL,
  source_provider text NOT NULL,
  external_repository_id text NOT NULL,
  namespace text NOT NULL,
  repository_name text NOT NULL,
  default_branch text NOT NULL,
  validation_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  interface_locale text NOT NULL,
  technical_output_language text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT forge_projects_repository_uq UNIQUE (workspace_id, source_provider, external_repository_id)
);
CREATE INDEX IF NOT EXISTS forge_projects_workspace_idx ON forge_projects(workspace_id);

CREATE TABLE IF NOT EXISTS forge_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES forge_workspaces(id) ON DELETE CASCADE,
  created_by text NOT NULL,
  title text NOT NULL,
  original_instruction text NOT NULL,
  instruction_language text NOT NULL,
  normalized_objective text NOT NULL,
  scope jsonb NOT NULL DEFAULT '[]'::jsonb,
  acceptance_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  constraints jsonb NOT NULL DEFAULT '[]'::jsonb,
  technical_output_language text NOT NULL,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS forge_tasks_workspace_idx ON forge_tasks(workspace_id);

CREATE TABLE IF NOT EXISTS forge_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES forge_tasks(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES forge_workspaces(id) ON DELETE CASCADE,
  iteration integer NOT NULL CHECK (iteration > 0),
  state text NOT NULL,
  review_outcome text,
  base_branch text NOT NULL,
  base_commit_sha text,
  working_branch text,
  agent_provider text NOT NULL,
  sandbox_provider text NOT NULL,
  budget_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  permission_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  sandbox_external_id text,
  started_at timestamptz,
  finished_at timestamptz,
  cancel_requested_at timestamptz,
  last_heartbeat_at timestamptz,
  event_sequence bigint NOT NULL DEFAULT 0 CHECK (event_sequence >= 0),
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  failure_code text,
  failure_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT forge_runs_task_iteration_uq UNIQUE (task_id, iteration)
);
CREATE INDEX IF NOT EXISTS forge_runs_workspace_state_idx ON forge_runs(workspace_id, state);
CREATE INDEX IF NOT EXISTS forge_runs_heartbeat_idx ON forge_runs(last_heartbeat_at);

CREATE TABLE IF NOT EXISTS forge_run_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES forge_runs(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES forge_workspaces(id) ON DELETE CASCADE,
  sequence bigint NOT NULL CHECK (sequence > 0),
  type text NOT NULL CHECK (char_length(type) BETWEEN 1 AND 128),
  actor_type text NOT NULL,
  actor_id text,
  correlation_id text,
  payload jsonb NOT NULL,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT forge_run_events_sequence_uq UNIQUE (run_id, sequence)
);
CREATE INDEX IF NOT EXISTS forge_run_events_cursor_idx ON forge_run_events(workspace_id, run_id, sequence);

CREATE TABLE IF NOT EXISTS forge_idempotency_records (
  workspace_id uuid NOT NULL REFERENCES forge_workspaces(id) ON DELETE CASCADE,
  operation text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'completed')),
  resource_type text,
  resource_id uuid,
  response jsonb,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT forge_idempotency_identity_uq UNIQUE (workspace_id, operation, idempotency_key)
);
CREATE INDEX IF NOT EXISTS forge_idempotency_expiry_idx ON forge_idempotency_records(expires_at);

CREATE TABLE IF NOT EXISTS forge_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES forge_runs(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES forge_workspaces(id) ON DELETE CASCADE,
  request_key text NOT NULL,
  action_type text NOT NULL,
  summary text NOT NULL,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_level text NOT NULL,
  status text NOT NULL,
  requested_at timestamptz NOT NULL,
  expires_at timestamptz,
  resolved_by text,
  resolved_at timestamptz,
  reason text,
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  CONSTRAINT forge_approval_requests_key_uq UNIQUE (run_id, request_key)
);
CREATE INDEX IF NOT EXISTS forge_approval_requests_pending_idx ON forge_approval_requests(workspace_id, status, expires_at);

CREATE TABLE IF NOT EXISTS forge_validation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES forge_runs(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES forge_workspaces(id) ON DELETE CASCADE,
  kind text NOT NULL,
  command text NOT NULL,
  requirement text NOT NULL,
  status text NOT NULL,
  exit_code integer,
  duration_ms integer,
  output_summary text,
  artifact_ref text,
  started_at timestamptz,
  finished_at timestamptz
);

CREATE TABLE IF NOT EXISTS forge_acceptance_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES forge_runs(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES forge_workspaces(id) ON DELETE CASCADE,
  criterion_key text NOT NULL,
  requirement text NOT NULL,
  status text NOT NULL,
  evidence_type text NOT NULL,
  evidence_ref text,
  explanation text NOT NULL,
  waived_by text,
  waived_reason text,
  waived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT forge_acceptance_evidence_criterion_uq UNIQUE (run_id, criterion_key),
  CONSTRAINT forge_acceptance_evidence_waiver_ck CHECK (
    status <> 'waived'
    OR (requirement = 'advisory' AND waived_by IS NOT NULL AND waived_reason IS NOT NULL AND waived_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS forge_review_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES forge_runs(id) ON DELETE CASCADE UNIQUE,
  workspace_id uuid NOT NULL REFERENCES forge_workspaces(id) ON DELETE CASCADE,
  decision text NOT NULL,
  decided_by text NOT NULL,
  rationale text,
  evidence_snapshot_version integer NOT NULL CHECK (evidence_snapshot_version >= 0),
  evidence_snapshot jsonb NOT NULL,
  advisory_waivers jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS forge_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES forge_runs(id) ON DELETE CASCADE UNIQUE,
  workspace_id uuid NOT NULL REFERENCES forge_workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_repository_id text NOT NULL,
  branch_name text NOT NULL,
  commit_sha text NOT NULL,
  change_request_id text,
  change_request_url text,
  status text NOT NULL,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS forge_publications_partial_idx ON forge_publications(workspace_id, status, updated_at);
