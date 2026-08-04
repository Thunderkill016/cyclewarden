import { afterAll, beforeEach, expect, it } from "vitest";

import {
  createTestSql,
  describeDatabase,
  resetForgeTables,
  seedRun,
} from "../testing/postgres-fixture.js";
import {
  NotFoundOrUnauthorizedError,
  PostgresForgeRepository,
} from "./postgres-forge-repository.js";

const sql = createTestSql();
const repository = new PostgresForgeRepository(sql);

describeDatabase("cross-workspace persistence authorization", () => {
  beforeEach(async () => resetForgeTables(sql));
  afterAll(async () => sql.end());

  it("does not reveal or mutate a run across workspace boundaries", async () => {
    const fixture = await seedRun(sql);
    await expect(
      repository.getRunSnapshot({
        workspaceId: fixture.otherWorkspaceId,
        runId: fixture.runId,
      }),
    ).rejects.toBeInstanceOf(NotFoundOrUnauthorizedError);

    await expect(
      repository.transitionRunAndAppendEvent({
        workspaceId: fixture.otherWorkspaceId,
        runId: fixture.runId,
        expectedVersion: 0,
        nextState: "running",
        eventType: "run.running",
        payload: {},
      }),
    ).rejects.toBeInstanceOf(NotFoundOrUnauthorizedError);

    const ownerSnapshot = await repository.getRunSnapshot({
      workspaceId: fixture.workspaceId,
      runId: fixture.runId,
    });
    expect(ownerSnapshot).toMatchObject({ state: "queued", version: 0 });
  });

  it("does not reveal approval existence to another workspace", async () => {
    const fixture = await seedRun(sql);
    await expect(
      repository.resolveApproval({
        workspaceId: fixture.otherWorkspaceId,
        approvalId: fixture.approvalId,
        expectedVersion: 0,
        decision: "approved",
        resolvedBy: "intruder",
        reason: "cross workspace",
      }),
    ).rejects.toBeInstanceOf(NotFoundOrUnauthorizedError);
  });
});
