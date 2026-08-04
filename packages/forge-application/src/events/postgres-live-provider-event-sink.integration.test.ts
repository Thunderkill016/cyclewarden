import { afterAll, beforeEach, expect, it } from "vitest";

import {
  createTestSql,
  describeDatabase,
  resetForgeTables,
  seedRun,
} from "../testing/postgres-fixture.js";
import { normalizeLiveProviderEvent } from "./live-provider-event-normalizer.js";
import {
  PostgresLiveProviderEventSink,
  ProviderEventCorrelationConflictError,
} from "./postgres-live-provider-event-sink.js";
import { PostgresForgeRepository } from "../persistence/postgres-forge-repository.js";

const sql = createTestSql();
const sink = new PostgresLiveProviderEventSink(sql);
const repository = new PostgresForgeRepository(sql);

describeDatabase("PostgresLiveProviderEventSink", () => {
  beforeEach(async () => resetForgeTables(sql));
  afterAll(async () => sql.end());

  it("assigns application sequence while preserving provider cursor metadata", async () => {
    const fixture = await seedRun(sql);
    const normalized = normalizeLiveProviderEvent({
      source: "agent",
      providerKey: "codex",
      externalRunId: "thread-1",
      cursor: "cursor-7",
      event: { type: "message", text: "Editing files" },
    });

    const persisted = await sink.append({
      workspaceId: fixture.workspaceId,
      runId: fixture.runId,
      event: normalized,
    });

    expect(persisted).toMatchObject({
      runId: fixture.runId,
      workspaceId: fixture.workspaceId,
      sequence: 1,
      type: "agent.message",
      actorType: "agent",
      actorId: "codex",
      correlationId: normalized.correlationId,
      schemaVersion: 1,
      payload: {
        provider: {
          source: "agent",
          key: "codex",
          externalRunId: "thread-1",
          cursor: "cursor-7",
          payloadVersion: 1,
        },
        redactionCount: 0,
        data: { text: "Editing files" },
      },
    });

    const projection = await repository.getRunProjection({
      workspaceId: fixture.workspaceId,
      runId: fixture.runId,
      afterSequence: 0,
    });
    expect(projection.snapshot.eventSequence).toBe(1);
    expect(projection.snapshot.version).toBe(0);
    expect(projection.events).toHaveLength(1);
  });

  it("returns the existing event for an exact provider replay without consuming sequence", async () => {
    const fixture = await seedRun(sql);
    const normalized = normalizeLiveProviderEvent({
      source: "sandbox",
      providerKey: "vercel-sandbox",
      externalRunId: "sandbox-1",
      cursor: "created-1",
      event: {
        kind: "created",
        expiresAt: "2026-08-05T01:00:00.000Z",
      },
    });

    const first = await sink.append({
      workspaceId: fixture.workspaceId,
      runId: fixture.runId,
      event: normalized,
    });
    const replay = await sink.append({
      workspaceId: fixture.workspaceId,
      runId: fixture.runId,
      event: normalized,
    });

    expect(replay.id).toBe(first.id);
    expect(replay.sequence).toBe(1);
    const projection = await repository.getRunProjection({
      workspaceId: fixture.workspaceId,
      runId: fixture.runId,
      afterSequence: 0,
    });
    expect(projection.snapshot.eventSequence).toBe(1);
    expect(projection.events).toHaveLength(1);
  });

  it("fails closed when the same provider correlation reappears with different data", async () => {
    const fixture = await seedRun(sql);
    const first = normalizeLiveProviderEvent({
      source: "source",
      providerKey: "github",
      externalRunId: "installation-42",
      cursor: "delivery-1",
      event: {
        kind: "installation.reconciled",
        installationId: "42",
        status: "active",
        repositoryCount: 2,
      },
    });
    const conflicting = normalizeLiveProviderEvent({
      source: "source",
      providerKey: "github",
      externalRunId: "installation-42",
      cursor: "delivery-1",
      event: {
        kind: "installation.reconciled",
        installationId: "42",
        status: "active",
        repositoryCount: 3,
      },
    });

    expect(conflicting.correlationId).toBe(first.correlationId);
    await sink.append({
      workspaceId: fixture.workspaceId,
      runId: fixture.runId,
      event: first,
    });
    await expect(
      sink.append({
        workspaceId: fixture.workspaceId,
        runId: fixture.runId,
        event: conflicting,
      }),
    ).rejects.toBeInstanceOf(ProviderEventCorrelationConflictError);

    const projection = await repository.getRunProjection({
      workspaceId: fixture.workspaceId,
      runId: fixture.runId,
      afterSequence: 0,
    });
    expect(projection.snapshot.eventSequence).toBe(1);
    expect(projection.events).toHaveLength(1);
  });

  it("orders distinct provider cursors in the application event stream", async () => {
    const fixture = await seedRun(sql);
    const first = normalizeLiveProviderEvent({
      source: "agent",
      providerKey: "codex",
      externalRunId: "thread-1",
      cursor: "1",
      event: { type: "message", text: "Starting" },
    });
    const second = normalizeLiveProviderEvent({
      source: "agent",
      providerKey: "codex",
      externalRunId: "thread-1",
      cursor: "2",
      event: { type: "completed", summary: "Done" },
    });

    await sink.append({
      workspaceId: fixture.workspaceId,
      runId: fixture.runId,
      event: first,
    });
    await sink.append({
      workspaceId: fixture.workspaceId,
      runId: fixture.runId,
      event: second,
    });

    const events = await repository.getEventsAfter({
      workspaceId: fixture.workspaceId,
      runId: fixture.runId,
      afterSequence: 0,
    });
    expect(events.map((event) => [event.sequence, event.type])).toEqual([
      [1, "agent.message"],
      [2, "agent.completed"],
    ]);
  });
});
