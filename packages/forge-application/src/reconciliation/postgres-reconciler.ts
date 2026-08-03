import type { Sql } from "postgres";

const ACTIVE_STATES = [
  "queued",
  "provisioning",
  "running",
  "awaiting_approval",
  "cancelling",
  "validating",
  "awaiting_review",
  "publishing",
] as const;

export class PostgresForgeReconciler {
  constructor(private readonly sql: Sql) {}

  async failStaleRuns(input: {
    staleBefore: Date;
    workspaceId?: string;
  }): Promise<string[]> {
    return this.sql.begin(async (transaction) => {
      const rows = await transaction<{
        id: string;
        workspace_id: string;
        event_sequence: string;
      }[]>`
        UPDATE forge_runs
        SET state = 'failed',
            failure_code = 'STALE_HEARTBEAT',
            failure_summary = 'Run heartbeat expired before reconciliation',
            finished_at = now(),
            version = version + 1,
            event_sequence = event_sequence + 1,
            updated_at = now()
        WHERE state IN ${transaction(ACTIVE_STATES)}
          AND last_heartbeat_at IS NOT NULL
          AND last_heartbeat_at < ${input.staleBefore}
          ${input.workspaceId ? transaction`AND workspace_id = ${input.workspaceId}::uuid` : transaction``}
        RETURNING id, workspace_id, event_sequence
      `;

      for (const row of rows) {
        await transaction`
          INSERT INTO forge_run_events (
            run_id, workspace_id, sequence, type, actor_type, payload, schema_version
          ) VALUES (
            ${row.id}::uuid,
            ${row.workspace_id}::uuid,
            ${row.event_sequence}::bigint,
            'run.failed',
            'system',
            ${transaction.json({ failureCode: "STALE_HEARTBEAT" })},
            1
          )
        `;
      }
      return rows.map((row) => row.id);
    });
  }

  async expireApprovals(input: {
    now: Date;
    workspaceId?: string;
  }): Promise<string[]> {
    const rows = await this.sql<{ id: string }[]>`
      UPDATE forge_approval_requests
      SET status = 'expired',
          resolved_at = ${input.now},
          reason = 'Approval expired before resolution',
          version = version + 1
      WHERE status = 'pending'
        AND expires_at IS NOT NULL
        AND expires_at <= ${input.now}
        ${input.workspaceId ? this.sql`AND workspace_id = ${input.workspaceId}::uuid` : this.sql``}
      RETURNING id
    `;
    return rows.map((row) => row.id);
  }

  async listPartialPublications(input: {
    workspaceId: string;
    olderThan: Date;
  }): Promise<Array<{ id: string; runId: string; status: string }>> {
    const rows = await this.sql<{
      id: string;
      run_id: string;
      status: string;
    }[]>`
      SELECT id, run_id, status
      FROM forge_publications
      WHERE workspace_id = ${input.workspaceId}::uuid
        AND status IN ('pending', 'pushed', 'failed')
        AND updated_at < ${input.olderThan}
      ORDER BY updated_at ASC
    `;
    return rows.map((row) => ({
      id: row.id,
      runId: row.run_id,
      status: row.status,
    }));
  }
}
