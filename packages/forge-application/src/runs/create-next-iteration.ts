import { randomUUID } from "node:crypto";

import { createNextIteration, runSchema, type Run } from "@cyclewarden/forge-domain";

import type { WorkspaceAuthorizer } from "../auth/workspace-authorizer.js";
import type { InMemoryForgeStore } from "../store/in-memory-store.js";

export async function createNextRunIteration(input: {
  store: InMemoryForgeStore;
  authorizer: WorkspaceAuthorizer;
  workspaceId: string;
  userId: string;
  previousRunId: string;
  instruction: string;
  idempotencyKey: string;
}): Promise<Run> {
  await input.authorizer.assertCanAccess({
    workspaceId: input.workspaceId,
    userId: input.userId,
  });
  return input.store.executeIdempotent({
    workspaceId: input.workspaceId,
    operation: "create-iteration",
    idempotencyKey: input.idempotencyKey,
    request: {
      previousRunId: input.previousRunId,
      instruction: input.instruction,
    },
    execute: () => {
      const previous = input.store.getRun(input.previousRunId);
      if (previous.workspaceId !== input.workspaceId) throw new Error("UNAUTHORIZED");
      const lifecycle = createNextIteration({
        previousRun: previous,
        nextRunId: randomUUID(),
        activeRunCount: input.store.listActiveRuns(input.workspaceId).length,
      });
      const now = new Date().toISOString();
      const next = runSchema.parse({
        ...previous,
        ...lifecycle,
        baseCommitSha: previous.baseCommitSha,
        workingBranch: null,
        startedAt: null,
        finishedAt: null,
        failureCode: null,
        failureSummary: null,
        createdAt: now,
        updatedAt: now,
      });
      input.store.saveRun(next);
      input.store.appendEvent({
        runId: next.id,
        type: "run.iteration_created",
        actorType: "user",
        actorId: input.userId,
        payload: {
          previousRunId: previous.id,
          iteration: next.iteration,
          instruction: input.instruction,
        },
      });
      return next;
    },
  });
}
