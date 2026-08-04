"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { startForgeRunAction } from "@/app/actions/forge";
import { initialForgeStartActionState } from "@/lib/forge/action-state";
import type { ForgeRepositoryOption } from "@/lib/forge/repositories";
import { RepositorySelector } from "./repository-selector";
import { RunReview } from "./run-review";
import { TaskComposer } from "./task-composer";

export function ForgeStartForm({
  repositories,
}: {
  repositories: ForgeRepositoryOption[];
}) {
  const [state, action, pending] = useActionState(
    startForgeRunAction,
    initialForgeStartActionState,
  );
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const defaultRepository = repositories.find(
    (repository) => repository.supported && repository.status === "active",
  );

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <RepositorySelector
        repositories={repositories}
        defaultRepositoryId={defaultRepository?.id}
      />
      <TaskComposer />
      <RunReview baseBranch={defaultRepository?.defaultBranch ?? "main"} />

      {state.error && (
        <div
          role="alert"
          data-testid="forge-start-error"
          className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          <p className="font-semibold">{state.errorCode ?? "START_FAILED"}</p>
          <p className="mt-1">{state.error}</p>
        </div>
      )}

      {state.ok && state.runId && (
        <div className="rounded-xl border border-accent/50 bg-accent/10 px-4 py-4 text-sm">
          <p className="font-semibold text-accent">Run queued.</p>
          <p className="mt-1 text-muted">
            {state.repository} · {state.demo ? "demo memory" : "durable PostgreSQL"}
          </p>
          <p
            data-testid="forge-run-id"
            className="mt-2 break-all font-mono text-xs text-foreground"
          >
            {state.runId}
          </p>
          {!state.demo && (
            <Link
              href={`/app/forge/runs/${state.runId}`}
              className="mt-4 inline-flex rounded-lg border border-accent px-4 py-2 text-sm font-semibold text-accent"
            >
              Open live run monitor
            </Link>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={pending || !defaultRepository}
        className="w-full rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-background transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Creating durable run…" : "Start governed run"}
      </button>
    </form>
  );
}
