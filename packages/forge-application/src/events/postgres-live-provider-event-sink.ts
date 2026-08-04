import { createHash } from "node:crypto";

import type { Sql } from "postgres";

import type { NormalizedLiveProviderRunEvent } from "./live-provider-event-normalizer.js";
import {
  NotFoundOrUnauthorizedError,
  type PersistedRunEvent,
} from "../persistence/postgres-forge-repository.js";

interface RunSequenceRow {
  event_sequence: string;
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

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function eventDigest(input: {
  type: string;
  actorType: PersistedRunEvent["actorType"];
  actorId: string | null;
  correlationId: string | null;
  payload: unknown;
  schemaVersion: number;
}): string {
  return createHash("sha256")
    .update(stableSerialize(input))
    .digest("hex");
}

export class ProviderEventCorrelationConflictError extends Error {
  readonly code = "PROVIDER_EVENT_CORRELATION_CONFLICT" as const;

  constructor(correlationId: string) {
    super(
      `Provider correlation ${correlationId} was replayed with different event data`,
    );
    this.name = "ProviderEventCorrelationConflictError";
  }
}

export class PostgresLiveProviderEventSink {
  constructor(private readonly sql: Sql) {}

  async append(input: {
    workspaceId: string;
    runId: string;
    event: NormalizedLiveProviderRunEvent;
  }): Promise<PersistedRunEvent> {
    return this.sql.begin(async (transaction) => {
      const runs = await transaction<RunSequenceRow[]>`
        SELECT event_sequence
        FROM forge_runs
        WHERE id = ${input.runId}::uuid
          AND workspace_id = ${input.workspaceId}::uuid
        FOR UPDATE
      `;
      const run = runs[0];
      if (!run) throw new NotFoundOrUnauthorizedError("Run");

      const existingRows = await transaction<EventRow[]>`
        SELECT id, run_id, workspace_id, sequence, type, actor_type,
               actor_id, correlation_id, payload, schema_version, created_at
        FROM forge_run_events
        WHERE run_id = ${input.runId}::uuid
          AND workspace_id = ${input.workspaceId}::uuid
          AND correlation_id = ${input.event.correlationId}
        LIMIT 1
      `;
      const existingRow = existingRows[0];
      if (existingRow) {
        const existing = mapEvent(existingRow);
        const existingDigest = eventDigest({
          type: existing.type,
          actorType: existing.actorType,
          actorId: existing.actorId,
          correlationId: existing.correlationId,
          payload: existing.payload,
          schemaVersion: existing.schemaVersion,
        });
        const requestedDigest = eventDigest({
          type: input.event.type,
          actorType: input.event.actorType,
          actorId: input.event.actorId,
          correlationId: input.event.correlationId,
          payload: input.event.payload,
          schemaVersion: input.event.schemaVersion,
        });
        if (existingDigest !== requestedDigest) {
          throw new ProviderEventCorrelationConflictError(
            input.event.correlationId,
          );
        }
        return existing;
      }

      const currentSequence = Number(run.event_sequence);
      if (!Number.isSafeInteger(currentSequence) || currentSequence < 0) {
        throw new RangeError("Run event sequence is invalid");
      }
      const nextSequence = currentSequence + 1;

      await transaction`
        UPDATE forge_runs
        SET event_sequence = ${nextSequence}::bigint,
            updated_at = now()
        WHERE id = ${input.runId}::uuid
          AND workspace_id = ${input.workspaceId}::uuid
      `;

      const inserted = await transaction<EventRow[]>`
        INSERT INTO forge_run_events (
          run_id, workspace_id, sequence, type, actor_type,
          actor_id, correlation_id, payload, schema_version
        ) VALUES (
          ${input.runId}::uuid,
          ${input.workspaceId}::uuid,
          ${nextSequence}::bigint,
          ${input.event.type},
          ${input.event.actorType},
          ${input.event.actorId},
          ${input.event.correlationId},
          ${transaction.json(input.event.payload as never)},
          ${input.event.schemaVersion}
        )
        RETURNING id, run_id, workspace_id, sequence, type, actor_type,
                  actor_id, correlation_id, payload, schema_version, created_at
      `;
      const row = inserted[0];
      if (!row) throw new Error("Provider event insert returned no row");
      return mapEvent(row);
    });
  }
}
