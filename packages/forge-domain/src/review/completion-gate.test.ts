import { describe, expect, it } from "vitest";

import type {
  AcceptanceEvidence,
  ReviewDecision,
  ValidationResult,
} from "../contracts/index.js";
import { evaluateCompletionGate } from "./completion-gate.js";

const baseValidation: ValidationResult = {
  id: "11111111-1111-4111-8111-111111111111",
  runId: "22222222-2222-4222-8222-222222222222",
  kind: "test",
  command: "pnpm test",
  requirement: "constitution",
  status: "passed",
  exitCode: 0,
  durationMs: 10,
  outputSummary: "passed",
  artifactRef: null,
};

const baseEvidence: AcceptanceEvidence = {
  id: "33333333-3333-4333-8333-333333333333",
  runId: baseValidation.runId,
  criterionKey: "criterion-1",
  requirement: "task_mandatory",
  status: "satisfied",
  evidenceType: "test",
  evidenceRef: null,
  explanation: "Covered by deterministic test",
  waivedBy: null,
  waivedReason: null,
  waivedAt: null,
};

const approvedReview: ReviewDecision = {
  id: "44444444-4444-4444-8444-444444444444",
  runId: baseValidation.runId,
  decision: "approved",
  decidedBy: "55555555-5555-4555-8555-555555555555",
  rationale: null,
  evidenceSnapshotVersion: 3,
  evidenceSnapshot: {},
  advisoryWaivers: [],
  createdAt: "2026-08-04T00:00:00.000Z",
};

describe("completion gate", () => {
  it("allows approval and publication with current mandatory evidence", () => {
    expect(
      evaluateCompletionGate({
        currentSnapshotVersion: 3,
        validations: [baseValidation],
        acceptanceEvidence: [baseEvidence],
        reviewDecision: approvedReview,
      }),
    ).toEqual({
      eligibleForApproval: true,
      eligibleForPublication: true,
      blockers: [],
    });
  });

  it("never accepts a mandatory waiver", () => {
    const result = evaluateCompletionGate({
      currentSnapshotVersion: 3,
      validations: [baseValidation],
      acceptanceEvidence: [
        {
          ...baseEvidence,
          status: "waived",
          waivedBy: approvedReview.decidedBy,
          waivedReason: "skip",
          waivedAt: approvedReview.createdAt,
        },
      ],
    });

    expect(result.eligibleForApproval).toBe(false);
    expect(result.blockers[0]?.code).toBe("INVALID_EVIDENCE_WAIVER");
  });

  it("accepts a fully audited advisory waiver", () => {
    const result = evaluateCompletionGate({
      currentSnapshotVersion: 3,
      validations: [baseValidation],
      acceptanceEvidence: [
        baseEvidence,
        {
          ...baseEvidence,
          id: "66666666-6666-4666-8666-666666666666",
          criterionKey: "advisory-1",
          requirement: "advisory",
          status: "waived",
          waivedBy: approvedReview.decidedBy,
          waivedReason: "Diagnostic is not blocking this MVP",
          waivedAt: approvedReview.createdAt,
        },
      ],
    });

    expect(result.eligibleForApproval).toBe(true);
  });

  it("blocks publication when the reviewed snapshot is stale", () => {
    const result = evaluateCompletionGate({
      currentSnapshotVersion: 4,
      validations: [baseValidation],
      acceptanceEvidence: [baseEvidence],
      reviewDecision: approvedReview,
    });

    expect(result.eligibleForPublication).toBe(false);
    expect(result.blockers.some((item) => item.code === "STALE_EVIDENCE_SNAPSHOT")).toBe(true);
  });
});
