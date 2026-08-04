import Link from "next/link";

import { ForgeStartForm } from "@/components/forge/forge-start-form";
import { getForgeActor } from "@/lib/forge/actor";
import { listForgeRepositories } from "@/lib/forge/repositories";

export default async function ForgeStartPage() {
  const [actor, repositories] = await Promise.all([
    getForgeActor(),
    listForgeRepositories(),
  ]);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Atoryn Forge · governed remote execution
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
            Start one reviewable coding run
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            Select a repository, describe the task in Vietnamese or English, review
            permissions and budget, then create one durable queued run. Execution remains
            provider-neutral and sensitive actions stay human-governed.
          </p>
        </div>
        <Link
          href="/app"
          className="rounded-xl border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-accent hover:text-foreground"
        >
          Back to app
        </Link>
      </header>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm">
        <span className="text-muted">
          Actor: <span className="font-medium text-foreground">{actor.displayName}</span>
        </span>
        <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">
          {actor.demo ? "demo mode" : "authenticated workspace"}
        </span>
      </div>

      <ForgeStartForm repositories={repositories} />
    </main>
  );
}
