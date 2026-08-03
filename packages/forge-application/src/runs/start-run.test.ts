import { describe, expect, it } from "vitest";

import { StaticWorkspaceAuthorizer } from "../auth/workspace-authorizer.js";
import { InMemoryForgeStore } from "../store/in-memory-store.js";
import { createTask, DeterministicTaskNormalizer } from "../tasks/create-task.js";
import { ActiveRunExistsError, startRun } from "./start-run.js";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const projectId = "33333333-3333-4333-8333-333333333333";

async function fixture() {
  const store = new InMemoryForgeStore();
  const authorizer = new StaticWorkspaceAuthorizer(
    new Set([`${workspaceId}:${userId}`]),
  );
  const task = await createTask({
    store,
    authorizer,
    normalizer: new DeterministicTaskNormalizer(),
    workspaceId,
    projectId,
    userId,
    instruction: "Add a deterministic feature",
    instructionLanguage: "en",
    technicalOutputLanguage: "en",
  });
  return { store, authorizer, task };
}

describe("start run", () => {
  it("replays the same result for a duplicate idempotency key", async () => {
    const { store, authorizer, task } = await fixture();
    const input = {
      store,
      authorizer,
      workspaceId,
      userId,
      taskId: task.id,
      idempotencyKey: "start-1",
      baseBranch: "main",
      agentProvider: "fake-agent",
      sandboxProvider: "fake-sandbox",
      budgetPolicy: {},
      permissionPolicy: {},
    };
    const first = await startRun(input);
    const duplicate = await startRun(input);
    expect(duplicate.id).toBe(first.id);
    expect(store.listRunsForTask(task.id)).toHaveLength(1);
  });

  it("rejects another active run without creating a run", async () => {
    const { store, authorizer, task } = await fixture();
    await startRun({
      store,
      authorizer,
      workspaceId,
      userId,
      taskId: task.id,
      idempotencyKey: "start-1",
      baseBranch: "main",
      agentProvider: "fake-agent",
      sandboxProvider: "fake-sandbox",
      budgetPolicy: {},
      permissionPolicy: {},
    });
    await expect(
      startRun({
        store,
        authorizer,
        workspaceId,
        userId,
        taskId: task.id,
        idempotencyKey: "start-2",
        baseBranch: "main",
        agentProvider: "fake-agent",
        sandboxProvider: "fake-sandbox",
        budgetPolicy: {},
        permissionPolicy: {},
      }),
    ).rejects.toBeInstanceOf(ActiveRunExistsError);
    expect(store.listRunsForTask(task.id)).toHaveLength(1);
  });
});
