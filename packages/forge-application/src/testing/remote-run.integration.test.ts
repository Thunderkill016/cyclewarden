import { describe, expect, it } from "vitest";

import { StaticWorkspaceAuthorizer } from "../auth/workspace-authorizer.js";
import { publishRun } from "../publications/publish-run.js";
import { executeRun } from "../runs/execute-run.js";
import { createNextRunIteration } from "../runs/create-next-iteration.js";
import { startRun } from "../runs/start-run.js";
import { resolveReview } from "../reviews/resolve-review.js";
import { InMemoryForgeStore } from "../store/in-memory-store.js";
import { createTask, DeterministicTaskNormalizer } from "../tasks/create-task.js";
import { FakeCodingAgentProvider } from "./fake-agent-provider.js";
import { FakeSandboxProvider } from "./fake-sandbox-provider.js";
import { FakeSourceProvider } from "./fake-source-provider.js";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const projectId = "33333333-3333-4333-8333-333333333333";

async function executeToReview(input: {
  store: InMemoryForgeStore;
  runId: string;
  sandbox: FakeSandboxProvider;
  agent: FakeCodingAgentProvider;
}) {
  return executeRun({
    store: input.store,
    runId: input.runId,
    sandboxProvider: input.sandbox,
    codingAgentProvider: input.agent,
    repositoryUrl: "https://example.test/repo.git",
    repositoryCredentialHandle: "secret-handle",
  });
}

describe("deterministic remote run lifecycle", () => {
  it("preserves rejected iteration history and publishes the approved next iteration", async () => {
    const store = new InMemoryForgeStore();
    const authorizer = new StaticWorkspaceAuthorizer(new Set([`${workspaceId}:${userId}`]));
    const task = await createTask({
      store,
      authorizer,
      normalizer: new DeterministicTaskNormalizer(),
      workspaceId,
      projectId,
      userId,
      instruction: "Build the first Forge lifecycle",
      instructionLanguage: "en",
      technicalOutputLanguage: "en",
    });
    const sandbox = new FakeSandboxProvider();
    const agent = new FakeCodingAgentProvider();
    const source = new FakeSourceProvider();

    const first = await startRun({
      store,
      authorizer,
      workspaceId,
      userId,
      taskId: task.id,
      idempotencyKey: "start-1",
      baseBranch: "main",
      agentProvider: agent.key,
      sandboxProvider: sandbox.key,
      budgetPolicy: {},
      permissionPolicy: {},
    });
    await executeToReview({ store, runId: first.id, sandbox, agent });
    const rejected = await resolveReview({
      store,
      authorizer,
      workspaceId,
      userId,
      runId: first.id,
      idempotencyKey: "review-reject",
      decision: "rejected",
      rationale: "Needs another iteration",
    });
    expect(rejected.run).toMatchObject({
      state: "completed",
      reviewOutcome: "rejected",
      iteration: 1,
    });

    const second = await createNextRunIteration({
      store,
      authorizer,
      workspaceId,
      userId,
      previousRunId: first.id,
      instruction: "Address review feedback",
      idempotencyKey: "iteration-2",
    });
    expect(second.iteration).toBe(2);
    await executeToReview({ store, runId: second.id, sandbox, agent });
    const approved = await resolveReview({
      store,
      authorizer,
      workspaceId,
      userId,
      runId: second.id,
      idempotencyKey: "review-approve",
      decision: "approved",
      rationale: "Evidence is complete",
    });
    expect(approved.review.decision).toBe("approved");

    const repository = (await source.listRepositories({ connectionId: "connection" })).repositories[0]!;
    const publication = await publishRun({
      store,
      authorizer,
      sourceProvider: source,
      workspaceId,
      userId,
      runId: second.id,
      idempotencyKey: "publish-1",
      repository,
      branchName: "atoryn/remote-run",
      commitMessage: "feat: add remote run",
      title: "Add remote run",
      body: "Deterministic fixture",
      expectedHeadSha: "abc123",
    });

    expect(publication.status).toBe("pr_created");
    expect(store.getRun(second.id)).toMatchObject({
      state: "completed",
      reviewOutcome: "approved",
      iteration: 2,
    });
    expect(store.getRun(first.id)).toMatchObject({
      state: "completed",
      reviewOutcome: "rejected",
      iteration: 1,
    });
    expect(store.listRunsForTask(task.id)).toHaveLength(2);
    expect(source.publicationCalls).toHaveLength(1);
    expect(sandbox.createCalls).toHaveLength(2);
    expect(agent.startCalls).toHaveLength(2);
  });
});
