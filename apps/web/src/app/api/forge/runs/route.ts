import { NextResponse } from "next/server";

import { ForgeAuthenticationError, getForgeActor } from "@/lib/forge/actor";
import { forgeStartRunInputSchema } from "@/lib/forge/start-run-input";
import {
  ForgeStartRunError,
  startGovernedForgeRun,
} from "@/lib/forge/start-run-service";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = forgeStartRunInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_TASK", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const actor = await getForgeActor();
    const result = await startGovernedForgeRun({ actor, request: parsed.data });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ForgeAuthenticationError) {
      return NextResponse.json({ error: error.code }, { status: 401 });
    }
    if (error instanceof ForgeStartRunError) {
      const status = error.code === "ACTIVE_RUN_EXISTS" ? 409 : 422;
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status },
      );
    }
    return NextResponse.json({ error: "START_FAILED" }, { status: 500 });
  }
}
