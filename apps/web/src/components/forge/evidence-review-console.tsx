"use client";

import { useState } from "react";

import type {
  ForgeEvidenceReviewView,
  ForgeReviewMutationResult,
} from "@/lib/forge/evidence-review-service";
import { ChangeReview } from "./change-review";
import { EvidenceStatusPanel } from "./evidence-status-panel";

type ApiFailure = {
  ok: false;
  error?: string;
  errorCode?: string;
};

type MutationSuccess = {
  ok: true;
  view?: ForgeEvidenceReviewView;
} & ForgeReviewMutationResult;
type MutationResponse = MutationSuccess | ApiFailure;
type ViewResponse = { ok: true; view: ForgeEvidenceReviewView } | ApiFailure;

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export function EvidenceReviewConsole({
  initial,
}: {
  initial: ForgeEvidenceReviewView;
}) {
  const [view, setView] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [rationale, setRationale] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    const response = await fetch(
      `/api/forge/runs/${view.run.id}/evidence?cursor=${Date.now()}`,
      { cache: "no-store" },
    );
    const result = await readJson<ViewResponse>(response);
    if (!result.ok) {
      throw new Error(result.error ?? "Unable to refresh evidence.");
    }
    setView(result.view);
    return result.view;
  }

  async function mutate(
    label: string,
    path: string,
    body: Record<string, unknown>,
  ): Promise<MutationSuccess | null> {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await readJson<MutationResponse>(response);
      if (!result.ok) {
        throw new Error(
          `${result.errorCode ?? "REQUEST_FAILED"}: ${result.error ?? "Request failed."}`,
        );
      }
      if (result.view) setView(result.view);
      setNotice(result.replayed ? "The idempotent result was replayed." : "Saved.");
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Request failed.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function prepareEvidence() {
    const result = await mutate(
      "prepare",
      `/api/forge/runs/${view.run.id}/evidence`,
      { idempotencyKey: crypto.randomUUID() },
    );
    if (result && !result.view) await refresh();
  }

  async function resolveReview(decision: "approved" | "rejected") {
    if (!view.changeSet) return;
    const result = await mutate(
      decision,
      `/api/forge/runs/${view.run.id}/review`,
      {
        decision,
        rationale,
        expectedSnapshotVersion: view.changeSet.snapshotVersion,
        idempotencyKey: crypto.randomUUID(),
      },
    );
    if (result && !result.view) await refresh();
  }

  async function createNextIteration() {
    const result = await mutate(
      "iteration",
      `/api/forge/runs/${view.run.id}/iterations`,
      { idempotencyKey: crypto.randomUUID() },
    );
    if (result?.nextRunId) {
      window.location.assign(`/app/forge/runs/${result.nextRunId}/review`);
    }
  }

  async function publish() {
    if (!view.changeSet) return;
    const result = await mutate(
      "publish",
      `/api/forge/runs/${view.run.id}/publication`,
      {
        expectedSnapshotVersion: view.changeSet.snapshotVersion,
        idempotencyKey: crypto.randomUUID(),
      },
    );
    if (result && !result.view) await refresh();
  }

  const canPrepare =
    !view.changeSet &&
    view.project.provider === "fake-source" &&
    ["queued", "provisioning", "running", "validating"].includes(view.run.state);
  const reviewPending = Boolean(view.changeSet && !view.review && view.run.state === "awaiting_review");
  const rejected = view.review?.decision === "rejected" && view.run.state === "completed";
  const approved = view.review?.decision === "approved";
  const canPublish = approved && view.gate.eligibleForPublication && !view.publication;
  const canRetryPublication =
    approved && view.gate.eligibleForPublication && view.publication?.status === "failed";

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              Evidence review · iteration {view.run.iteration}
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
              {view.task.title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
              {view.task.originalInstruction}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background px-4 py-3 text-right text-xs text-muted">
            <p
              data-testid="forge-review-state"
              className="font-semibold text-foreground"
            >
              {view.run.state}
            </p>
            <p
              data-testid="forge-review-run-id"
              className="mt-1 break-all font-mono"
            >
              {view.run.id}
            </p>
          </div>
        </div>
      </section>

      {canPrepare && (
        <section className="rounded-2xl border border-dashed border-accent/60 bg-accent/5 p-5 text-center">
          <p className="text-sm leading-relaxed text-muted">
            This fixture run has not produced evidence yet. Generate the deterministic
            fake-provider result to exercise the review and publication boundary.
          </p>
          <button
            type="button"
            data-testid="forge-prepare-evidence"
            disabled={busy !== null}
            onClick={prepareEvidence}
            className="mt-4 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-background disabled:opacity-50"
          >
            {busy === "prepare" ? "Generating evidence…" : "Generate fixture evidence"}
          </button>
        </section>
      )}

      {view.changeSet && <ChangeReview changeSet={view.changeSet} />}
      <EvidenceStatusPanel view={view} />

      {reviewPending && (
        <section className="space-y-4 rounded-2xl border border-accent/50 bg-accent/5 p-4 sm:p-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Developer decision</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              The decision is bound to snapshot v{view.changeSet?.snapshotVersion}. A later
              evidence mutation makes this review stale.
            </p>
          </div>
          <label className="block text-sm text-muted">
            Rationale
            <textarea
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
              rows={3}
              className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-accent"
              placeholder="Explain the approval or what the next iteration must fix."
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              data-testid="forge-review-reject"
              disabled={busy !== null}
              onClick={() => resolveReview("rejected")}
              className="rounded-xl border border-rose-500/50 bg-rose-500/10 px-5 py-3 text-sm font-semibold text-rose-200 disabled:opacity-50"
            >
              {busy === "rejected" ? "Rejecting…" : "Reject and request iteration"}
            </button>
            <button
              type="button"
              data-testid="forge-review-approve"
              disabled={busy !== null || !view.gate.eligibleForApproval}
              onClick={() => resolveReview("approved")}
              className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "approved" ? "Approving…" : "Approve evidence snapshot"}
            </button>
          </div>
        </section>
      )}

      {rejected && (
        <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
          <h2 className="text-lg font-semibold text-amber-100">Review rejected</h2>
          <p className="mt-2 text-sm text-amber-100/80">
            Prior evidence remains immutable. Create a new run iteration for the same task.
          </p>
          <button
            type="button"
            data-testid="forge-next-iteration"
            disabled={busy !== null}
            onClick={createNextIteration}
            className="mt-4 rounded-xl bg-amber-200 px-5 py-3 text-sm font-semibold text-amber-950 disabled:opacity-50"
          >
            {busy === "iteration" ? "Creating iteration…" : "Create next iteration"}
          </button>
        </section>
      )}

      {(canPublish || canRetryPublication) && (
        <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5">
          <h2 className="text-lg font-semibold text-emerald-100">
            Approved snapshot is ready to publish
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-emerald-100/80">
            Publication uses the exact approved head SHA, creates a new branch, and opens a
            draft change request. It never writes directly to the base branch.
          </p>
          <button
            type="button"
            data-testid="forge-publish"
            disabled={busy !== null}
            onClick={publish}
            className="mt-4 rounded-xl bg-emerald-200 px-5 py-3 text-sm font-semibold text-emerald-950 disabled:opacity-50"
          >
            {busy === "publish" ? "Publishing…" : canRetryPublication ? "Reconcile publication" : "Create draft pull request"}
          </button>
        </section>
      )}

      {view.publication?.status === "pr_created" && view.publication.changeRequestUrl && (
        <section className="rounded-2xl border border-emerald-500/50 bg-emerald-500/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            Draft publication complete
          </p>
          <a
            data-testid="forge-publication-url"
            href={view.publication.changeRequestUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 block break-all font-mono text-sm text-emerald-100 underline underline-offset-4"
          >
            {view.publication.changeRequestUrl}
          </a>
          <p className="mt-3 text-xs text-emerald-100/70">
            {view.publication.branchName} · {view.publication.commitSha}
          </p>
        </section>
      )}

      {notice && (
        <p role="status" className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted">
          {notice}
        </p>
      )}
      {error && (
        <p
          role="alert"
          data-testid="forge-review-error"
          className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
        >
          {error}
        </p>
      )}
    </div>
  );
}
