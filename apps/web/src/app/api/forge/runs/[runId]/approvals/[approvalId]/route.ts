import { NextResponse } from "next/server";

import { getForgeActor } from "@/lib/forge/actor";
import { forgeRunErrorResponse } from "@/lib/forge/run-control-http";
import {
  ForgeRunControlError,
  resolveForgeApproval,
} from "@/lib/forge/run-control-service";

export const dynamic = "force-dynamic";

type ApprovalBody = {
  decision?: unknown;
  expectedVersion?: unknown;
  reason?: unknown;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ runId: string; approvalId: string }> },
) {
  try {
    const [{ runId, approvalId }, actor, body] = await Promise.all([
      context.params,
      getForgeActor(),
      request.json() as Promise<ApprovalBody>,
    ]);
    if (body.decision !== "approved" && body.decision !== "rejected") {
      throw new ForgeRunControlError(
        "INVALID_COMMAND",
        "Approval decision must be approved or rejected.",
        400,
      );
    }
    const result = await resolveForgeApproval({
      actor,
      runId,
      approvalId,
      expectedVersion:
        typeof body.expectedVersion === "number" ? body.expectedVersion : -1,
      decision: body.decision,
      reason: typeof body.reason === "string" ? body.reason : "",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return forgeRunErrorResponse(error);
  }
}
