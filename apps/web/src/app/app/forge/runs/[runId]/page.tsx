import Link from "next/link";
import { notFound } from "next/navigation";

import { RunConsole } from "@/components/forge/run-console";
import { getForgeActor } from "@/lib/forge/actor";
import {
  ForgeRunControlError,
  getForgeRunView,
} from "@/lib/forge/run-control-service";

export const dynamic = "force-dynamic";

export default async function ForgeRunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const [{ runId }, actor] = await Promise.all([params, getForgeActor()]);
  let view;
  try {
    view = await getForgeRunView(actor, runId);
  } catch (error) {
    if (
      error instanceof ForgeRunControlError &&
      (error.code === "NOT_FOUND_OR_UNAUTHORIZED" || error.code === "INVALID_RUN_ID")
    ) {
      notFound();
    }
    throw error;
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <nav className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/app/forge"
          className="rounded-xl border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-accent hover:text-foreground"
        >
          ← Start another run
        </Link>
        <Link
          href="/app"
          className="rounded-xl border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-accent hover:text-foreground"
        >
          App home
        </Link>
      </nav>
      <RunConsole initial={view} />
    </main>
  );
}
