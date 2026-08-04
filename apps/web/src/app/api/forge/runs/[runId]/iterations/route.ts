import { NextResponse } from "next/server";

import { getForgeActor } from "@/lib/forge/actor";
import { forgeEvidenceReviewErrorResponse } from "@/lib/forge/evidence-review-http";
import { createNextForgeIteration } from "@/lib/forge/evidence-review-service";

export const dynamic = "force-dynamic";

type IterationBody = {
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
      request.json() as Promise<IterationBody>,
    ]);
    const result = await createNextForgeIteration({
      actor,
      previousRunId: runId,
      idempotencyKey:
        typeof body.idempotencyKey === "string" ? body.idempotencyKey : "",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return forgeEvidenceReviewErrorResponse(error);
  }
}
