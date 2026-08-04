import { NextResponse } from "next/server";

import { ForgeAuthenticationError } from "./actor";
import { ForgeEvidenceReviewError } from "./evidence-review-service";

export function forgeEvidenceReviewErrorResponse(error: unknown): NextResponse {
  if (error instanceof ForgeAuthenticationError) {
    return NextResponse.json(
      { ok: false, errorCode: error.code, error: error.message },
      { status: 401 },
    );
  }

  if (error instanceof ForgeEvidenceReviewError) {
    return NextResponse.json(
      { ok: false, errorCode: error.code, error: error.message },
      { status: error.status },
    );
  }

  console.error("Unexpected Forge evidence review failure", error);
  return NextResponse.json(
    {
      ok: false,
      errorCode: "EVIDENCE_REVIEW_FAILED",
      error: "Unable to process the evidence review request.",
    },
    { status: 500 },
  );
}
