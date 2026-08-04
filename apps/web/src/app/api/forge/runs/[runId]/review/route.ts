import { NextResponse } from "next/server";

import { getForgeActor } from "@/lib/forge/actor";
import { forgeEvidenceReviewErrorResponse } from "@/lib/forge/evidence-review-http";
import { resolveForgeEvidenceReview } from "@/lib/forge/evidence-review-service";

export const dynamic = "force-dynamic";

type ReviewBody = {
  decision?: unknown;
  rationale?: unknown;
  expectedSnapshotVersion?: unknown;
  idempotencyKey?: unknown;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  try {
    const [{ runId }, actor, body] = await Promise.all([
      context.params,
      getForgeActor(),
      request.json() as Promise<ReviewBody>,
    ]);
    const decision =
      body.decision === "approved" || body.decision === "rejected"
        ? body.decision
        : "";
    const result = await resolveForgeEvidenceReview({
      actor,
      runId,
      decision: decision as "approved" | "rejected",
      rationale: typeof body.rationale === "string" ? body.rationale : undefined,
      expectedSnapshotVersion:
        typeof body.expectedSnapshotVersion === "number"
          ? body.expectedSnapshotVersion
          : Number.NaN,
      idempotencyKey:
        typeof body.idempotencyKey === "string" ? body.idempotencyKey : "",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return forgeEvidenceReviewErrorResponse(error);
  }
}
