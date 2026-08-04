import type { ApprovalRequest } from "@cyclewarden/forge-domain";

import type { WorkspaceAuthorizer } from "../auth/workspace-authorizer.js";
import type { InMemoryForgeStore } from "../store/in-memory-store.js";

export class ApprovalAlreadyResolvedError extends Error {
  constructor() {
    super("Approval request has already been resolved");
    this.name = "ApprovalAlreadyResolvedError";
  }
}

export async function resolveApproval(input: {
  store: InMemoryForgeStore;
  authorizer: WorkspaceAuthorizer;
  workspaceId: string;
  userId: string;
  approvalId: string;
  idempotencyKey: string;
  decision: "approved" | "rejected";
  reason: string;
}): Promise<ApprovalRequest> {
  await input.authorizer.assertCanAccess({
    workspaceId: input.workspaceId,
    userId: input.userId,
  });
  return input.store.executeIdempotent({
    workspaceId: input.workspaceId,
    operation: "resolve-approval",
    idempotencyKey: input.idempotencyKey,
    request: {
      approvalId: input.approvalId,
      decision: input.decision,
      reason: input.reason,
    },
    execute: () => {
      const approval = input.store.getApproval(input.approvalId);
      const run = input.store.getRun(approval.runId);
      if (run.workspaceId !== input.workspaceId) throw new Error("UNAUTHORIZED");
      if (approval.status !== "pending") {
        throw new ApprovalAlreadyResolvedError();
      }
      const resolved = input.store.saveApproval({
        ...approval,
        status: input.decision,
        resolvedBy: input.userId,
        resolvedAt: new Date().toISOString(),
        reason: input.reason,
        version: approval.version + 1,
      });
      input.store.appendEvent({
        runId: run.id,
        type: "approval.resolved",
        actorType: "user",
        actorId: input.userId,
        payload: { approvalId: approval.id, decision: input.decision },
      });
      return resolved;
    },
  });
}
