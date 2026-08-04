import { describe, expect, it } from "vitest";

import { planPublicationRecovery } from "./evidence-review-service";

describe("Forge publication recovery", () => {
  it("reuses a completed draft change request without creating a duplicate", () => {
    expect(
      planPublicationRecovery({
        status: "pr_created",
        recordedCommitSha: "a".repeat(40),
        currentHeadSha: "a".repeat(40),
        changeRequestId: "draft-123",
      }),
    ).toBe("reuse-completed");
  });

  it.each(["pending", "pushed", "failed"] as const)(
    "reconciles a %s publication at the exact approved head",
    (status) => {
      expect(
        planPublicationRecovery({
          status,
          recordedCommitSha: "b".repeat(40),
          currentHeadSha: "b".repeat(40),
          changeRequestId: null,
        }),
      ).toBe("resume-publication");
    },
  );

  it("rejects reconciliation when the remote publication head is stale", () => {
    expect(
      planPublicationRecovery({
        status: "failed",
        recordedCommitSha: "c".repeat(40),
        currentHeadSha: "d".repeat(40),
        changeRequestId: null,
      }),
    ).toBe("reject-head-mismatch");
  });
});
