import { describe, expect, it } from "vitest";

import {
  latestForgeCursor,
  mergeForgeEvents,
  projectForgeApprovals,
  projectForgeState,
} from "./run-event-projection";
import {
  assertApprovalVersion,
  ForgeRunControlError,
  type ForgeApprovalView,
  type ForgeRunEventView,
} from "./run-control-service";

function event(
  sequence: number,
  type = "run.instruction.added",
  payload: unknown = {},
): ForgeRunEventView {
  return {
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    sequence,
    type,
    actorType: "user",
    actorId: "user-1",
    payload,
    createdAt: `2026-08-04T00:00:0${sequence}.000Z`,
  };
}

describe("Forge persisted-history then live projection", () => {
  it("replays ordered history and suppresses duplicate live events", () => {
    const history = [event(1, "run.created"), event(2)];
    const reconnectBatch = [event(2), event(3, "approval.requested")];

    const projected = mergeForgeEvents(history, reconnectBatch);

    expect(projected.map((item) => item.sequence)).toEqual([1, 2, 3]);
    expect(latestForgeCursor(projected)).toBe(3);
  });

  it("recovers gaps after a cursor without duplicating already-rendered events", () => {
    const beforeDisconnect = [event(1), event(2), event(3)];
    const recovered = [event(4), event(5)];
    const repeatedByReconnect = [event(5), event(6)];

    const projected = mergeForgeEvents(
      mergeForgeEvents(beforeDisconnect, recovered),
      repeatedByReconnect,
    );

    expect(projected.map((item) => item.sequence)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(latestForgeCursor(projected)).toBe(6);
  });

  it("projects cancellation state from ordered events", () => {
    const cancelling = projectForgeState("running", event(4, "run.cancel.requested"));
    const cancelled = projectForgeState(cancelling, event(5, "run.cancelled"));

    expect(cancelling).toBe("cancelling");
    expect(cancelled).toBe("cancelled");
  });

  it("projects requested and resolved approvals from the stream", () => {
    const requested = event(2, "approval.requested", {
      approvalId: "00000000-0000-4000-8000-000000000099",
      summary: "Approve package registry access",
      riskLevel: "medium",
      version: 0,
    });
    const resolved = event(3, "approval.resolved", {
      approvalId: "00000000-0000-4000-8000-000000000099",
      status: "approved",
      version: 1,
      reason: "Approved on mobile",
    });

    const approvals = projectForgeApprovals([], requested);
    const final = projectForgeApprovals(approvals, resolved);

    expect(final).toHaveLength(1);
    expect(final[0]).toMatchObject({ status: "approved", version: 1 });
  });
});

describe("Forge approval optimistic concurrency", () => {
  it("allows one session to win and rejects a stale second decision", () => {
    const pending: Pick<ForgeApprovalView, "status" | "version"> = {
      status: "pending",
      version: 0,
    };
    expect(() =>
      assertApprovalVersion({
        status: pending.status,
        actualVersion: pending.version,
        expectedVersion: 0,
      }),
    ).not.toThrow();

    const wonByFirstSession = { status: "approved", version: 1 };
    expect(() =>
      assertApprovalVersion({
        status: wonByFirstSession.status,
        actualVersion: wonByFirstSession.version,
        expectedVersion: 0,
      }),
    ).toThrowError(ForgeRunControlError);
  });
});
