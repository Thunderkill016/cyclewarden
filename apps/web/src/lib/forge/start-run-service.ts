import { createHash, randomUUID } from "node:crypto";

import { ACTIVE_RUN_STATES } from "@cyclewarden/forge-domain";
import type { Sql } from "postgres";

import { createSql } from "@/lib/db";
import type { ForgeActor } from "./actor";
import { resolveForgeRepository } from "./repositories";
import type { ForgeStartRunInput } from "./start-run-input";

export type ForgeStartErrorCode =
  | "ACTIVE_RUN_EXISTS"
  | "CONNECTION_REVOKED"
  | "UNSUPPORTED_REPOSITORY"
  | "REQUEST_IN_PROGRESS"
  | "IDEMPOTENCY_KEY_CONFLICT"
  | "DATABASE_UNAVAILABLE";

export class ForgeStartRunError extends Error {
  constructor(
    readonly code: ForgeStartErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ForgeStartRunError";
  }
}

export interface ForgeStartRunResult {
  workspaceId: string;
  projectId: string;
  taskId: string;
  runId: string;
  iteration: number;
  state: "queued";
  repository: string;
  demo: boolean;
}

interface IdempotencyRow {
  request_hash: string;
  status: "pending" | "completed";
  response: ForgeStartRunResult | null;
}

const demoGlobal = globalThis as unknown as {
  __atorynForgeDemo?: {
    runs: ForgeStartRunResult[];
    idempotency: Map<string, { requestHash: string; result: ForgeStartRunResult }>;
  };
};

function demoState() {
  if (!demoGlobal.__atorynForgeDemo) {
    demoGlobal.__atorynForgeDemo = { runs: [], idempotency: new Map() };
  }
  return demoGlobal.__atorynForgeDemo;
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function requestHash(value: unknown): string {
  return createHash("sha256").update(stableSerialize(value)).digest("hex");
}

function assertRepository(input: ForgeStartRunInput) {
  const repository = resolveForgeRepository(input.repositoryId);
  if (!repository) {
    throw new ForgeStartRunError(
      "UNSUPPORTED_REPOSITORY",
      "This repository is not available to the current source connection.",
    );
  }
  if (repository.status === "revoked") {
    throw new ForgeStartRunError(
      "CONNECTION_REVOKED",
      "The source connection was revoked. Reconnect it before starting a run.",
    );
  }
  if (!repository.supported || repository.status !== "active") {
    throw new ForgeStartRunError(
      "UNSUPPORTED_REPOSITORY",
      "This repository is archived or unsupported by the current MVP.",
    );
  }
  if (repository.defaultBranch !== input.baseBranch) {
    throw new ForgeStartRunError(
      "UNSUPPORTED_REPOSITORY",
      "The reviewed base branch no longer matches the repository.",
    );
  }
  return repository;
}

async function ensureWorkspace(sql: Sql, actor: ForgeActor): Promise<string> {
  return sql.begin(async (transaction) => {
    await transaction`SELECT pg_advisory_xact_lock(hashtextextended(${actor.id}, 0))`;
    const existing = await transaction<{ workspace_id: string }[]>`
      SELECT workspace_id
      FROM forge_workspace_members
      WHERE user_id = ${actor.id}
      ORDER BY created_at ASC
      LIMIT 1
    `;
    if (existing[0]) return existing[0].workspace_id;

    const workspaceId = randomUUID();
    await transaction`
      INSERT INTO forge_workspaces (
        id, name, default_interface_locale,
        default_technical_output_language, active_run_limit
      ) VALUES (
        ${workspaceId}::uuid,
        ${`${actor.displayName}'s workspace`},
        'vi', 'en', 1
      )
    `;
    await transaction`
      INSERT INTO forge_workspace_members (workspace_id, user_id, role)
      VALUES (${workspaceId}::uuid, ${actor.id}, 'owner')
    `;
    return workspaceId;
  });
}

async function startPersistedRun(input: {
  sql: Sql;
  actor: ForgeActor;
  request: ForgeStartRunInput;
}): Promise<ForgeStartRunResult> {
  const repository = assertRepository(input.request);
  const workspaceId = await ensureWorkspace(input.sql, input.actor);
  const hash = requestHash(input.request);

  return input.sql.begin(async (transaction) => {
    const inserted = await transaction<{ request_hash: string }[]>`
      INSERT INTO forge_idempotency_records (
        workspace_id, operation, idempotency_key, request_hash,
        status, expires_at
      ) VALUES (
        ${workspaceId}::uuid,
        'start-run',
        ${input.request.idempotencyKey},
        ${hash},
        'pending',
        now() + interval '24 hours'
      )
      ON CONFLICT (workspace_id, operation, idempotency_key) DO NOTHING
      RETURNING request_hash
    `;

    if (!inserted[0]) {
      const existing = await transaction<IdempotencyRow[]>`
        SELECT request_hash, status, response
        FROM forge_idempotency_records
        WHERE workspace_id = ${workspaceId}::uuid
          AND operation = 'start-run'
          AND idempotency_key = ${input.request.idempotencyKey}
        LIMIT 1
      `;
      const row = existing[0];
      if (!row || row.request_hash !== hash) {
        throw new ForgeStartRunError(
          "IDEMPOTENCY_KEY_CONFLICT",
          "The request key was already used with different input.",
        );
      }
      if (row.status === "completed" && row.response) return row.response;
      throw new ForgeStartRunError(
        "REQUEST_IN_PROGRESS",
        "An identical start request is still being processed.",
      );
    }

    const workspace = await transaction<{ active_run_limit: number }[]>`
      SELECT active_run_limit
      FROM forge_workspaces
      WHERE id = ${workspaceId}::uuid
      FOR UPDATE
    `;
    const limit = workspace[0]?.active_run_limit ?? 1;
    const active = await transaction<{ id: string }[]>`
      SELECT id
      FROM forge_runs
      WHERE workspace_id = ${workspaceId}::uuid
        AND state IN ${transaction([...ACTIVE_RUN_STATES])}
      ORDER BY created_at ASC
      LIMIT ${limit}
    `;
    if (active.length >= limit) {
      throw new ForgeStartRunError(
        "ACTIVE_RUN_EXISTS",
        "This workspace already has an active run. Review or cancel it before starting another.",
      );
    }

    const projectRows = await transaction<{ id: string }[]>`
      INSERT INTO forge_projects (
        id, workspace_id, name, source_provider, external_repository_id,
        namespace, repository_name, default_branch, validation_profile,
        interface_locale, technical_output_language, status
      ) VALUES (
        ${randomUUID()}::uuid,
        ${workspaceId}::uuid,
        ${repository.name},
        ${repository.provider},
        ${repository.id},
        ${repository.namespace},
        ${repository.name},
        ${repository.defaultBranch},
        ${transaction.json({ test: { command: "pnpm test", requirement: "constitution" } })},
        ${input.request.instructionLanguage},
        ${input.request.technicalOutputLanguage},
        'active'
      )
      ON CONFLICT (workspace_id, source_provider, external_repository_id)
      DO UPDATE SET
        default_branch = EXCLUDED.default_branch,
        status = 'active',
        updated_at = now()
      RETURNING id
    `;
    const projectId = projectRows[0]?.id;
    if (!projectId) throw new Error("Project upsert returned no row");

    const taskId = randomUUID();
    const runId = randomUUID();
    const criterion = {
      key: "requested-change",
      description: "The requested change is implemented and validation passes.",
      requirement: "task_mandatory",
    };
    await transaction`
      INSERT INTO forge_tasks (
        id, project_id, workspace_id, created_by, title,
        original_instruction, instruction_language, normalized_objective,
        scope, acceptance_criteria, constraints,
        technical_output_language, status
      ) VALUES (
        ${taskId}::uuid,
        ${projectId}::uuid,
        ${workspaceId}::uuid,
        ${input.actor.id},
        ${input.request.instruction.slice(0, 120)},
        ${input.request.instruction},
        ${input.request.instructionLanguage},
        ${input.request.instruction},
        ${transaction.json(["repository"])},
        ${transaction.json([criterion])},
        ${transaction.json(["No production deployment", "No direct base-branch write"])},
        ${input.request.technicalOutputLanguage},
        'running'
      )
    `;
    await transaction`
      INSERT INTO forge_runs (
        id, task_id, workspace_id, iteration, state, base_branch,
        agent_provider, sandbox_provider, budget_policy,
        permission_policy, event_sequence, version
      ) VALUES (
        ${runId}::uuid,
        ${taskId}::uuid,
        ${workspaceId}::uuid,
        1,
        'queued',
        ${input.request.baseBranch},
        ${input.request.agentProvider},
        'fake-sandbox',
        ${transaction.json({ maxUsd: input.request.budgetUsd })},
        ${transaction.json({ network: input.request.networkPolicy })},
        1,
        0
      )
    `;
    await transaction`
      INSERT INTO forge_run_events (
        run_id, workspace_id, sequence, type, actor_type,
        actor_id, payload, schema_version
      ) VALUES (
        ${runId}::uuid,
        ${workspaceId}::uuid,
        1,
        'run.created',
        'user',
        ${input.actor.id},
        ${transaction.json({
          taskId,
          iteration: 1,
          repositoryId: repository.id,
          reviewed: true,
        })},
        1
      )
    `;

    const result: ForgeStartRunResult = {
      workspaceId,
      projectId,
      taskId,
      runId,
      iteration: 1,
      state: "queued",
      repository: `${repository.namespace}/${repository.name}`,
      demo: false,
    };
    await transaction`
      UPDATE forge_idempotency_records
      SET status = 'completed',
          resource_type = 'run',
          resource_id = ${runId}::uuid,
          response = ${transaction.json(result)},
          updated_at = now()
      WHERE workspace_id = ${workspaceId}::uuid
        AND operation = 'start-run'
        AND idempotency_key = ${input.request.idempotencyKey}
    `;
    return result;
  });
}

function startDemoRun(input: {
  actor: ForgeActor;
  request: ForgeStartRunInput;
}): ForgeStartRunResult {
  const repository = assertRepository(input.request);
  const state = demoState();
  const hash = requestHash(input.request);
  const key = `${input.actor.id}:${input.request.idempotencyKey}`;
  const existing = state.idempotency.get(key);
  if (existing) {
    if (existing.requestHash !== hash) {
      throw new ForgeStartRunError(
        "IDEMPOTENCY_KEY_CONFLICT",
        "The request key was already used with different input.",
      );
    }
    return existing.result;
  }
  if (state.runs.some((run) => run.workspaceId === input.actor.id && run.state === "queued")) {
    throw new ForgeStartRunError(
      "ACTIVE_RUN_EXISTS",
      "This demo workspace already has an active run.",
    );
  }

  const result: ForgeStartRunResult = {
    workspaceId: input.actor.id,
    projectId: randomUUID(),
    taskId: randomUUID(),
    runId: randomUUID(),
    iteration: 1,
    state: "queued",
    repository: `${repository.namespace}/${repository.name}`,
    demo: true,
  };
  state.runs.push(result);
  state.idempotency.set(key, { requestHash: hash, result });
  return result;
}

export async function startGovernedForgeRun(input: {
  actor: ForgeActor;
  request: ForgeStartRunInput;
  forceMemory?: boolean;
}): Promise<ForgeStartRunResult> {
  if (!input.forceMemory) {
    const sql = createSql();
    if (sql) return startPersistedRun({ sql, actor: input.actor, request: input.request });
  }
  return startDemoRun({ actor: input.actor, request: input.request });
}

export function resetForgeDemoStateForTests(): void {
  delete demoGlobal.__atorynForgeDemo;
}
