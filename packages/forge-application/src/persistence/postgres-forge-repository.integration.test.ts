import { afterAll, beforeEach, expect, it } from "vitest";

import {
  createTestSql,
  describeDatabase,
  resetForgeTables,
  seedRun,
} from "../testing/postgres-fixture.js";
import {
  OptimisticConcurrencyError,
  PostgresForgeRepository,
} from "./postgres-forge-repository.js";

const sql = createTestSql();
const repository = new PostgresForgeRepository(sql);

describeDatabase("PostgresForgeRepository", () => {
  beforeEach(async () => resetForgeTables(sql));
  afterAll(async () => sql.end());

  it("commits run transitions and ordered events atomically", async () => {
    const fixture = await seedRun(sql);
    const first = await repository.transitionRunAndAppendEvent({
      workspaceId: fixture.workspaceId,
      runId: fixture.runId,
      expectedVersion: 0,
      nextState: "provisioning",
      eventType: "sandbox.provisioning_started",
      payload: {},
    });
    const second = await repository.transitionRunAndAppendEvent({
      workspaceId: fixture.workspaceId,
      runId: fixture.runId,
      expectedVersion: 1,
      nextState: "running",
      eventType: "sandbox.ready",
      payload: { sandboxId: "sandbox-1" },
      actorType: "provider",
    });

    expect(first.run).toMatchObject({ version: 1, eventSequence: 1 });
    expect(second.run).toMatchObject({ version: 2, eventSequence: 2 });
    const projection = await repository.getRunProjection({
      workspaceId: fixture.workspaceId,
      runId: fixture.runId,
      afterSequence: 0,
    });
    expect(projection.events.map((event) => event.sequence)).toEqual([1, 2]);
    expect(projection.snapshot.state).toBe("running");
  });

  it("rejects stale optimistic versions", async () => {
    const fixture = await seedRun(sql);
    await repository.transitionRunAndAppendEvent({
      workspaceId: fixture.workspaceId,
      runId: fixture.runId,
      expectedVersion: 0,
      nextState: "provisioning",
      eventType: "run.provisioning",
      payload: {},
    });
    await expect(
      repository.transitionRunAndAppendEvent({
        workspaceId: fixture.workspaceId,
        runId: fixture.runId,
        expectedVersion: 0,
        nextState: "running",
        eventType: "run.running",
        payload: {},
      }),
    ).rejects.toBeInstanceOf(OptimisticConcurrencyError);
  });

  it("rolls back the run update when event persistence fails", async () => {
    const fixture = await seedRun(sql);
    await expect(
      repository.transitionRunAndAppendEvent({
        workspaceId: fixture.workspaceId,
        runId: fixture.runId,
        expectedVersion: 0,
        nextState: "provisioning",
        eventType: "x".repeat(129),
        payload: {},
      }),
    ).rejects.toBeDefined();

    const snapshot = await repository.getRunSnapshot({
      workspaceId: fixture.workspaceId,
      runId: fixture.runId,
    });
    expect(snapshot).toMatchObject({ state: "queued", version: 0, eventSequence: 0 });
  });

  it("uses a stable event cursor", async () => {
    const fixture = await seedRun(sql);
    await repository.transitionRunAndAppendEvent({
      workspaceId: fixture.workspaceId,
      runId: fixture.runId,
      expectedVersion: 0,
      nextState: "provisioning",
      eventType: "event.1",
      payload: {},
    });
    await repository.transitionRunAndAppendEvent({
      workspaceId: fixture.workspaceId,
      runId: fixture.runId,
      expectedVersion: 1,
      nextState: "running",
      eventType: "event.2",
      payload: {},
    });
    const events = await repository.getEventsAfter({
      workspaceId: fixture.workspaceId,
      runId: fixture.runId,
      afterSequence: 1,
    });
    expect(events.map((event) => event.type)).toEqual(["event.2"]);
  });
});
