import { randomUUID } from "node:crypto";

import {
  evaluateCompletionGate,
  publicationSchema,
  transitionRun,
  type Publication,
  type SourceProvider,
  type SourceRepositoryRef,
} from "@cyclewarden/forge-domain";

import type { WorkspaceAuthorizer } from "../auth/workspace-authorizer.js";
import type { InMemoryForgeStore } from "../store/in-memory-store.js";

export async function publishRun(input: {
  store: InMemoryForgeStore;
  authorizer: WorkspaceAuthorizer;
  sourceProvider: SourceProvider;
  workspaceId: string;
  userId: string;
  runId: string;
  idempotencyKey: string;
  repository: SourceRepositoryRef;
  branchName: string;
  commitMessage: string;
  title: string;
  body: string;
  expectedHeadSha: string;
}): Promise<Publication> {
  await input.authorizer.assertCanAccess({
    workspaceId: input.workspaceId,
    userId: input.userId,
  });
  return input.store.executeIdempotent({
    workspaceId: input.workspaceId,
    operation: "publish",
    idempotencyKey: input.idempotencyKey,
    request: {
      runId: input.runId,
      branchName: input.branchName,
      expectedHeadSha: input.expectedHeadSha,
    },
    execute: async () => {
      let run = input.store.getRun(input.runId);
      if (run.workspaceId !== input.workspaceId) throw new Error("UNAUTHORIZED");
      const review = input.store.getReview(run.id);
      const gate = evaluateCompletionGate({
        currentSnapshotVersion: input.store.getEvidenceVersion(run.id),
        validations: input.store.getValidations(run.id),
        acceptanceEvidence: input.store.getEvidence(run.id),
        ...(review ? { reviewDecision: review } : {}),
      });
      if (!gate.eligibleForPublication) {
        throw new Error(gate.blockers.map((item) => item.code).join(","));
      }

      run = {
        ...run,
        ...transitionRun(run, "publishing"),
        workingBranch: input.branchName,
        updatedAt: new Date().toISOString(),
      };
      input.store.saveRun(run);
      input.store.appendEvent({
        runId: run.id,
        type: "publication.started",
        actorType: "user",
        actorId: input.userId,
        payload: { branchName: input.branchName },
      });

      const providerResult = await input.sourceProvider.createDraftChangeRequest({
        repository: input.repository,
        baseBranch: run.baseBranch,
        branchName: input.branchName,
        commitMessage: input.commitMessage,
        title: input.title,
        body: input.body,
        draft: true,
        expectedHeadSha: input.expectedHeadSha,
      });
      const now = new Date().toISOString();
      const publication = publicationSchema.parse({
        ...providerResult,
        id: randomUUID(),
        runId: run.id,
        createdAt: now,
        updatedAt: now,
      });
      input.store.savePublication(publication);

      run = {
        ...run,
        ...transitionRun(run, "completed"),
        reviewOutcome: "approved",
        finishedAt: now,
        updatedAt: now,
      };
      input.store.saveRun(run);
      input.store.appendEvent({
        runId: run.id,
        type: "publication.completed",
        actorType: "provider",
        payload: {
          changeRequestId: publication.changeRequestId,
          changeRequestUrl: publication.changeRequestUrl,
        },
      });
      return publication;
    },
  });
}
