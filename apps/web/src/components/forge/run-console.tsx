"use client";

import { useEffect, useRef, useState } from "react";

import type { ForgeInstructionTraceView } from "@/lib/forge/instruction-trace-service";
import {
  latestForgeCursor,
  mergeForgeEvents,
  projectForgeApprovals,
  projectForgeState,
} from "@/lib/forge/run-event-projection";
import type {
  ForgeApprovalView,
  ForgeCommandResult,
  ForgeRunEventView,
  ForgeRunView,
} from "@/lib/forge/run-control-service";
import { InstructionTrace } from "./instruction-trace";
import { MobileRunCommandCenter } from "./mobile-run-command-center";
import { RunActivityFeed } from "./run-activity-feed";

type CommandResponse = ForgeCommandResult & {
  ok: true;
};

type ErrorResponse = {
  ok: false;
  errorCode?: string;
  error?: string;
};

function upsertApproval(
  approvals: ForgeApprovalView[],
  incoming: ForgeApprovalView,
): ForgeApprovalView[] {
  const exists = approvals.some((approval) => approval.id === incoming.id);
  return exists
    ? approvals.map((approval) => (approval.id === incoming.id ? incoming : approval))
    : [...approvals, incoming];
}

async function parseResponse(response: Response): Promise<CommandResponse> {
  const body = (await response.json()) as CommandResponse | ErrorResponse;
  if (!response.ok || !body.ok) {
    const failure = body as ErrorResponse;
    throw new Error(failure.error ?? failure.errorCode ?? "Forge command failed");
  }
  return body;
}

export function RunConsole({
  initial,
  instructionTrace,
}: {
  initial: ForgeRunView;
  instructionTrace: ForgeInstructionTraceView;
}) {
  const [snapshot, setSnapshot] = useState(initial.snapshot);
  const [events, setEvents] = useState(initial.events);
  const [approvals, setApprovals] = useState(initial.approvals);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<"connecting" | "live" | "reconnecting">(
    "connecting",
  );
  const cursorRef = useRef(latestForgeCursor(initial.events));

  const applyEvents = (incoming: ForgeRunEventView[]) => {
    if (incoming.length === 0) return;
    cursorRef.current = Math.max(cursorRef.current, latestForgeCursor(incoming));
    setEvents((current) => mergeForgeEvents(current, incoming));
    setSnapshot((current) => ({
      ...current,
      state: incoming.reduce(projectForgeState, current.state),
      eventSequence: Math.max(current.eventSequence, latestForgeCursor(incoming)),
    }));
    setApprovals((current) => incoming.reduce(projectForgeApprovals, current));
  };

  useEffect(() => {
    const source = new EventSource(
      `/api/forge/runs/${snapshot.id}/events?after=${cursorRef.current}`,
    );
    const onEvent = (message: MessageEvent<string>) => {
      const event = JSON.parse(message.data) as ForgeRunEventView;
      applyEvents([event]);
    };
    source.addEventListener("forge", onEvent as EventListener);
    source.onopen = () => setConnection("live");
    source.onerror = () => setConnection("reconnecting");
    return () => {
      source.removeEventListener("forge", onEvent as EventListener);
      source.close();
    };
  }, [snapshot.id]);

  const sendInstruction = async (instruction: string) => {
    setPendingAction("instruction");
    setError(null);
    try {
      const response = await fetch(`/api/forge/runs/${snapshot.id}/commands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "add-instruction",
          instruction,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const result = await parseResponse(response);
      applyEvents(result.events);
      setSnapshot((current) => ({
        ...current,
        state: result.state,
        version: result.version,
      }));
      if (result.approval) {
        setApprovals((current) => upsertApproval(current, result.approval!));
      }
    } catch (commandError) {
      setError(
        commandError instanceof Error ? commandError.message : "Unable to add instruction",
      );
    } finally {
      setPendingAction(null);
    }
  };

  const cancelRun = async () => {
    setPendingAction("cancel");
    setError(null);
    try {
      const response = await fetch(`/api/forge/runs/${snapshot.id}/commands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "cancel",
          reason: "Cancelled from the responsive command center.",
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const result = await parseResponse(response);
      applyEvents(result.events);
      setSnapshot((current) => ({
        ...current,
        state: result.state,
        version: result.version,
      }));
    } catch (commandError) {
      setError(commandError instanceof Error ? commandError.message : "Unable to cancel run");
    } finally {
      setPendingAction(null);
    }
  };

  const decideApproval = async (
    approval: ForgeApprovalView,
    decision: "approved" | "rejected",
  ) => {
    setPendingAction(`approval:${approval.id}`);
    setError(null);
    try {
      const response = await fetch(
        `/api/forge/runs/${snapshot.id}/approvals/${approval.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision,
            expectedVersion: approval.version,
            reason: `${decision} from the responsive command center`,
          }),
        },
      );
      const result = await parseResponse(response);
      applyEvents(result.events);
      setSnapshot((current) => ({
        ...current,
        state: result.state,
        version: result.version,
      }));
      if (result.approval) {
        setApprovals((current) => upsertApproval(current, result.approval!));
      }
    } catch (commandError) {
      setError(
        commandError instanceof Error ? commandError.message : "Unable to resolve approval",
      );
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              {initial.project.provider} · {initial.project.repository}
            </p>
            <h1 className="mt-2 break-words text-2xl font-semibold text-foreground">
              {initial.task.title}
            </h1>
          </div>
          <div className="flex flex-col items-end gap-2 text-xs">
            <span
              data-testid="forge-stream-status"
              className="rounded-full border border-border px-3 py-1 text-muted"
            >
              stream: {connection}
            </span>
            <span className="font-mono text-muted">iteration {snapshot.iteration}</span>
          </div>
        </div>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-background p-3">
            <dt className="text-xs text-muted">Run ID</dt>
            <dd
              data-testid="forge-live-run-id"
              className="mt-1 break-all font-mono text-xs text-foreground"
            >
              {snapshot.id}
            </dd>
          </div>
          <div className="rounded-xl border border-border bg-background p-3">
            <dt className="text-xs text-muted">Base branch</dt>
            <dd className="mt-1 font-mono text-foreground">{snapshot.baseBranch}</dd>
          </div>
          <div className="rounded-xl border border-border bg-background p-3">
            <dt className="text-xs text-muted">Agent</dt>
            <dd className="mt-1 text-foreground">{snapshot.agentProvider}</dd>
          </div>
          <div className="rounded-xl border border-border bg-background p-3">
            <dt className="text-xs text-muted">Cursor</dt>
            <dd
              data-testid="forge-event-cursor"
              className="mt-1 font-mono text-foreground"
            >
              {latestForgeCursor(events)}
            </dd>
          </div>
        </dl>
      </section>

      <InstructionTrace {...instructionTrace} />

      {error && (
        <div
          role="alert"
          data-testid="forge-run-error"
          className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {error}
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <RunActivityFeed events={events} />
        <MobileRunCommandCenter
          state={snapshot.state}
          approvals={approvals}
          pendingAction={pendingAction}
          onInstruction={sendInstruction}
          onCancel={cancelRun}
          onApproval={decideApproval}
        />
      </div>
    </div>
  );
}
