import { createHash } from "node:crypto";

import type { Sql } from "postgres";

export class IdempotencyKeyConflictError extends Error {
  readonly code = "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_INPUT" as const;

  constructor() {
    super("Idempotency key was reused with a different request");
    this.name = "IdempotencyKeyConflictError";
  }
}

export type IdempotencyClaim =
  | { status: "claimed" }
  | { status: "pending" }
  | { status: "completed"; response: unknown; resourceId: string | null };

interface IdempotencyRow {
  request_hash: string;
  status: "pending" | "completed";
  response: unknown | null;
  resource_id: string | null;
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

export function hashIdempotencyRequest(value: unknown): string {
  return createHash("sha256").update(stableSerialize(value)).digest("hex");
}

export class PostgresIdempotencyRepository {
  constructor(private readonly sql: Sql) {}

  async claim(input: {
    workspaceId: string;
    operation: string;
    idempotencyKey: string;
    request: unknown;
    expiresAt: Date;
  }): Promise<IdempotencyClaim> {
    const requestHash = hashIdempotencyRequest(input.request);
    const inserted = await this.sql<{ request_hash: string }[]>`
      INSERT INTO forge_idempotency_records (
        workspace_id, operation, idempotency_key, request_hash,
        status, expires_at
      ) VALUES (
        ${input.workspaceId}::uuid,
        ${input.operation},
        ${input.idempotencyKey},
        ${requestHash},
        'pending',
        ${input.expiresAt}
      )
      ON CONFLICT (workspace_id, operation, idempotency_key) DO NOTHING
      RETURNING request_hash
    `;
    if (inserted[0]) return { status: "claimed" };

    const rows = await this.sql<IdempotencyRow[]>`
      SELECT request_hash, status, response, resource_id
      FROM forge_idempotency_records
      WHERE workspace_id = ${input.workspaceId}::uuid
        AND operation = ${input.operation}
        AND idempotency_key = ${input.idempotencyKey}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new Error("Idempotency record disappeared after conflict");
    if (row.request_hash !== requestHash) throw new IdempotencyKeyConflictError();
    if (row.status === "completed") {
      return {
        status: "completed",
        response: row.response,
        resourceId: row.resource_id,
      };
    }
    return { status: "pending" };
  }

  async complete(input: {
    workspaceId: string;
    operation: string;
    idempotencyKey: string;
    resourceType: string;
    resourceId: string | null;
    response: unknown;
  }): Promise<void> {
    const rows = await this.sql<{ updated: number }[]>`
      WITH updated AS (
        UPDATE forge_idempotency_records
        SET status = 'completed',
            resource_type = ${input.resourceType},
            resource_id = ${input.resourceId}::uuid,
            response = ${this.sql.json(input.response as never)},
            updated_at = now()
        WHERE workspace_id = ${input.workspaceId}::uuid
          AND operation = ${input.operation}
          AND idempotency_key = ${input.idempotencyKey}
          AND status = 'pending'
        RETURNING 1
      )
      SELECT count(*)::int AS updated FROM updated
    `;
    if (rows[0]?.updated !== 1) {
      throw new Error("Pending idempotency record not found");
    }
  }
}
