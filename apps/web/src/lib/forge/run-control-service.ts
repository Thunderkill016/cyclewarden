import { createHash } from "node:crypto";

import type { Sql } from "postgres";

import { createSql } from "@/lib/db";
import type { ForgeActor } from "./actor";

export type ForgeRunState =
  | "draft"
  | "queued"
  | "provisioning"
  | "running"
  | "awaiting_approval"
  | "cancelling"
  | "validating"
  | "awaiting_review"
  | "publishing"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export interface ForgeRunEventView {
  id: string;
  sequence: number;
  type: string;
  actorType: string;
  actorId: string | null;
  payload: unknown;
  createdAt: string;
}

export interface ForgeApprovalView {
  id: string;
  requestKey: string;
  actionType: string;
  summary: string;
  scope: unknown;
  riskLevel: string;
  status: string;
  version: number;
  requestedAt: string;
  resolvedAt: string | null;
  reason: string | null;
}

export interface ForgeRunView {
  snapshot: {
    id: string;
    workspaceId: string;
    taskId: string;
    iteration: number;
    state: ForgeRunState;
    eventSequence: number;
    version: number;
    baseBranch: string;
    agentProvider: string;
    cancelRequestedAt: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    updatedAt: string;
  };
  task: {
    title: string;
    originalInstruction: string;
    instructionLanguage: string;
    technicalOutputLanguage: string;
  };
  project: {
    name: string;
    repository: string;
    provider: string;
  };
  events: ForgeRunEventView[];
  approvals: ForgeApprovalView[];
}

export interface ForgeCommandResult {
  runId: string;
  state: ForgeRunState;
  version: number;
  events: ForgeRunEventView[];
  approval?: ForgeApprovalView;
  replayed?: boolean;
}

export class ForgeRunControlError extends Error {
  constructor(
    readonly code:
      | "DATABASE_UNAVAILABLE"
      | "INVALID_RUN_ID"
      | "NOT_FOUND_OR_UNAUTHORIZED"
      | "INVALID_COMMAND"
      | "RUN_NOT_CONTROLLABLE"
      | "IDEMPOTENCY_KEY_CONFLICT"
      | "REQUEST_IN_PROGRESS"
      | "OPTIMISTIC_CONCURRENCY_CONFLICT",
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ForgeRunControlError";
  }
}

type PostgresRows = readonly (object | undefined)[];

/** Shared callable subset implemented by both postgres.js Sql and TransactionSql. */
interface QueryableSql {
  <T extends PostgresRows = Record<string, unknown>[]>(
    strings: TemplateStringsArray,
    ...parameters: any[]
  ): Promise<T>;
}

interface AuthorizedRunRow {
  id: string;
  workspace_id: string;
  task_id: string;
  iteration: number;
  state: ForgeRunState;
  event_sequence: string;
  version: number;
  base_branch: string;
  agent_provider: string;
  cancel_requested_at: Date | null;
  started_at: Date | null;
  finished_at: Date | null;
  updated_at: Date;
  title: string;
  original_instruction: string;
  instruction_language: string;
  technical_output_language: string;
  project_name: string;
  namespace: string;
  repository_name: string;
  source_provider: string;
}

interface EventRow {
  id: string;
  sequence: string;
  type: string;
  actor_type: string;
  actor_id: string | null;
  payload: unknown;
  created_at: Date;
}

interface ApprovalRow {
  id: string;
  request_key: string;
  action_type: string;
  summary: string;
  scope: unknown;
  risk_level: string;
  status: string;
  version: number;
  requested_at: Date;
  resolved_at: Date | null;
  reason: string | null;
}

interface IdempotencyRow {
  request_hash: string;
  status: string;
  response: ForgeCommandResult | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INSTRUCTION_STATES = new Set<ForgeRunState>([
  "queued",
  "provisioning",
  "running",
  "awaiting_approval",
  "validating",
]);
const CANCELLABLE_STATES = new Set<ForgeRunState>([
  "queued",
  "provisioning",
  "running",
  "awaiting_approval",
  "validating",
]);

function requireSql(): Sql {
  const sql = createSql();
  if (!sql) {
    throw new ForgeRunControlError(
      "DATABASE_UNAVAILABLE",
      "Durable Forge run controls require PostgreSQL.",
      503,
    );
  }
  return sql;
}

function assertUuid(value: string, label = "Run ID"): void {
  if (!UUID.test(value)) {
    throw new ForgeRunControlError("INVALID_RUN_ID", `${label} is invalid.`, 400);
  }
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

function commandHash(value: unknown): string {
  return createHash("sha256").update(stableSerialize(value)).digest("hex");
}

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function mapEvent(row: EventRow): ForgeRunEventView {
  return {
    id: row.id,
    sequence: Number(row.sequence),
    type: row.type,
    actorType: row.actor_type,
    actorId: row.actor_id,
    payload: row.payload,
    createdAt: row.created_at.toISOString(),
  };
}

function mapApproval(row: ApprovalRow): ForgeApprovalView {
  return {
    id: row.id,
    requestKey: row.request_key,
    actionType: row.action_type,
    summary: row.summary,
    scope: row.scope,
    riskLevel: row.risk_level,
    status: row.status,
    version: row.version,
    requestedAt: row.requested_at.toISOString(),
    resolvedAt: iso(row.resolved_at),
    reason: row.reason,
  };
}

async function getAuthorizedRun(
  sql: QueryableSql,
  actor: ForgeActor,
  runId: string,
): Promise<AuthorizedRunRow> {
  assertUuid(runId);
  const rows = await sql<AuthorizedRunRow[]>`
    SELECT r.id, r.workspace_id, r.task_id, r.iteration, r.state,
           r.event_sequence, r.version, r.base_branch, r.agent_provider,
           r.cancel_requested_at, r.started_at, r.finished_at, r.updated_at,
           t.title, t.original_instruction, t.instruction_language,
           t.technical_output_language, p.name AS project_name,
           p.namespace, p.repository_name, p.source_provider
    FROM forge_runs r
    JOIN forge_tasks t ON t.id = r.task_id
    JOIN forge_projects p ON p.id = t.project_id
    JOIN forge_workspace_members m ON m.workspace_id = r.workspace_id
    WHERE r.id = ${runId}::uuid
      AND m.user_id = ${actor.id}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) {
    throw new ForgeRunControlError(
      "NOT_FOUND_OR_UNAUTHORIZED",
      "Run was not found.",
      404,
    );
  }
  return row;
}

async function readEvents(
  sql: QueryableSql,
  workspaceId: string,
  runId: string,
  afterSequence: number,
  limit = 200,
): Promise<ForgeRunEventView[]> {
  if (!Number.isInteger(afterSequence) || afterSequence < 0) {
    throw new ForgeRunControlError("INVALID_COMMAND", "Event cursor is invalid.", 400);
  }
  const rows = await sql<EventRow[]>`
    SELECT id, sequence, type, actor_type, actor_id, payload, created_at
    FROM forge_run_events
    WHERE workspace_id = ${workspaceId}::uuid
      AND run_id = ${runId}::uuid
      AND sequence > ${afterSequence}
    ORDER BY sequence ASC
    LIMIT ${limit}
  `;
  return rows.map(mapEvent);
}

async function readApprovals(
  sql: QueryableSql,
  workspaceId: string,
  runId: string,
): Promise<ForgeApprovalView[]> {
  const rows = await sql<ApprovalRow[]>`
    SELECT id, request_key, action_type, summary, scope, risk_level,
           status, version, requested_at, resolved_at, reason
    FROM forge_approval_requests
    WHERE workspace_id = ${workspaceId}::uuid
      AND run_id = ${runId}::uuid
    ORDER BY requested_at ASC
  `;
  return rows.map(mapApproval);
}

export async function getForgeRunView(
  actor: ForgeActor,
  runId: string,
  afterSequence = 0,
): Promise<ForgeRunView> {
  const sql = requireSql();
  const row = await getAuthorizedRun(sql, actor, runId);
  const [events, approvals] = await Promise.all([
    readEvents(sql, row.workspace_id, runId, afterSequence),
    readApprovals(sql, row.workspace_id, runId),
  ]);
  return {
    snapshot: {
      id: row.id,
      workspaceId: row.workspace_id,
      taskId: row.task_id,
      iteration: row.iteration,
      state: row.state,
      eventSequence: Number(row.event_sequence),
      version: row.version,
      baseBranch: row.base_branch,
      agentProvider: row.agent_provider,
      cancelRequestedAt: iso(row.cancel_requested_at),
      startedAt: iso(row.started_at),
      finishedAt: iso(row.finished_at),
      updatedAt: row.updated_at.toISOString(),
    },
    task: {
      title: row.title,
      originalInstruction: row.original_instruction,
      instructionLanguage: row.instruction_language,
      technicalOutputLanguage: row.technical_output_language,
    },
    project: {
      name: row.project_name,
      repository: `${row.namespace}/${row.repository_name}`,
      provider: row.source_provider,
    },
    events,
    approvals,
  };
}

export async function getForgeRunEvents(
  actor: ForgeActor,
  runId: string,
  afterSequence: number,
): Promise<ForgeRunEventView[]> {
  const sql = requireSql();
  const row = await getAuthorizedRun(sql, actor, runId);
  return readEvents(sql, row.workspace_id, runId, afterSequence);
}

async function claimCommand(
  sql: QueryableSql,
  input: {
    workspaceId: string;
    operation: string;
    idempotencyKey: string;
    requestHash: string;
  },
): Promise<ForgeCommandResult | null> {
  const inserted = await sql<{ request_hash: string }[]>`
    INSERT INTO forge_idempotency_records (
      workspace_id, operation, idempotency_key, request_hash,
      status, expires_at
    ) VALUES (
      ${input.workspaceId}::uuid,
      ${input.operation},
      ${input.idempotencyKey},
      ${input.requestHash},
      'pending',
      now() + interval '24 hours'
    )
    ON CONFLICT (workspace_id, operation, idempotency_key) DO NOTHING
    RETURNING request_hash
  `;
  if (inserted[0]) return null;

  const existing = await sql<IdempotencyRow[]>`
    SELECT request_hash, status, response
    FROM forge_idempotency_records
    WHERE workspace_id = ${input.workspaceId}::uuid
      AND operation = ${input.operation}
      AND idempotency_key = ${input.idempotencyKey}
    LIMIT 1
  `;
  const row = existing[0];
  if (!row || row.request_hash !== input.requestHash) {
    throw new ForgeRunControlError(
      "IDEMPOTENCY_KEY_CONFLICT",
      "This command key was already used with different input.",
      409,
    );
  }
  if (row.status === "completed" && row.response) {
    return { ...row.response, replayed: true };
  }
  throw new ForgeRunControlError(
    "REQUEST_IN_PROGRESS",
    "An identical command is still being processed.",
    409,
  );
}

async function completeCommand(
  sql: QueryableSql,
  input: {
    workspaceId: string;
    operation: string;
    idempotencyKey: string;
    response: ForgeCommandResult;
  },
): Promise<void> {
  await sql`
    UPDATE forge_idempotency_records
    SET status = 'completed',
        resource_type = 'run',
        resource_id = ${input.response.runId}::uuid,
        response = ${JSON.stringify(input.response)}::jsonb,
        updated_at = now()
    WHERE workspace_id = ${input.workspaceId}::uuid
      AND operation = ${input.operation}
      AND idempotency_key = ${input.idempotencyKey}
  `;
}

function isSensitiveInstruction(instruction: string): boolean {
  return /\b(network|package|registry|secret|deploy|production)\b/i.test(instruction);
}

export async function addForgeInstruction(input: {
  actor: ForgeActor;
  runId: string;
  instruction: string;
  idempotencyKey: string;
}): Promise<ForgeCommandResult> {
  const instruction = input.instruction.trim();
  if (instruction.length < 3 || instruction.length > 2_000) {
    throw new ForgeRunControlError(
      "INVALID_COMMAND",
      "Instruction must contain between 3 and 2,000 characters.",
      400,
    );
  }
  if (!input.idempotencyKey || input.idempotencyKey.length > 200) {
    throw new ForgeRunControlError("INVALID_COMMAND", "Command key is invalid.", 400);
  }

  const root = requireSql();
  return root.begin(async (transaction) => {
    const run = await getAuthorizedRun(transaction, input.actor, input.runId);
    if (!INSTRUCTION_STATES.has(run.state)) {
      throw new ForgeRunControlError(
        "RUN_NOT_CONTROLLABLE",
        `Instructions cannot be added while the run is ${run.state}.`,
        409,
      );
    }
    const operation = "add-instruction";
    const replay = await claimCommand(transaction, {
      workspaceId: run.workspace_id,
      operation,
      idempotencyKey: input.idempotencyKey,
      requestHash: commandHash({ instruction }),
    });
    if (replay) return replay;

    const sensitive = isSensitiveInstruction(instruction);
    const sequenceDelta = sensitive ? 2 : 1;
    const updated = await transaction<{
      state: ForgeRunState;
      version: number;
      event_sequence: string;
    }[]>`
      UPDATE forge_runs
      SET event_sequence = event_sequence + ${sequenceDelta},
          version = version + 1,
          updated_at = now()
      WHERE id = ${input.runId}::uuid
        AND workspace_id = ${run.workspace_id}::uuid
      RETURNING state, version, event_sequence
    `;
    const current = updated[0];
    if (!current) {
      throw new ForgeRunControlError("NOT_FOUND_OR_UNAUTHORIZED", "Run was not found.", 404);
    }
    const finalSequence = Number(current.event_sequence);
    const instructionSequence = finalSequence - (sensitive ? 1 : 0);
    const instructionPayload = {
      instruction,
      accepted: true,
      technicalOutputLanguage: run.technical_output_language,
    };
    const instructionRows = await transaction<EventRow[]>`
      INSERT INTO forge_run_events (
        run_id, workspace_id, sequence, type, actor_type,
        actor_id, payload, schema_version
      ) VALUES (
        ${input.runId}::uuid,
        ${run.workspace_id}::uuid,
        ${instructionSequence}::bigint,
        'run.instruction.added',
        'user',
        ${input.actor.id},
        ${JSON.stringify(instructionPayload)}::jsonb,
        1
      )
      RETURNING id, sequence, type, actor_type, actor_id, payload, created_at
    `;
    const events = instructionRows.map(mapEvent);
    let approval: ForgeApprovalView | undefined;

    if (sensitive) {
      const approvalRows = await transaction<ApprovalRow[]>`
        INSERT INTO forge_approval_requests (
          run_id, workspace_id, request_key, action_type, summary,
          scope, risk_level, status, requested_at, version
        ) VALUES (
          ${input.runId}::uuid,
          ${run.workspace_id}::uuid,
          ${`instruction:${input.idempotencyKey}`},
          'sensitive_instruction',
          'Approve the sensitive instruction before provider execution.',
          ${JSON.stringify({ instruction })}::jsonb,
          'medium',
          'pending',
          now(),
          0
        )
        ON CONFLICT (run_id, request_key) DO UPDATE
          SET summary = EXCLUDED.summary
        RETURNING id, request_key, action_type, summary, scope, risk_level,
                  status, version, requested_at, resolved_at, reason
      `;
      const approvalRow = approvalRows[0];
      if (!approvalRow) throw new Error("Approval insert returned no row");
      approval = mapApproval(approvalRow);
      const approvalEvents = await transaction<EventRow[]>`
        INSERT INTO forge_run_events (
          run_id, workspace_id, sequence, type, actor_type,
          actor_id, payload, schema_version
        ) VALUES (
          ${input.runId}::uuid,
          ${run.workspace_id}::uuid,
          ${finalSequence}::bigint,
          'approval.requested',
          'system',
          null,
          ${JSON.stringify({
            approvalId: approval.id,
            summary: approval.summary,
            riskLevel: approval.riskLevel,
            version: approval.version,
          })}::jsonb,
          1
        )
        RETURNING id, sequence, type, actor_type, actor_id, payload, created_at
      `;
      events.push(...approvalEvents.map(mapEvent));
    }

    const response: ForgeCommandResult = {
      runId: input.runId,
      state: current.state,
      version: current.version,
      events,
      approval,
    };
    await completeCommand(transaction, {
      workspaceId: run.workspace_id,
      operation,
      idempotencyKey: input.idempotencyKey,
      response,
    });
    return response;
  });
}

export async function cancelForgeRun(input: {
  actor: ForgeActor;
  runId: string;
  idempotencyKey: string;
  reason?: string;
}): Promise<ForgeCommandResult> {
  if (!input.idempotencyKey || input.idempotencyKey.length > 200) {
    throw new ForgeRunControlError("INVALID_COMMAND", "Command key is invalid.", 400);
  }
  const reason = input.reason?.trim().slice(0, 500) || "Cancelled by the developer.";
  const root = requireSql();
  return root.begin(async (transaction) => {
    const run = await getAuthorizedRun(transaction, input.actor, input.runId);
    if (!CANCELLABLE_STATES.has(run.state)) {
      throw new ForgeRunControlError(
        "RUN_NOT_CONTROLLABLE",
        `The run cannot be cancelled while it is ${run.state}.`,
        409,
      );
    }
    const operation = "cancel-run";
    const replay = await claimCommand(transaction, {
      workspaceId: run.workspace_id,
      operation,
      idempotencyKey: input.idempotencyKey,
      requestHash: commandHash({ reason }),
    });
    if (replay) return replay;

    const first = await transaction<{ version: number; event_sequence: string }[]>`
      UPDATE forge_runs
      SET state = 'cancelling',
          cancel_requested_at = now(),
          event_sequence = event_sequence + 1,
          version = version + 1,
          updated_at = now()
      WHERE id = ${input.runId}::uuid
        AND workspace_id = ${run.workspace_id}::uuid
      RETURNING version, event_sequence
    `;
    const cancelling = first[0];
    if (!cancelling) {
      throw new ForgeRunControlError("NOT_FOUND_OR_UNAUTHORIZED", "Run was not found.", 404);
    }
    const requestedRows = await transaction<EventRow[]>`
      INSERT INTO forge_run_events (
        run_id, workspace_id, sequence, type, actor_type,
        actor_id, payload, schema_version
      ) VALUES (
        ${input.runId}::uuid,
        ${run.workspace_id}::uuid,
        ${cancelling.event_sequence}::bigint,
        'run.cancel.requested',
        'user',
        ${input.actor.id},
        ${JSON.stringify({ reason })}::jsonb,
        1
      )
      RETURNING id, sequence, type, actor_type, actor_id, payload, created_at
    `;

    const second = await transaction<{
      state: ForgeRunState;
      version: number;
      event_sequence: string;
    }[]>`
      UPDATE forge_runs
      SET state = 'cancelled',
          finished_at = now(),
          event_sequence = event_sequence + 1,
          version = version + 1,
          updated_at = now()
      WHERE id = ${input.runId}::uuid
        AND workspace_id = ${run.workspace_id}::uuid
        AND state = 'cancelling'
      RETURNING state, version, event_sequence
    `;
    const cancelled = second[0];
    if (!cancelled) {
      throw new ForgeRunControlError(
        "OPTIMISTIC_CONCURRENCY_CONFLICT",
        "Run state changed before cancellation completed.",
        409,
      );
    }
    await transaction`
      UPDATE forge_tasks
      SET status = 'cancelled', version = version + 1, updated_at = now()
      WHERE id = ${run.task_id}::uuid
        AND workspace_id = ${run.workspace_id}::uuid
    `;
    const cancelledRows = await transaction<EventRow[]>`
      INSERT INTO forge_run_events (
        run_id, workspace_id, sequence, type, actor_type,
        actor_id, payload, schema_version
      ) VALUES (
        ${input.runId}::uuid,
        ${run.workspace_id}::uuid,
        ${cancelled.event_sequence}::bigint,
        'run.cancelled',
        'system',
        null,
        ${JSON.stringify({ reason, requestedBy: input.actor.id })}::jsonb,
        1
      )
      RETURNING id, sequence, type, actor_type, actor_id, payload, created_at
    `;
    const response: ForgeCommandResult = {
      runId: input.runId,
      state: cancelled.state,
      version: cancelled.version,
      events: [...requestedRows, ...cancelledRows].map(mapEvent),
    };
    await completeCommand(transaction, {
      workspaceId: run.workspace_id,
      operation,
      idempotencyKey: input.idempotencyKey,
      response,
    });
    return response;
  });
}

export function assertApprovalVersion(input: {
  status: string;
  actualVersion: number;
  expectedVersion: number;
}): void {
  if (input.status !== "pending" || input.actualVersion !== input.expectedVersion) {
    throw new ForgeRunControlError(
      "OPTIMISTIC_CONCURRENCY_CONFLICT",
      "Approval changed before this decision completed.",
      409,
    );
  }
}

export async function resolveForgeApproval(input: {
  actor: ForgeActor;
  runId: string;
  approvalId: string;
  expectedVersion: number;
  decision: "approved" | "rejected";
  reason: string;
}): Promise<ForgeCommandResult> {
  assertUuid(input.approvalId, "Approval ID");
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 0) {
    throw new ForgeRunControlError("INVALID_COMMAND", "Approval version is invalid.", 400);
  }
  const reason = input.reason.trim().slice(0, 500) || `${input.decision} by developer`;
  const root = requireSql();
  return root.begin(async (transaction) => {
    const run = await getAuthorizedRun(transaction, input.actor, input.runId);
    const approvals = await transaction<ApprovalRow[]>`
      SELECT id, request_key, action_type, summary, scope, risk_level,
             status, version, requested_at, resolved_at, reason
      FROM forge_approval_requests
      WHERE id = ${input.approvalId}::uuid
        AND run_id = ${input.runId}::uuid
        AND workspace_id = ${run.workspace_id}::uuid
      FOR UPDATE
    `;
    const approval = approvals[0];
    if (!approval) {
      throw new ForgeRunControlError(
        "NOT_FOUND_OR_UNAUTHORIZED",
        "Approval was not found.",
        404,
      );
    }
    assertApprovalVersion({
      status: approval.status,
      actualVersion: approval.version,
      expectedVersion: input.expectedVersion,
    });

    const resolvedRows = await transaction<ApprovalRow[]>`
      UPDATE forge_approval_requests
      SET status = ${input.decision},
          resolved_by = ${input.actor.id},
          resolved_at = now(),
          reason = ${reason},
          version = version + 1
      WHERE id = ${input.approvalId}::uuid
        AND workspace_id = ${run.workspace_id}::uuid
        AND status = 'pending'
        AND version = ${input.expectedVersion}
      RETURNING id, request_key, action_type, summary, scope, risk_level,
                status, version, requested_at, resolved_at, reason
    `;
    const resolved = resolvedRows[0];
    if (!resolved) {
      throw new ForgeRunControlError(
        "OPTIMISTIC_CONCURRENCY_CONFLICT",
        "Approval changed before this decision completed.",
        409,
      );
    }
    const runRows = await transaction<{
      state: ForgeRunState;
      version: number;
      event_sequence: string;
    }[]>`
      UPDATE forge_runs
      SET state = CASE WHEN state = 'awaiting_approval' THEN 'running' ELSE state END,
          event_sequence = event_sequence + 1,
          version = version + 1,
          updated_at = now()
      WHERE id = ${input.runId}::uuid
        AND workspace_id = ${run.workspace_id}::uuid
      RETURNING state, version, event_sequence
    `;
    const current = runRows[0];
    if (!current) {
      throw new ForgeRunControlError("NOT_FOUND_OR_UNAUTHORIZED", "Run was not found.", 404);
    }
    const eventRows = await transaction<EventRow[]>`
      INSERT INTO forge_run_events (
        run_id, workspace_id, sequence, type, actor_type,
        actor_id, payload, schema_version
      ) VALUES (
        ${input.runId}::uuid,
        ${run.workspace_id}::uuid,
        ${current.event_sequence}::bigint,
        'approval.resolved',
        'user',
        ${input.actor.id},
        ${JSON.stringify({
          approvalId: resolved.id,
          status: resolved.status,
          version: resolved.version,
          reason,
        })}::jsonb,
        1
      )
      RETURNING id, sequence, type, actor_type, actor_id, payload, created_at
    `;
    return {
      runId: input.runId,
      state: current.state,
      version: current.version,
      events: eventRows.map(mapEvent),
      approval: mapApproval(resolved),
    };
  });
}
