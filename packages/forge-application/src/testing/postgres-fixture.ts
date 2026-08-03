import { randomUUID } from "node:crypto";

import postgres, { type Sql } from "postgres";
import { describe } from "vitest";

export const databaseUrl = process.env.DATABASE_URL;
export const describeDatabase = databaseUrl ? describe : describe.skip;

export function createTestSql(): Sql {
  if (!databaseUrl) {
    // Suites using this client are registered with describe.skip. Returning a
    // typed inert value prevents module-import failures during ordinary local
    // test runs that intentionally have no database.
    return null as unknown as Sql;
  }
  return postgres(databaseUrl, { max: 5 });
}

export async function resetForgeTables(sql: Sql): Promise<void> {
  await sql.unsafe(`
    TRUNCATE TABLE
      forge_run_events,
      forge_publications,
      forge_review_decisions,
      forge_acceptance_evidence,
      forge_validation_results,
      forge_approval_requests,
      forge_idempotency_records,
      forge_runs,
      forge_tasks,
      forge_projects,
      forge_provider_connections,
      forge_workspace_members,
      forge_workspaces
    RESTART IDENTITY CASCADE
  `);
}

export interface SeededRun {
  workspaceId: string;
  otherWorkspaceId: string;
  projectId: string;
  taskId: string;
  runId: string;
  approvalId: string;
}

export async function seedRun(sql: Sql, input?: {
  state?: string;
  version?: number;
  lastHeartbeatAt?: Date | null;
}): Promise<SeededRun> {
  const workspaceId = randomUUID();
  const otherWorkspaceId = randomUUID();
  const projectId = randomUUID();
  const taskId = randomUUID();
  const runId = randomUUID();
  const approvalId = randomUUID();

  await sql`
    INSERT INTO forge_workspaces (id, name)
    VALUES (${workspaceId}::uuid, 'Workspace A'), (${otherWorkspaceId}::uuid, 'Workspace B')
  `;
  await sql`
    INSERT INTO forge_projects (
      id, workspace_id, name, source_provider, external_repository_id,
      namespace, repository_name, default_branch, validation_profile,
      interface_locale, technical_output_language, status
    ) VALUES (
      ${projectId}::uuid, ${workspaceId}::uuid, 'Fixture', 'fake-source', 'repo-1',
      'fixture', 'app', 'main', ${sql.json({})}, 'en', 'en', 'active'
    )
  `;
  await sql`
    INSERT INTO forge_tasks (
      id, project_id, workspace_id, created_by, title, original_instruction,
      instruction_language, normalized_objective, scope, acceptance_criteria,
      constraints, technical_output_language, status
    ) VALUES (
      ${taskId}::uuid, ${projectId}::uuid, ${workspaceId}::uuid, 'user-1',
      'Fixture task', 'Do work', 'en', 'Do work', ${sql.json([])},
      ${sql.json([])}, ${sql.json([])}, 'en', 'running'
    )
  `;
  await sql`
    INSERT INTO forge_runs (
      id, task_id, workspace_id, iteration, state, base_branch,
      agent_provider, sandbox_provider, budget_policy, permission_policy,
      version, last_heartbeat_at
    ) VALUES (
      ${runId}::uuid, ${taskId}::uuid, ${workspaceId}::uuid, 1,
      ${input?.state ?? "queued"}, 'main', 'fake-agent', 'fake-sandbox',
      ${sql.json({})}, ${sql.json({})}, ${input?.version ?? 0},
      ${input?.lastHeartbeatAt ?? null}
    )
  `;
  await sql`
    INSERT INTO forge_approval_requests (
      id, run_id, workspace_id, request_key, action_type, summary, scope,
      risk_level, status, requested_at, expires_at, version
    ) VALUES (
      ${approvalId}::uuid, ${runId}::uuid, ${workspaceId}::uuid, 'approval-1',
      'secret_access', 'Access secret', ${sql.json({})}, 'high', 'pending', now(),
      now() + interval '1 hour', 0
    )
  `;

  return { workspaceId, otherWorkspaceId, projectId, taskId, runId, approvalId };
}
