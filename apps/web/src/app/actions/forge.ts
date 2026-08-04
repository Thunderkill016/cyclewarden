"use server";

import type { ForgeStartActionState } from "@/lib/forge/action-state";
import { initialForgeStartActionState } from "@/lib/forge/action-state";
import { getForgeActor } from "@/lib/forge/actor";
import {
  ForgeStartRunError,
  startGovernedForgeRun,
} from "@/lib/forge/start-run-service";
import { forgeStartRunInputSchema } from "@/lib/forge/start-run-input";

export async function startForgeRunAction(
  _previous: ForgeStartActionState,
  formData: FormData,
): Promise<ForgeStartActionState> {
  const parsed = forgeStartRunInputSchema.safeParse({
    repositoryId: formData.get("repositoryId"),
    instruction: formData.get("instruction"),
    interfaceLocale: formData.get("interfaceLocale"),
    instructionLanguage: formData.get("instructionLanguage"),
    technicalOutputLanguage: formData.get("technicalOutputLanguage"),
    baseBranch: formData.get("baseBranch"),
    agentProvider: formData.get("agentProvider"),
    budgetUsd: formData.get("budgetUsd"),
    networkPolicy: formData.get("networkPolicy"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) {
    return {
      ...initialForgeStartActionState,
      errorCode: "INVALID_TASK",
      error: parsed.error.issues[0]?.message ?? "Invalid run request",
    };
  }

  try {
    const actor = await getForgeActor();
    const result = await startGovernedForgeRun({
      actor,
      request: parsed.data,
    });
    return {
      ok: true,
      error: null,
      errorCode: null,
      runId: result.runId,
      taskId: result.taskId,
      repository: result.repository,
      demo: result.demo,
    };
  } catch (error) {
    if (error instanceof ForgeStartRunError) {
      return {
        ...initialForgeStartActionState,
        errorCode: error.code,
        error: error.message,
      };
    }
    console.error("Unexpected Forge start failure", error);
    return {
      ...initialForgeStartActionState,
      errorCode: "START_FAILED",
      error: error instanceof Error ? error.message : "Unable to start the run",
    };
  }
}
