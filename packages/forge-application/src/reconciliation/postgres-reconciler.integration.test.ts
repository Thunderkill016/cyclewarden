import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, expect, it } from "vitest";

import {
  createTestSql,
  describeDatabase,
  resetForgeTables,
  seedRun,
} from "../testing/postgres-fixture.js";
import { PostgresForgeRepository } from "../persistence/postgres-forge-repository.js";
import { PostgresForgeReconciler } from "./postgres-reconciler.js";

const sql = createTestSql();
const reconciler = new PostgresForgeReconciler(sql);
const repository = new PostgresForgeRepository(sql);

describeDatabase("PostgresForgeReconciler", () => {
  beforeEach(async () => resetForgeTables(sql));
  afterAll(async () => sql.end());

  it("fails stale runs and appends durable failure events", async () => {
    const fixture = await seedRun(sql, {
      state: "running",
      lastHeartbeatAt: new Date(Date.now() - 120_000),
    });
    const reconciled = await reconciler.failStaleRuns({
      workspaceId: fixture.workspaceId,
      staleBefore: new Date(Date.now() - 60_000),
    });
    expect(reconciled).toEqual([fixture.runId]);
    const projection = await repository.getRunProjection({
      workspaceId: fixture.workspaceId,
      runId: fixture.runId,
      afterSequence: 0,
    });
    expect(projection.snapshot).toMatchObject({
      state: "failed",
      failureCode: "STALE_HEARTBEAT",
      version: 1,
      eventSequence: 1,
    });
    expect(projection.events[0]?.type).toBe("run.failed");
  });

  it("expires pending approvals and finds partial publications", async () => {
    const fixture = await seedRun(sql);
    await sql`
      UPDATE forge_approval_requests
      SET expires_at = now() - interval '1 minute'
      WHERE id = ${fixture.approvalId}::uuid
    `;
    expect(
      await reconciler.expireApprovals({
        workspaceId: fixture.workspaceId,
        now: new Date(),
      }),
    ).toEqual([fixture.approvalId]);

    const publicationId = randomUUID();
    await sql`
      INSERT INTO forge_publications (
        id, run_id, workspace_id, provider, external_repository_id,
        branch_name, commit_sha, status, updated_at
      ) VALUES (
        ${publicationId}::uuid, ${fixture.runId}::uuid, ${fixture.workspaceId}::uuid,
        'fake-source', 'repo-1', 'atoryn/test', 'abc123', 'pushed',
        now() - interval '5 minutes'
      )
    `;
    expect(
      await reconciler.listPartialPublications({
        workspaceId: fixture.workspaceId,
        olderThan: new Date(Date.now() - 60_000),
      }),
    ).toEqual([{ id: publicationId, runId: fixture.runId, status: "pushed" }]);
  });
});
