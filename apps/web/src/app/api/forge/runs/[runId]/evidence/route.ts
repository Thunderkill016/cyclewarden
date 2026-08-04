import { NextResponse } from "next/server";

import { getForgeActor } from "@/lib/forge/actor";
import { forgeEvidenceReviewErrorResponse } from "@/lib/forge/evidence-review-http";
import {
  getForgeEvidenceReviewView,
  prepareFixtureForgeEvidence,
} from "@/lib/forge/evidence-review-service";

export const dynamic = "force-dynamic";

type EvidenceBody = {
  idempotencyKey?: unknown;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  try {
    const [{ runId }, actor] = await Promise.all([
      context.params,
      getForgeActor(),
    ]);
    const view = await getForgeEvidenceReviewView(actor, runId);
    return NextResponse.json({ ok: true, view });
  } catch (error) {
    return forgeEvidenceReviewErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  try {
    const [{ runId }, actor, body] = await Promise.all([
      context.params,
      getForgeActor(),
      request.json() as Promise<EvidenceBody>,
    ]);
    const result = await prepareFixtureForgeEvidence({
      actor,
      runId,
      idempotencyKey:
        typeof body.idempotencyKey === "string" ? body.idempotencyKey : "",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return forgeEvidenceReviewErrorResponse(error);
  }
}
