import type { Sql } from "postgres";

import type { RunState } from "@cyclewarden/forge-domain";

export class NotFoundOrUnauthorizedError extends Error {
  readonly code = "NOT_FOUND_OR_UNAUTHORIZED" as const;

  constructor(resource: string) {
    super(`${resource} was not found`);
    this.name = "NotFoundOrUnauthorizedError";
  }
}

export class OptimisticConcurrencyError extends Error {
  readonly code = "OPTIMISTIC_CONCURRENCY_CONFLICT" as const;

  constructor(resource: string) {
    super(`${resource} changed before this operation completed`);
    this.name = "OptimisticConcurrencyError";
  }
}

export interface PersistedRunSnapshot {
  id: string;
  taskId: string;
  workspaceId: string;
  iteration: number;
  state: RunState;
  reviewOutcome: "approved" | "rejected" | "cancelled" | null;
  eventSequence: number;
  version: number;
  lastHeartbeatAt: Date | null;
  failureCode: string | null;
  failureSummary: string | null;
  updatedAt: Date;
}

export interface PersistedRunEvent {
  id: string;
  runId: string;
  workspaceId: string;
  sequence: number;
  type: string;
  actorType: "user" | "system" | "agent" | "provider";
  actorId: string | null;
  correlationId: string | null;
  payload: unknown;
  schemaVersion: number;
  createdAt: Date;
}

interface RunRow {
  id: string;
  task_id: string;
  workspace_id: string;
  iteration: number;
  state: RunState;
  review_outcome: PersistedRunSnapshot["reviewOutcome"];
  event_sequence: string;
  version: number;
  last_heartbeat_at: Date | null;
  failure_code: string | null;
  failure_summary: string | null;
  updated_at: Date;
}

interface EventRow {
  id: string;
  run_id: string;
  workspace_id: string;
  sequence: string;
  type: string;
  actor_type: PersistedRunEvent["actorType"];
  actor_id: string | null;
  correlation_id: string | null;
  payload: unknown;
  schema_version: number;
  created_at: Date;
}

function mapRun(row: RunRow): PersistedRunSnapshot {
  return {
    id: row.id,
    taskId: row.task_id,
    workspaceId: row.workspace_id,
    iteration: row.iteration,
    state: row.state,
    reviewOutcome: row.review_outcome,
    eventSequence: Number(row.event_sequence),
    version: row.version,
    lastHeartbeatAt: row.last_heartbeat_at,
    failureCode: row.failure_code,
    failureSummary: row.failure_summary,
    updatedAt: row.updated_at,
  };
}

function mapEvent(row: EventRow): PersistedRunEvent {
  return {
    id: row.id,
    runId: row.run_id,
    workspaceId: row.workspace_id,
    sequence: Number(row.sequence),
    type: row.type,
    actorType: row.actor_type,
    actorId: row.actor_id,
    correlationId: row.correlation_id,
    payload: row.payload,
    schemaVersion: row.schema_version,
    createdAt: row.created_at,
  };
}

export class PostgresForgeRepository {
  constructor(private readonly sql: Sql) {}

  async getRunSnapshot(input: {
    workspaceId: string;
    runId: string;
  }): Promise<PersistedRunSnapshot> {
    const rows = await this.sql<RunRow[]>`
      SELECT id, task_id, workspace_id, iteration, state, review_outcome,
             event_sequence, version, last_heartbeat_at, failure_code,
             failure_summary, updated_at
      FROM forge_runs
      WHERE id = ${input.runId}::uuid
        AND workspace_id = ${input.workspaceId}::uuid
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new NotFoundOrUnauthorizedError("Run");
    return mapRun(row);
  }

  async transitionRunAndAppendEvent(input: {
    workspaceId: string;
    runId: string;
    expectedVersion: number;
    nextState: RunState;
    eventType: string;
    payload: unknown;
    actorType?: PersistedRunEvent["actorType"];
    actorId?: string | null;
    correlationId?: string | null;
  }): Promise<{ run: PersistedRunSnapshot; event: PersistedRunEvent }> {
    return this.sql.begin(async (transaction) => {
      const updated = await transaction<RunRow[]>`
        UPDATE forge_runs
        SET state = ${input.nextState},
            version = version + 1,
            event_sequence = event_sequence + 1,
            updated_at = now()
        WHERE id = ${input.runId}::uuid
          AND workspace_id = ${input.workspaceId}::uuid
          AND version = ${input.expectedVersion}
        RETURNING id, task_id, workspace_id, iteration, state, review_outcome,
                  event_sequence, version, last_heartbeat_at, failure_code,
                  failure_summary, updated_at
      `;
      const runRow = updated[0];
      if (!runRow) {
        const exists = await transaction<{ exists: boolean }[]>`
          SELECT EXISTS(
            SELECT 1 FROM forge_runs
            WHERE id = ${input.runId}::uuid
              AND workspace_id = ${input.workspaceId}::uuid
          ) AS exists
        `;
        if (!exists[0]?.exists) throw new NotFoundOrUnauthorizedError("Run");
        throw new OptimisticConcurrencyError("Run");
      }

      const inserted = await transaction<EventRow[]>`
        INSERT INTO forge_run_events (
          run_id, workspace_id, sequence, type, actor_type,
          actor_id, correlation_id, payload, schema_version
        ) VALUES (
          ${input.runId}::uuid,
          ${input.workspaceId}::uuid,
          ${runRow.event_sequence}::bigint,
          ${input.eventType},
          ${input.actorType ?? "system"},
          ${input.actorId ?? null},
          ${input.correlationId ?? null},
          ${transaction.json(input.payload as never)},
          1
        )
        RETURNING id, run_id, workspace_id, sequence, type, actor_type,
                  actor_id, correlation_id, payload, schema_version, created_at
      `;
      const eventRow = inserted[0];
      if (!eventRow) throw new Error("Event insert returned no row");
      return { run: mapRun(runRow), event: mapEvent(eventRow) };
    });
  }

  async resolveApproval(input: {
    workspaceId: string;
    approvalId: string;
    expectedVersion: number;
    decision: "approved" | "rejected";
    resolvedBy: string;
    reason: string;
  }): Promise<{ id: string; status: string; version: number }> {
    const rows = await this.sql<{ id: string; status: string; version: number }[]>`
      UPDATE forge_approval_requests
      SET status = ${input.decision},
          resolved_by = ${input.resolvedBy},
          resolved_at = now(),
          reason = ${input.reason},
          version = version + 1
      WHERE id = ${input.approvalId}::uuid
        AND workspace_id = ${input.workspaceId}::uuid
        AND status = 'pending'
        AND version = ${input.expectedVersion}
      RETURNING id, status, version
    `;
    const row = rows[0];
    if (row) return row;

    const existing = await this.sql<{ version: number }[]>`
      SELECT version FROM forge_approval_requests
      WHERE id = ${input.approvalId}::uuid
        AND workspace_id = ${input.workspaceId}::uuid
      LIMIT 1
    `;
    if (!existing[0]) throw new NotFoundOrUnauthorizedError("Approval");
    throw new OptimisticConcurrencyError("Approval");
  }

  async getEventsAfter(input: {
    workspaceId: string;
    runId: string;
    afterSequence: number;
    limit?: number;
  }): Promise<PersistedRunEvent[]> {
    const limit = input.limit ?? 100;
    if (!Number.isInteger(input.afterSequence) || input.afterSequence < 0) {
      throw new RangeError("afterSequence must be a non-negative integer");
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      throw new RangeError("limit must be between 1 and 500");
    }

    const exists = await this.sql<{ exists: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM forge_runs
        WHERE id = ${input.runId}::uuid
          AND workspace_id = ${input.workspaceId}::uuid
      ) AS exists
    `;
    if (!exists[0]?.exists) throw new NotFoundOrUnauthorizedError("Run");

    const rows = await this.sql<EventRow[]>`
      SELECT id, run_id, workspace_id, sequence, type, actor_type,
             actor_id, correlation_id, payload, schema_version, created_at
      FROM forge_run_events
      WHERE run_id = ${input.runId}::uuid
        AND workspace_id = ${input.workspaceId}::uuid
        AND sequence > ${input.afterSequence}
      ORDER BY sequence ASC
      LIMIT ${limit}
    `;
    return rows.map(mapEvent);
  }

  async getRunProjection(input: {
    workspaceId: string;
    runId: string;
    afterSequence: number;
    limit?: number;
  }): Promise<{ snapshot: PersistedRunSnapshot; events: PersistedRunEvent[] }> {
    const [snapshot, events] = await Promise.all([
      this.getRunSnapshot(input),
      this.getEventsAfter(input),
    ]);
    return { snapshot, events };
  }
}
