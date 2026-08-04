import { NextResponse } from "next/server";

import { getForgeActor } from "@/lib/forge/actor";
import { forgeEvidenceReviewErrorResponse } from "@/lib/forge/evidence-review-http";
import {
  ForgeEvidenceReviewError,
  getForgeEvidenceReviewView,
  resolveForgeEvidenceReview,
} from "@/lib/forge/evidence-review-service";
import { resolveRejectedForgeReview } from "@/lib/forge/resolve-rejected-review";

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
    if (body.decision !== "approved" && body.decision !== "rejected") {
      throw new ForgeEvidenceReviewError(
        "INVALID_INPUT",
        "Review decision must be approved or rejected.",
        400,
      );
    }
    const requestInput = {
      actor,
      runId,
      rationale: typeof body.rationale === "string" ? body.rationale : undefined,
      expectedSnapshotVersion:
        typeof body.expectedSnapshotVersion === "number"
          ? body.expectedSnapshotVersion
          : Number.NaN,
      idempotencyKey:
        typeof body.idempotencyKey === "string" ? body.idempotencyKey : "",
    };
    const result =
      body.decision === "rejected"
        ? await resolveRejectedForgeReview(requestInput)
        : await resolveForgeEvidenceReview({
            ...requestInput,
            decision: "approved",
          });
    const view = await getForgeEvidenceReviewView(actor, runId);
    return NextResponse.json({ ok: true, ...result, view });
  } catch (error) {
    return forgeEvidenceReviewErrorResponse(error);
  }
}
