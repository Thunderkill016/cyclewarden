import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { StaticWorkspaceAuthorizer } from "../auth/workspace-authorizer.js";
import { InMemoryForgeStore } from "../store/in-memory-store.js";
import { createTask, DeterministicTaskNormalizer } from "../tasks/create-task.js";
import { startRun } from "../runs/start-run.js";
import { ApprovalAlreadyResolvedError, resolveApproval } from "./resolve-approval.js";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const projectId = "33333333-3333-4333-8333-333333333333";

it("allows only one approval resolution", async () => {
  const store = new InMemoryForgeStore();
  const authorizer = new StaticWorkspaceAuthorizer(new Set([`${workspaceId}:${userId}`]));
  const task = await createTask({
    store,
    authorizer,
    normalizer: new DeterministicTaskNormalizer(),
    workspaceId,
    projectId,
    userId,
    instruction: "Test approval",
    instructionLanguage: "en",
    technicalOutputLanguage: "en",
  });
  const run = await startRun({
    store,
    authorizer,
    workspaceId,
    userId,
    taskId: task.id,
    idempotencyKey: "start",
    baseBranch: "main",
    agentProvider: "fake-agent",
    sandboxProvider: "fake-sandbox",
    budgetPolicy: {},
    permissionPolicy: {},
  });
  const approvalId = randomUUID();
  store.saveApproval({
    id: approvalId,
    runId: run.id,
    requestKey: "network-1",
    actionType: "unrestricted_network_access",
    summary: "Open network",
    scope: {},
    riskLevel: "high",
    status: "pending",
    requestedAt: new Date().toISOString(),
    expiresAt: null,
    resolvedBy: null,
    resolvedAt: null,
    reason: null,
    version: 0,
  });

  const approved = await resolveApproval({
    store,
    authorizer,
    workspaceId,
    userId,
    approvalId,
    idempotencyKey: "approve-1",
    decision: "approved",
    reason: "Required for fixture",
  });
  expect(approved.status).toBe("approved");

  await expect(
    resolveApproval({
      store,
      authorizer,
      workspaceId,
      userId,
      approvalId,
      idempotencyKey: "approve-2",
      decision: "rejected",
      reason: "Competing decision",
    }),
  ).rejects.toBeInstanceOf(ApprovalAlreadyResolvedError);
});
