"use client";

import { useState } from "react";

import type {
  ForgeApprovalView,
  ForgeRunState,
} from "@/lib/forge/run-control-service";

const TERMINAL = new Set<ForgeRunState>(["completed", "failed", "cancelled", "expired"]);

export function MobileRunCommandCenter({
  state,
  approvals,
  pendingAction,
  onInstruction,
  onCancel,
  onApproval,
}: {
  state: ForgeRunState;
  approvals: ForgeApprovalView[];
  pendingAction: string | null;
  onInstruction: (instruction: string) => Promise<void>;
  onCancel: () => Promise<void>;
  onApproval: (
    approval: ForgeApprovalView,
    decision: "approved" | "rejected",
  ) => Promise<void>;
}) {
  const [instruction, setInstruction] = useState("");
  const terminal = TERMINAL.has(state);
  const pendingApprovals = approvals.filter((approval) => approval.status === "pending");

  return (
    <aside className="rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Mobile command center
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">Control this run</h2>
        </div>
        <span
          data-testid="forge-run-state"
          className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 font-mono text-xs text-accent"
        >
          {state}
        </span>
      </div>

      <form
        className="mt-5 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const value = instruction.trim();
          if (!value) return;
          void onInstruction(value).then(() => setInstruction(""));
        }}
      >
        <label className="block text-sm text-muted" htmlFor="forge-additional-instruction">
          Additional instruction
        </label>
        <textarea
          id="forge-additional-instruction"
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          disabled={terminal || pendingAction !== null}
          placeholder="Example: request package registry access and rerun validation"
          className="min-h-28 w-full resize-y rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:border-accent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={terminal || pendingAction !== null || instruction.trim().length < 3}
          className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pendingAction === "instruction" ? "Sending…" : "Send instruction"}
        </button>
      </form>

      {pendingApprovals.length > 0 && (
        <section data-testid="forge-pending-approvals" className="mt-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Pending approvals</h3>
          {pendingApprovals.map((approval) => (
            <article
              key={approval.id}
              className="rounded-xl border border-amber-400/40 bg-amber-400/5 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                  {approval.riskLevel} risk
                </span>
                <span className="font-mono text-xs text-muted">v{approval.version}</span>
              </div>
              <p className="mt-2 text-sm text-foreground">{approval.summary}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={pendingAction !== null}
                  onClick={() => void onApproval(approval, "rejected")}
                  className="rounded-lg border border-border px-3 py-2 text-sm text-muted disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={pendingAction !== null}
                  onClick={() => void onApproval(approval, "approved")}
                  className="rounded-lg border border-accent bg-accent/10 px-3 py-2 text-sm font-semibold text-accent disabled:opacity-50"
                >
                  Approve
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      <button
        type="button"
        disabled={terminal || pendingAction !== null}
        onClick={() => void onCancel()}
        className="mt-5 w-full rounded-xl border border-red-500/50 bg-red-500/5 px-4 py-3 text-sm font-semibold text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pendingAction === "cancel" ? "Cancelling…" : "Cancel run"}
      </button>
    </aside>
  );
}
