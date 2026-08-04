import { NextResponse } from "next/server";

import { getForgeActor } from "@/lib/forge/actor";
import { forgeRunErrorResponse } from "@/lib/forge/run-control-http";
import { getForgeRunView } from "@/lib/forge/run-control-service";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  try {
    const [{ runId }, actor] = await Promise.all([context.params, getForgeActor()]);
    const url = new URL(request.url);
    const after = Number(url.searchParams.get("after") ?? "0");
    const view = await getForgeRunView(actor, runId, after);
    return NextResponse.json({ ok: true, ...view });
  } catch (error) {
    return forgeRunErrorResponse(error);
  }
}
