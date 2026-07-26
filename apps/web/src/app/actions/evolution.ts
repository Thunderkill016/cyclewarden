"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getEvolutionMutationAccess } from "@/lib/evolution-access";
import {
  resolveEvolutionProjectContext,
  runEvolutionCoreCli,
} from "@/lib/evolution-workspace";
import { evolutionActionRateLimit } from "@/lib/rate-limit";

const OperationSchema = z.enum(["start", "inspect", "assess", "research"]);
const ProjectIdSchema = z
  .string()
  .trim()
  .min(1, "Project ID is required")
  .max(64, "Project ID must contain at most 64 characters")
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/,
    "Project ID may contain only letters, numbers, dot, underscore and dash"
  );
const CycleIdSchema = z
  .string()
  .trim()
  .min(3, "Cycle ID must contain at least 3 characters")
  .max(128, "Cycle ID must contain at most 128 characters")
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/,
    "Cycle ID may contain only letters, numbers, dot, underscore, colon and dash"
  );
const ObjectiveSchema = z
  .string()
  .trim()
  .min(8, "Objective must be specific enough to evaluate")
  .max(500, "Objective must contain at most 500 characters");

export type EvolutionActionState = {
  error: string | null;
  ok?: boolean;
  message?: string;
  cycleId?: string;
  projectId?: string;
  operation?: z.infer<typeof OperationSchema>;
};

type CycleResult = {
  cycleId: string;
  stage: string;
};

type CommandResult = {
  cycle: CycleResult;
  outcome?: string;
};

function parseCycleId(formData: FormData): ReturnType<typeof CycleIdSchema.safeParse> {
  return CycleIdSchema.safeParse(String(formData.get("cycleId") ?? ""));
}

function validationError(result: {
  error: { issues: Array<{ message: string }> };
}): EvolutionActionState {
  return { error: result.error.issues[0]?.message ?? "Invalid workspace action" };
}

function trustedRepositoryAcknowledged(formData: FormData): boolean {
  return formData.get("trustedRepository") === "trusted";
}

export async function runEvolutionWorkspaceAction(
  _previous: EvolutionActionState,
  formData: FormData
): Promise<EvolutionActionState> {
  const operation = OperationSchema.safeParse(formData.get("operation"));
  if (!operation.success) return validationError(operation);

  const projectId = ProjectIdSchema.safeParse(formData.get("projectId"));
  if (!projectId.success) return validationError(projectId);

  const access = await getEvolutionMutationAccess();
  if (!access.allowed || !access.actor) return { error: access.reason };

  const limit = await evolutionActionRateLimit.check(
    `${access.actor}:${projectId.data}:${operation.data}`
  );
  if (!limit.success) {
    return { error: "Too many workspace actions. Wait for the current rate-limit window to reset." };
  }

  try {
    const registry = await resolveEvolutionProjectContext(projectId.data);
    const projectRoot = registry.selected.projectRoot;
    const root = registry.selected.stateRoot;

    if (operation.data === "start") {
      const objective = ObjectiveSchema.safeParse(formData.get("objective"));
      if (!objective.success) return validationError(objective);
      const requestedId = String(formData.get("cycleId") ?? "").trim();
      const cycleId = requestedId ? CycleIdSchema.safeParse(requestedId) : null;
      if (cycleId && !cycleId.success) return validationError(cycleId);

      const result = await runEvolutionCoreCli<CycleResult>([
        "start",
        "--root",
        root,
        "--project-root",
        projectRoot,
        ...(cycleId ? ["--id", cycleId.data] : []),
        "--objective",
        objective.data,
        "--autonomy",
        "A2",
        "--risk",
        "R1",
      ]);
      revalidatePath("/app/evolution");
      return {
        error: null,
        ok: true,
        cycleId: result.cycleId,
        projectId: projectId.data,
        operation: operation.data,
        message: "Cycle created. Repository inspection is the next legal action.",
      };
    }

    const cycleId = parseCycleId(formData);
    if (!cycleId.success) return validationError(cycleId);

    if (
      (operation.data === "assess" || operation.data === "research") &&
      !trustedRepositoryAcknowledged(formData)
    ) {
      return {
        error: "Confirm that the configured repository is trusted before running package scripts.",
      };
    }

    const actor = access.actor;
    let result: CommandResult;
    let message: string;

    if (operation.data === "inspect") {
      result = await runEvolutionCoreCli<CommandResult>([
        "inspect",
        cycleId.data,
        "--root",
        root,
        "--project-root",
        projectRoot,
        "--actor",
        `${actor}:inspector`,
      ]);
      message = "Repository evidence captured. Readiness assessment is now available.";
    } else if (operation.data === "assess") {
      result = await runEvolutionCoreCli<CommandResult>([
        "assess",
        cycleId.data,
        "--root",
        root,
        "--project-root",
        projectRoot,
        "--timeout-ms",
        "120000",
        "--max-output-bytes",
        "65536",
        "--actor",
        `${actor}:assessor`,
      ]);
      message = "Trusted checks completed in a temporary copy. The cycle is modeled.";
    } else {
      result = await runEvolutionCoreCli<CommandResult>([
        "research-repository",
        cycleId.data,
        "--root",
        root,
        "--project-root",
        projectRoot,
        "--timeout-ms",
        "120000",
        "--max-output-bytes",
        "65536",
        "--max-queries",
        "8",
        "--max-sources",
        "8",
        "--max-minutes",
        "15",
        "--actor",
        `${actor}:researcher`,
        "--reviewer",
        "cyclewarden-independent-research-reviewer",
      ]);
      message =
        result.outcome === "inconclusive"
          ? "Research stopped inconclusive. Review the persisted gaps and stopping reason."
          : "Research passed independent review and produced a reversible execution handoff.";
    }

    revalidatePath("/app/evolution");
    return {
      error: null,
      ok: true,
      cycleId: cycleId.data,
      projectId: projectId.data,
      operation: operation.data,
      message,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Workspace action failed" };
  }
}
