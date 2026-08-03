import { describe, expect, it } from "vitest";

import {
  createNextIteration,
  evaluateRunAdmission,
  finalizeRejectedReview,
  IllegalRunTransitionError,
  isActiveRunState,
  isCancellableRunState,
  transitionRun,
  type RunLifecycleSnapshot,
} from "./run-state-machine.js";

const baseRun: RunLifecycleSnapshot = {
  id: "run-1",
  taskId: "task-1",
  workspaceId: "workspace-1",
  iteration: 1,
  state: "queued",
  reviewOutcome: null,
  version: 0,
};

describe("run state machine", () => {
  it("allows legal transitions and increments version", () => {
    expect(transitionRun(baseRun, "provisioning")).toMatchObject({
      state: "provisioning",
      version: 1,
    });
  });

  it("rejects illegal transitions", () => {
    expect(() => transitionRun(baseRun, "completed")).toThrow(
      IllegalRunTransitionError,
    );
  });

  it("classifies active and cancellable states explicitly", () => {
    expect(isActiveRunState("awaiting_review")).toBe(true);
    expect(isActiveRunState("completed")).toBe(false);
    expect(isCancellableRunState("validating")).toBe(true);
    expect(isCancellableRunState("publishing")).toBe(false);
  });

  it("rejects a second active run deterministically", () => {
    expect(evaluateRunAdmission({ activeRunCount: 1 })).toEqual({
      ok: false,
      code: "ACTIVE_RUN_EXISTS",
      activeRunCount: 1,
    });
  });

  it("finalizes rejection and creates the next immutable iteration", () => {
    const rejected = finalizeRejectedReview({
      ...baseRun,
      state: "awaiting_review",
      version: 7,
    });
    expect(rejected).toMatchObject({
      state: "completed",
      reviewOutcome: "rejected",
      version: 8,
    });

    const next = createNextIteration({
      previousRun: rejected,
      nextRunId: "run-2",
      activeRunCount: 0,
    });
    expect(next).toEqual({
      id: "run-2",
      taskId: "task-1",
      workspaceId: "workspace-1",
      iteration: 2,
      state: "queued",
      reviewOutcome: null,
      version: 0,
    });
  });
});
