import {
  isCancellableRunState,
  transitionRun,
  type Run,
} from "@cyclewarden/forge-domain";

import type { WorkspaceAuthorizer } from "../auth/workspace-authorizer.js";
import type { InMemoryForgeStore } from "../store/in-memory-store.js";

export async function cancelRun(input: {
  store: InMemoryForgeStore;
  authorizer: WorkspaceAuthorizer;
  workspaceId: string;
  userId: string;
  runId: string;
  idempotencyKey: string;
  reason: string;
}): Promise<Run> {
  await input.authorizer.assertCanAccess({
    workspaceId: input.workspaceId,
    userId: input.userId,
  });
  return input.store.executeIdempotent({
    workspaceId: input.workspaceId,
    operation: "cancel-run",
    idempotencyKey: input.idempotencyKey,
    request: { runId: input.runId, reason: input.reason },
    execute: () => {
      let run = input.store.getRun(input.runId);
      if (run.workspaceId !== input.workspaceId) throw new Error("UNAUTHORIZED");
      if (run.state === "cancelled") return run;
      if (!isCancellableRunState(run.state)) {
        throw new Error(`Run cannot be cancelled from ${run.state}`);
      }
      run = {
        ...run,
        ...transitionRun(run, "cancelling"),
        updatedAt: new Date().toISOString(),
      };
      input.store.saveRun(run);
      input.store.appendEvent({
        runId: run.id,
        type: "run.cancel_requested",
        actorType: "user",
        actorId: input.userId,
        payload: { reason: input.reason },
      });
      run = {
        ...run,
        ...transitionRun(run, "cancelled"),
        finishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      input.store.saveRun(run);
      input.store.appendEvent({ runId: run.id, type: "run.cancelled", payload: {} });
      return run;
    },
  });
}
