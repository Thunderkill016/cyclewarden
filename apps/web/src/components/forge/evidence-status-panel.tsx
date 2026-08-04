import type { ForgeEvidenceReviewView } from "@/lib/forge/evidence-review-service";

export function EvidenceStatusPanel({ view }: { view: ForgeEvidenceReviewView }) {
  const changeSet = view.changeSet;
  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Evidence gate
          </p>
          <h2 className="mt-1 text-xl font-semibold text-foreground">
            Checks, criteria, risk and usage
          </h2>
        </div>
        <span
          data-testid="forge-evidence-gate"
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
            view.gate.eligibleForApproval
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
              : "border-amber-500/50 bg-amber-500/10 text-amber-300"
          }`}
        >
          {view.gate.eligibleForApproval ? "approval ready" : "blocked"}
        </span>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Validation commands</h3>
          {view.validations.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-border bg-background p-3 text-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{item.kind}</p>
                  <p className="mt-1 break-all font-mono text-xs text-muted">
                    {item.command}
                  </p>
                </div>
                <span
                  className={
                    item.status === "passed" ? "text-emerald-400" : "text-rose-400"
                  }
                >
                  {item.status}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted">
                {item.requirement} · {item.durationMs ?? 0} ms
              </p>
            </article>
          ))}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Acceptance evidence</h3>
          {view.evidence.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-border bg-background p-3 text-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-foreground">{item.criterionKey}</p>
                <span
                  className={
                    item.status === "satisfied" || item.status === "waived"
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }
                >
                  {item.status}
                </span>
              </div>
              <p className="mt-2 leading-relaxed text-muted">{item.explanation}</p>
              <p className="mt-2 text-xs text-muted">
                {item.requirement} · {item.evidenceType}
              </p>
            </article>
          ))}
        </div>
      </div>

      {view.gate.blockers.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <h3 className="text-sm font-semibold text-amber-200">Completion blockers</h3>
          <ul className="mt-2 space-y-2 text-sm text-amber-100/80">
            {view.gate.blockers.map((blocker) => (
              <li key={`${blocker.code}:${blocker.key}`}>• {blocker.message}</li>
            ))}
          </ul>
        </div>
      )}

      {changeSet && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-background p-4">
            <h3 className="text-sm font-semibold text-foreground">Unresolved risks</h3>
            <ul className="mt-2 space-y-2 text-sm leading-relaxed text-muted">
              {changeSet.unresolvedRisks.map((risk) => (
                <li key={risk}>• {risk}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-background p-4">
            <h3 className="text-sm font-semibold text-foreground">Usage estimate</h3>
            <dl className="mt-2 grid grid-cols-3 gap-2 text-center text-xs text-muted">
              <div>
                <dt>Tokens</dt>
                <dd className="mt-1 font-mono text-foreground">
                  {changeSet.usageEstimate.modelTokens}
                </dd>
              </div>
              <div>
                <dt>Sandbox</dt>
                <dd className="mt-1 font-mono text-foreground">
                  {changeSet.usageEstimate.sandboxSeconds}s
                </dd>
              </div>
              <div>
                <dt>Est. USD</dt>
                <dd className="mt-1 font-mono text-foreground">
                  ${changeSet.usageEstimate.estimatedUsd.toFixed(2)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </section>
  );
}
