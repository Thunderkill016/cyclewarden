import { NextResponse } from "next/server";

import { ForgeAuthenticationError, getForgeActor } from "@/lib/forge/actor";
import { listForgeRepositories } from "@/lib/forge/repositories";

export async function GET() {
  try {
    const actor = await getForgeActor();
    const repositories = await listForgeRepositories();
    return NextResponse.json({ actor: { id: actor.id, demo: actor.demo }, repositories });
  } catch (error) {
    if (error instanceof ForgeAuthenticationError) {
      return NextResponse.json({ error: error.code }, { status: 401 });
    }
    return NextResponse.json({ error: "REPOSITORY_LIST_FAILED" }, { status: 500 });
  }
}
