import type { WorkspaceAuthorizer } from "../auth/workspace-authorizer.js";
import type { InMemoryForgeStore } from "../store/in-memory-store.js";

export async function addInstruction(input: {
  store: InMemoryForgeStore;
  authorizer: WorkspaceAuthorizer;
  workspaceId: string;
  userId: string;
  runId: string;
  instruction: string;
}): Promise<void> {
  await input.authorizer.assertCanAccess({
    workspaceId: input.workspaceId,
    userId: input.userId,
  });
  const run = input.store.getRun(input.runId);
  if (run.workspaceId !== input.workspaceId) throw new Error("UNAUTHORIZED");
  if (run.state !== "running" && run.state !== "awaiting_approval") {
    throw new Error(`Instructions are not allowed in state ${run.state}`);
  }
  input.store.appendEvent({
    runId: run.id,
    type: "agent.instruction_added",
    actorType: "user",
    actorId: input.userId,
    payload: { instruction: input.instruction },
  });
}
