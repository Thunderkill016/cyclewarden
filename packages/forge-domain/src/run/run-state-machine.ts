import type { ReviewOutcome, RunState } from "../contracts/index.js";

export const ACTIVE_RUN_STATES = new Set<RunState>([
  "queued",
  "provisioning",
  "running",
  "awaiting_approval",
  "cancelling",
  "validating",
  "awaiting_review",
  "publishing",
]);

export const CANCELLABLE_RUN_STATES = new Set<RunState>([
  "queued",
  "provisioning",
  "running",
  "awaiting_approval",
  "validating",
]);

const LEGAL_TRANSITIONS: Readonly<Record<RunState, readonly RunState[]>> = {
  draft: ["queued", "cancelled"],
  queued: ["provisioning", "cancelling", "failed", "expired"],
  provisioning: ["running", "cancelling", "failed", "expired"],
  running: ["awaiting_approval", "validating", "cancelling", "failed", "expired"],
  awaiting_approval: ["running", "cancelling", "failed", "expired"],
  cancelling: ["cancelled", "failed"],
  validating: ["awaiting_review", "cancelling", "failed", "expired"],
  awaiting_review: ["publishing", "completed", "failed", "expired"],
  publishing: ["completed", "failed"],
  completed: [],
  failed: [],
  cancelled: [],
  expired: [],
};

export class IllegalRunTransitionError extends Error {
  readonly code = "ILLEGAL_RUN_TRANSITION" as const;

  constructor(
    readonly currentState: RunState,
    readonly requestedState: RunState,
  ) {
    super(`Illegal run transition: ${currentState} -> ${requestedState}`);
    this.name = "IllegalRunTransitionError";
  }
}

export interface RunLifecycleSnapshot {
  id: string;
  taskId: string;
  workspaceId: string;
  iteration: number;
  state: RunState;
  reviewOutcome: ReviewOutcome | null;
  version: number;
}

export function isActiveRunState(state: RunState): boolean {
  return ACTIVE_RUN_STATES.has(state);
}

export function isCancellableRunState(state: RunState): boolean {
  return CANCELLABLE_RUN_STATES.has(state);
}

export function canTransition(current: RunState, next: RunState): boolean {
  return LEGAL_TRANSITIONS[current].includes(next);
}

export function transitionRun(
  run: RunLifecycleSnapshot,
  nextState: RunState,
): RunLifecycleSnapshot {
  if (!canTransition(run.state, nextState)) {
    throw new IllegalRunTransitionError(run.state, nextState);
  }

  return {
    ...run,
    state: nextState,
    version: run.version + 1,
  };
}

export type RunAdmissionResult =
  | { ok: true }
  | { ok: false; code: "ACTIVE_RUN_EXISTS"; activeRunCount: number };

export function evaluateRunAdmission(input: {
  activeRunCount: number;
  activeRunLimit?: number;
}): RunAdmissionResult {
  const limit = input.activeRunLimit ?? 1;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError("activeRunLimit must be a positive integer");
  }
  if (!Number.isInteger(input.activeRunCount) || input.activeRunCount < 0) {
    throw new RangeError("activeRunCount must be a non-negative integer");
  }

  if (input.activeRunCount >= limit) {
    return {
      ok: false,
      code: "ACTIVE_RUN_EXISTS",
      activeRunCount: input.activeRunCount,
    };
  }

  return { ok: true };
}

export function finalizeRejectedReview(
  run: RunLifecycleSnapshot,
): RunLifecycleSnapshot {
  if (run.state !== "awaiting_review") {
    throw new IllegalRunTransitionError(run.state, "completed");
  }

  return {
    ...run,
    state: "completed",
    reviewOutcome: "rejected",
    version: run.version + 1,
  };
}

export function createNextIteration(input: {
  previousRun: RunLifecycleSnapshot;
  nextRunId: string;
  activeRunCount: number;
}): RunLifecycleSnapshot {
  const { previousRun } = input;
  if (
    previousRun.state !== "completed" ||
    previousRun.reviewOutcome !== "rejected"
  ) {
    throw new Error("A next iteration requires a completed rejected run");
  }

  const admission = evaluateRunAdmission({
    activeRunCount: input.activeRunCount,
  });
  if (!admission.ok) {
    const error = new Error(admission.code);
    error.name = admission.code;
    throw error;
  }

  return {
    id: input.nextRunId,
    taskId: previousRun.taskId,
    workspaceId: previousRun.workspaceId,
    iteration: previousRun.iteration + 1,
    state: "queued",
    reviewOutcome: null,
    version: 0,
  };
}
