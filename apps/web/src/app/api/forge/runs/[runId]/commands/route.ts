import { NextResponse } from "next/server";

import { getForgeActor } from "@/lib/forge/actor";
import { forgeRunErrorResponse } from "@/lib/forge/run-control-http";
import {
  addForgeInstruction,
  cancelForgeRun,
  ForgeRunControlError,
} from "@/lib/forge/run-control-service";

export const dynamic = "force-dynamic";

type CommandBody = {
  operation?: unknown;
  instruction?: unknown;
  reason?: unknown;
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
      request.json() as Promise<CommandBody>,
    ]);
    const idempotencyKey =
      typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";

    if (body.operation === "add-instruction") {
      const result = await addForgeInstruction({
        actor,
        runId,
        instruction: typeof body.instruction === "string" ? body.instruction : "",
        idempotencyKey,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (body.operation === "cancel") {
      const result = await cancelForgeRun({
        actor,
        runId,
        idempotencyKey,
        reason: typeof body.reason === "string" ? body.reason : undefined,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    throw new ForgeRunControlError(
      "INVALID_COMMAND",
      "Command operation is unsupported.",
      400,
    );
  } catch (error) {
    return forgeRunErrorResponse(error);
  }
}
