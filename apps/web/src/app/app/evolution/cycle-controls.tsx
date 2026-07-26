"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  runEvolutionWorkspaceAction,
  type EvolutionActionState,
} from "@/app/actions/evolution";

const initialState: EvolutionActionState = { error: null };

type NextOperation = {
  value: "inspect" | "assess" | "research";
  title: string;
  description: string;
  pending: string;
  needsTrust: boolean;
};

const NEXT_OPERATION: Record<string, NextOperation> = {
  created: {
    value: "inspect",
    title: "Inspect configured repository",
    description: "Capture structure, checks, product signals and trust boundaries as evidence.",
    pending: "Inspecting repository…",
    needsTrust: false,
  },
  observed: {
    value: "assess",
    title: "Assess repository readiness",
    description: "Run up to three preferred package checks in an isolated temporary source copy.",
    pending: "Running trusted checks…",
    needsTrust: true,
  },
  modeled: {
    value: "research",
    title: "Research and prepare handoff",
    description:
      "Build a bounded coverage map, preserve contradictions, independently review the ranking and persist a reversible experiment.",
    pending: "Researching repository…",
    needsTrust: true,
  },
};

function ActionFeedback({ state }: { state: EvolutionActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm leading-relaxed text-red-300">
        {state.error}
      </p>
    );
  }
  if (state.ok && state.message) {
    return (
      <p role="status" className="text-sm leading-relaxed text-accent">
        {state.message}
      </p>
    );
  }
  return null;
}

function useRefreshAfterSuccess(state: EvolutionActionState, fallbackProjectId: string) {
  const router = useRouter();
  useEffect(() => {
    if (!state.ok || !state.cycleId) return;
    const projectId = state.projectId ?? fallbackProjectId;
    router.push(
      `/app/evolution?project=${encodeURIComponent(projectId)}&cycle=${encodeURIComponent(state.cycleId)}`
    );
    router.refresh();
  }, [fallbackProjectId, router, state.cycleId, state.message, state.ok, state.operation, state.projectId]);
}

export function CycleControls({
  enabled,
  accessReason,
  project,
  selected,
}: {
  enabled: boolean;
  accessReason: string;
  project: { id: string; label: string };
  selected: { cycleId: string; stage: string } | null;
}) {
  const [createState, createAction, createPending] = useActionState(
    runEvolutionWorkspaceAction,
    initialState
  );
  const [stepState, stepAction, stepPending] = useActionState(
    runEvolutionWorkspaceAction,
    initialState
  );
  useRefreshAfterSuccess(createState, project.id);
  useRefreshAfterSuccess(stepState, project.id);

  const next = selected ? NEXT_OPERATION[selected.stage] : null;

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <form action={createAction} className="space-y-4 p-5 sm:p-6">
          <input type="hidden" name="operation" value="start" />
          <input type="hidden" name="projectId" value={project.id} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">
              New A2 cycle
            </p>
            <h2 className="mt-2 text-lg font-semibold text-foreground">
              Define the decision objective
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              The workspace fixes autonomy at A2 and risk at R1. It cannot execute code, merge or
              deploy.
            </p>
          </div>
          <label className="block text-xs font-medium text-muted">
            Objective
            <textarea
              name="objective"
              required
              minLength={8}
              maxLength={500}
              rows={3}
              disabled={!enabled || createPending}
              placeholder="Choose the smallest evidence-backed experiment for the next product cycle"
              className="mt-1.5 w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
          <label className="block text-xs font-medium text-muted">
            Cycle ID <span className="font-normal">(optional)</span>
            <input
              name="cycleId"
              maxLength={128}
              pattern={"[A-Za-z0-9][A-Za-z0-9._:\\-]{2,127}"}
              disabled={!enabled || createPending}
              placeholder="cyclewarden:next-experiment"
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 font-mono text-sm text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
          <ActionFeedback state={createState} />
          <button
            type="submit"
            disabled={!enabled || createPending}
            className="min-h-11 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createPending ? "Creating cycle…" : "Create durable cycle"}
          </button>
        </form>

        <div className="border-t border-border bg-background/45 p-5 sm:p-6 lg:border-l lg:border-t-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            Next legal action
          </p>
          {!enabled ? (
            <div className="mt-4 rounded-xl border border-amber-700/50 bg-amber-950/30 p-4">
              <p className="text-sm font-medium text-amber-100">Workspace actions are locked</p>
              <p className="mt-2 text-sm leading-relaxed text-amber-100/80">{accessReason}</p>
            </div>
          ) : !selected ? (
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Create or select a cycle. Only the action allowed by its current lifecycle stage will
              appear here.
            </p>
          ) : next ? (
            <form action={stepAction} className="mt-4 space-y-4">
              <input type="hidden" name="operation" value={next.value} />
              <input type="hidden" name="projectId" value={project.id} />
              <input type="hidden" name="cycleId" value={selected.cycleId} />
              <div>
                <p className="font-medium text-foreground">{next.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{next.description}</p>
              </div>
              {next.needsTrust && (
                <label className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 text-sm leading-relaxed text-muted">
                  <input
                    type="checkbox"
                    required
                    name="trustedRepository"
                    value="trusted"
                    disabled={stepPending}
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
                  />
                  <span>
                    I confirm <strong className="font-medium text-foreground">{project.label}</strong> is
                    trusted. Package scripts run without a shell in a temporary source copy.
                  </span>
                </label>
              )}
              <ActionFeedback state={stepState} />
              <button
                type="submit"
                disabled={stepPending}
                className="min-h-11 w-full rounded-xl border border-accent/60 bg-accent/10 px-4 py-2.5 text-sm font-semibold text-accent transition-colors hover:border-accent hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {stepPending ? next.pending : next.title}
              </button>
            </form>
          ) : selected.stage === "planned" ? (
            <div className="mt-4 rounded-xl border border-accent/40 bg-accent/5 p-4">
              <p className="font-medium text-foreground">Execution handoff ready</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Review the decision, experiment, scope and verification plan below. Code execution
                remains intentionally disabled in this slice.
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Stage <code className="text-foreground">{selected.stage}</code> has no mutation exposed
              by this bounded workspace slice.
            </p>
          )}

          <div className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted">
            {enabled ? (
              <>
                Configured project: <code className="text-foreground">{project.label}</code>
              </>
            ) : (
              "Configured project details are hidden until operator access is granted."
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
