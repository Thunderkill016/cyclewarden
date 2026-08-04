import type { ForgeChangeSetView } from "@/lib/forge/evidence-review-service";

export function ChangeReview({ changeSet }: { changeSet: ForgeChangeSetView }) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Change set
          </p>
          <h2 className="mt-1 text-xl font-semibold text-foreground">
            Review the exact redacted diff
          </h2>
        </div>
        <div className="text-right font-mono text-[11px] text-muted">
          <p>snapshot v{changeSet.snapshotVersion}</p>
          <p>{changeSet.diffDigest.slice(0, 16)}…</p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {changeSet.changedFiles.map((file) => (
          <article
            key={file.path}
            className="rounded-xl border border-border bg-background p-3 text-sm"
          >
            <p className="break-all font-mono text-xs text-foreground">{file.path}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
              <span>{file.status}</span>
              <span className="text-emerald-400">+{file.additions}</span>
              <span className="text-rose-400">−{file.deletions}</span>
              <span>{file.scope} scope</span>
            </div>
          </article>
        ))}
      </div>

      <pre
        data-testid="forge-unified-diff"
        className="max-h-[34rem] overflow-auto rounded-xl border border-border bg-background p-4 text-xs leading-relaxed text-foreground"
      >
        <code>{changeSet.unifiedDiff}</code>
      </pre>

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-background p-4">
          <p className="font-medium text-foreground">Agent summary</p>
          <p className="mt-2 leading-relaxed text-muted">{changeSet.agentSummary}</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-4 font-mono text-xs text-muted">
          <p>base {changeSet.baseCommitSha}</p>
          <p className="mt-2">head {changeSet.headCommitSha}</p>
          <p className="mt-2">
            binary: {changeSet.containsBinary ? "yes" : "no"} · secret finding:{" "}
            {changeSet.containsSecretFinding ? "yes" : "no"}
          </p>
        </div>
      </div>
    </section>
  );
}
