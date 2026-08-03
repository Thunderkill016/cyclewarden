import { NextResponse } from "next/server";

import { ForgeAuthenticationError } from "./actor";
import { ForgeRunControlError } from "./run-control-service";

export function forgeRunErrorResponse(error: unknown): NextResponse {
  if (error instanceof ForgeAuthenticationError) {
    return NextResponse.json(
      { ok: false, errorCode: error.code, error: error.message },
      { status: 401 },
    );
  }

  if (error instanceof ForgeRunControlError) {
    return NextResponse.json(
      { ok: false, errorCode: error.code, error: error.message },
      { status: error.status },
    );
  }

  return NextResponse.json(
    { ok: false, errorCode: "RUN_CONTROL_FAILED", error: "Unable to process the run request." },
    { status: 500 },
  );
}
