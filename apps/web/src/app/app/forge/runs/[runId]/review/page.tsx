import Link from "next/link";
import { notFound } from "next/navigation";

import { EvidenceReviewConsole } from "@/components/forge/evidence-review-console";
import { getForgeActor } from "@/lib/forge/actor";
import {
  ForgeEvidenceReviewError,
  getForgeEvidenceReviewView,
} from "@/lib/forge/evidence-review-service";

export const dynamic = "force-dynamic";

export default async function ForgeEvidenceReviewPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const [{ runId }, actor] = await Promise.all([params, getForgeActor()]);
  let view;
  try {
    view = await getForgeEvidenceReviewView(actor, runId);
  } catch (error) {
    if (
      error instanceof ForgeEvidenceReviewError &&
      (error.code === "NOT_FOUND_OR_UNAUTHORIZED" || error.code === "INVALID_INPUT")
    ) {
      notFound();
    }
    throw error;
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <nav className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/app/forge/runs/${runId}`}
          className="rounded-xl border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-accent hover:text-foreground"
        >
          ← Live run
        </Link>
        <Link
          href="/app/forge"
          className="rounded-xl border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-accent hover:text-foreground"
        >
          Forge home
        </Link>
      </nav>
      <EvidenceReviewConsole initial={view} />
    </main>
  );
}
