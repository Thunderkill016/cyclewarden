import type {
  ForgeApprovalView,
  ForgeRunEventView,
  ForgeRunState,
} from "./run-control-service";

export function mergeForgeEvents(
  current: ForgeRunEventView[],
  incoming: ForgeRunEventView[],
): ForgeRunEventView[] {
  const bySequence = new Map<number, ForgeRunEventView>();
  for (const event of current) bySequence.set(event.sequence, event);
  for (const event of incoming) bySequence.set(event.sequence, event);
  return [...bySequence.values()].sort((left, right) => left.sequence - right.sequence);
}

export function latestForgeCursor(events: ForgeRunEventView[]): number {
  return events.reduce((cursor, event) => Math.max(cursor, event.sequence), 0);
}

export function projectForgeState(
  current: ForgeRunState,
  event: ForgeRunEventView,
): ForgeRunState {
  if (event.type === "run.cancel.requested") return "cancelling";
  if (event.type === "run.cancelled") return "cancelled";
  const payload = event.payload as { state?: unknown } | null;
  return payload && typeof payload.state === "string"
    ? (payload.state as ForgeRunState)
    : current;
}

export function projectForgeApprovals(
  current: ForgeApprovalView[],
  event: ForgeRunEventView,
): ForgeApprovalView[] {
  const payload = event.payload as Record<string, unknown> | null;
  if (!payload) return current;

  if (event.type === "approval.requested" && typeof payload.approvalId === "string") {
    if (current.some((approval) => approval.id === payload.approvalId)) return current;
    return [
      ...current,
      {
        id: payload.approvalId,
        requestKey: `event:${event.sequence}`,
        actionType: "sensitive_instruction",
        summary:
          typeof payload.summary === "string"
            ? payload.summary
            : "Sensitive action requires approval.",
        scope: {},
        riskLevel: typeof payload.riskLevel === "string" ? payload.riskLevel : "medium",
        status: "pending",
        version: typeof payload.version === "number" ? payload.version : 0,
        requestedAt: event.createdAt,
        resolvedAt: null,
        reason: null,
      },
    ];
  }

  if (event.type === "approval.resolved" && typeof payload.approvalId === "string") {
    return current.map((approval) =>
      approval.id === payload.approvalId
        ? {
            ...approval,
            status: typeof payload.status === "string" ? payload.status : approval.status,
            version: typeof payload.version === "number" ? payload.version : approval.version,
            reason: typeof payload.reason === "string" ? payload.reason : approval.reason,
            resolvedAt: event.createdAt,
          }
        : approval,
    );
  }

  return current;
}
