import { randomUUID } from "node:crypto";

import { taskSchema, type EvidenceRequirement, type Task } from "@cyclewarden/forge-domain";

import type { WorkspaceAuthorizer } from "../auth/workspace-authorizer.js";
import type { InMemoryForgeStore } from "../store/in-memory-store.js";

export interface NormalizedTaskInput {
  title: string;
  normalizedObjective: string;
  scope: string[];
  acceptanceCriteria: Array<{
    key: string;
    description: string;
    requirement: EvidenceRequirement;
  }>;
  constraints: string[];
}

export interface TaskNormalizer {
  normalize(input: {
    instruction: string;
    instructionLanguage: "vi" | "en";
    technicalOutputLanguage: "vi" | "en";
  }): Promise<NormalizedTaskInput>;
}

export class DeterministicTaskNormalizer implements TaskNormalizer {
  async normalize(input: {
    instruction: string;
    instructionLanguage: "vi" | "en";
    technicalOutputLanguage: "vi" | "en";
  }): Promise<NormalizedTaskInput> {
    const firstLine = input.instruction.split(/\r?\n/, 1)[0]?.trim();
    return {
      title: firstLine?.slice(0, 120) || "Untitled Forge task",
      normalizedObjective: input.instruction.trim(),
      scope: ["repository"],
      acceptanceCriteria: [
        {
          key: "requested-change",
          description: "The requested change is implemented and validated.",
          requirement: "task_mandatory",
        },
      ],
      constraints: [
        `Instruction language: ${input.instructionLanguage}`,
        `Technical output language: ${input.technicalOutputLanguage}`,
      ],
    };
  }
}

export async function createTask(input: {
  store: InMemoryForgeStore;
  authorizer: WorkspaceAuthorizer;
  normalizer: TaskNormalizer;
  workspaceId: string;
  projectId: string;
  userId: string;
  instruction: string;
  instructionLanguage: "vi" | "en";
  technicalOutputLanguage: "vi" | "en";
}): Promise<Task> {
  await input.authorizer.assertCanAccess({
    workspaceId: input.workspaceId,
    userId: input.userId,
  });

  const normalized = await input.normalizer.normalize({
    instruction: input.instruction,
    instructionLanguage: input.instructionLanguage,
    technicalOutputLanguage: input.technicalOutputLanguage,
  });
  const now = new Date().toISOString();
  const task = taskSchema.parse({
    id: randomUUID(),
    projectId: input.projectId,
    createdBy: input.userId,
    title: normalized.title,
    originalInstruction: input.instruction,
    instructionLanguage: input.instructionLanguage,
    normalizedObjective: normalized.normalizedObjective,
    scope: normalized.scope,
    acceptanceCriteria: normalized.acceptanceCriteria,
    constraints: normalized.constraints,
    technicalOutputLanguage: input.technicalOutputLanguage,
    status: "ready",
    version: 0,
    createdAt: now,
    updatedAt: now,
  });

  return input.store.saveTask(input.workspaceId, task);
}
