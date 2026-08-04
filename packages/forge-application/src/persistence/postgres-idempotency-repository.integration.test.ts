import { afterAll, beforeEach, expect, it } from "vitest";

import {
  createTestSql,
  describeDatabase,
  resetForgeTables,
  seedRun,
} from "../testing/postgres-fixture.js";
import {
  IdempotencyKeyConflictError,
  PostgresIdempotencyRepository,
} from "./postgres-idempotency-repository.js";

const sql = createTestSql();
const repository = new PostgresIdempotencyRepository(sql);

describeDatabase("PostgresIdempotencyRepository", () => {
  beforeEach(async () => resetForgeTables(sql));
  afterAll(async () => sql.end());

  it("claims once, reports pending, and replays completed response", async () => {
    const fixture = await seedRun(sql);
    const request = { taskId: fixture.taskId };
    expect(
      await repository.claim({
        workspaceId: fixture.workspaceId,
        operation: "start-run",
        idempotencyKey: "key-1",
        request,
        expiresAt: new Date(Date.now() + 60_000),
      }),
    ).toEqual({ status: "claimed" });
    expect(
      await repository.claim({
        workspaceId: fixture.workspaceId,
        operation: "start-run",
        idempotencyKey: "key-1",
        request,
        expiresAt: new Date(Date.now() + 60_000),
      }),
    ).toEqual({ status: "pending" });

    await repository.complete({
      workspaceId: fixture.workspaceId,
      operation: "start-run",
      idempotencyKey: "key-1",
      resourceType: "run",
      resourceId: fixture.runId,
      response: { runId: fixture.runId },
    });
    expect(
      await repository.claim({
        workspaceId: fixture.workspaceId,
        operation: "start-run",
        idempotencyKey: "key-1",
        request,
        expiresAt: new Date(Date.now() + 60_000),
      }),
    ).toEqual({
      status: "completed",
      response: { runId: fixture.runId },
      resourceId: fixture.runId,
    });
  });

  it("rejects the same key with different input", async () => {
    const fixture = await seedRun(sql);
    await repository.claim({
      workspaceId: fixture.workspaceId,
      operation: "start-run",
      idempotencyKey: "key-1",
      request: { taskId: fixture.taskId },
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(
      repository.claim({
        workspaceId: fixture.workspaceId,
        operation: "start-run",
        idempotencyKey: "key-1",
        request: { taskId: "different" },
        expiresAt: new Date(Date.now() + 60_000),
      }),
    ).rejects.toBeInstanceOf(IdempotencyKeyConflictError);
  });
});
