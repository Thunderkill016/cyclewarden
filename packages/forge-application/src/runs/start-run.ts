import { randomUUID } from "node:crypto";

import {
  evaluateRunAdmission,
  runSchema,
  type Run,
} from "@cyclewarden/forge-domain";

import type { WorkspaceAuthorizer } from "../auth/workspace-authorizer.js";
import type { InMemoryForgeStore } from "../store/in-memory-store.js";

export class ActiveRunExistsError extends Error {
  readonly code = "ACTIVE_RUN_EXISTS" as const;

  constructor(readonly activeRunIds: string[]) {
    super("Workspace already has an active run");
    this.name = "ActiveRunExistsError";
  }
}

export async function startRun(input: {
  store: InMemoryForgeStore;
  authorizer: WorkspaceAuthorizer;
  workspaceId: string;
  userId: string;
  taskId: string;
  idempotencyKey: string;
  baseBranch: string;
  agentProvider: string;
  sandboxProvider: string;
  budgetPolicy: Record<string, unknown>;
  permissionPolicy: Record<string, unknown>;
}): Promise<Run> {
  await input.authorizer.assertCanAccess({
    workspaceId: input.workspaceId,
    userId: input.userId,
  });

  return input.store.executeIdempotent({
    workspaceId: input.workspaceId,
    operation: "start-run",
    idempotencyKey: input.idempotencyKey,
    request: {
      taskId: input.taskId,
      baseBranch: input.baseBranch,
      agentProvider: input.agentProvider,
      sandboxProvider: input.sandboxProvider,
      budgetPolicy: input.budgetPolicy,
      permissionPolicy: input.permissionPolicy,
    },
    execute: () => {
      const task = input.store.getTask(input.taskId);
      if (input.store.getTaskWorkspace(task.id) !== input.workspaceId) {
        const error = new Error("UNAUTHORIZED");
        error.name = "UNAUTHORIZED";
        throw error;
      }

      const activeRuns = input.store.listActiveRuns(input.workspaceId);
      const admission = evaluateRunAdmission({ activeRunCount: activeRuns.length });
      if (!admission.ok) {
        throw new ActiveRunExistsError(activeRuns.map((run) => run.id));
      }

      const now = new Date().toISOString();
      const run = runSchema.parse({
        id: randomUUID(),
        taskId: task.id,
        workspaceId: input.workspaceId,
        iteration: input.store.listRunsForTask(task.id).length + 1,
        state: "queued",
        reviewOutcome: null,
        baseBranch: input.baseBranch,
        baseCommitSha: null,
        workingBranch: null,
        agentProvider: input.agentProvider,
        sandboxProvider: input.sandboxProvider,
        budgetPolicy: input.budgetPolicy,
        permissionPolicy: input.permissionPolicy,
        startedAt: null,
        finishedAt: null,
        version: 0,
        failureCode: null,
        failureSummary: null,
        createdAt: now,
        updatedAt: now,
      });
      input.store.saveRun(run);
      input.store.appendEvent({
        runId: run.id,
        type: "run.created",
        actorType: "user",
        actorId: input.userId,
        payload: { taskId: task.id, iteration: run.iteration },
      });
      return run;
    },
  });
}
