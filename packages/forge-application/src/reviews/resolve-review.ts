import { randomUUID } from "node:crypto";

import {
  evaluateCompletionGate,
  finalizeRejectedReview,
  reviewDecisionSchema,
  transitionRun,
  type ReviewDecision,
  type Run,
} from "@cyclewarden/forge-domain";

import type { WorkspaceAuthorizer } from "../auth/workspace-authorizer.js";
import type { InMemoryForgeStore } from "../store/in-memory-store.js";

export async function resolveReview(input: {
  store: InMemoryForgeStore;
  authorizer: WorkspaceAuthorizer;
  workspaceId: string;
  userId: string;
  runId: string;
  idempotencyKey: string;
  decision: "approved" | "rejected" | "cancelled";
  rationale?: string;
  advisoryWaivers?: Array<{
    evidenceKey: string;
    reason: string;
    scope: string;
  }>;
}): Promise<{ review: ReviewDecision; run: Run }> {
  await input.authorizer.assertCanAccess({
    workspaceId: input.workspaceId,
    userId: input.userId,
  });
  return input.store.executeIdempotent({
    workspaceId: input.workspaceId,
    operation: "review",
    idempotencyKey: input.idempotencyKey,
    request: {
      runId: input.runId,
      decision: input.decision,
      rationale: input.rationale ?? null,
      advisoryWaivers: input.advisoryWaivers ?? [],
    },
    execute: () => {
      let run = input.store.getRun(input.runId);
      if (run.workspaceId !== input.workspaceId) throw new Error("UNAUTHORIZED");
      if (run.state !== "awaiting_review") {
        throw new Error(`Run is not awaiting review: ${run.state}`);
      }
      const evidenceVersion = input.store.getEvidenceVersion(run.id);
      if (input.decision === "approved") {
        const gate = evaluateCompletionGate({
          currentSnapshotVersion: evidenceVersion,
          validations: input.store.getValidations(run.id),
          acceptanceEvidence: input.store.getEvidence(run.id),
        });
        if (!gate.eligibleForApproval) {
          throw new Error(gate.blockers.map((item) => item.code).join(","));
        }
      }
      const now = new Date().toISOString();
      const review = reviewDecisionSchema.parse({
        id: randomUUID(),
        runId: run.id,
        decision: input.decision,
        decidedBy: input.userId,
        rationale: input.rationale ?? null,
        evidenceSnapshotVersion: evidenceVersion,
        evidenceSnapshot: {
          validationIds: input.store.getValidations(run.id).map((item) => item.id),
          evidenceIds: input.store.getEvidence(run.id).map((item) => item.id),
        },
        advisoryWaivers: (input.advisoryWaivers ?? []).map((waiver) => ({
          ...waiver,
          waivedAt: now,
        })),
        createdAt: now,
      });
      input.store.saveReview(review);

      if (input.decision === "rejected") {
        run = {
          ...run,
          ...finalizeRejectedReview(run),
          finishedAt: now,
          updatedAt: now,
        };
        input.store.saveRun(run);
      } else if (input.decision === "cancelled") {
        run = {
          ...run,
          ...transitionRun(run, "completed"),
          reviewOutcome: "cancelled",
          finishedAt: now,
          updatedAt: now,
        };
        input.store.saveRun(run);
      }

      input.store.appendEvent({
        runId: run.id,
        type: "review.resolved",
        actorType: "user",
        actorId: input.userId,
        payload: { decision: input.decision },
      });
      return { review, run };
    },
  });
}
