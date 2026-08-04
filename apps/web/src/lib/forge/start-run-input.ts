import { z } from "zod";

export const forgeStartRunInputSchema = z.object({
  repositoryId: z.string().trim().min(1),
  instruction: z.string().trim().min(10, "Describe the task in at least 10 characters").max(10_000),
  instructionLanguage: z.enum(["vi", "en"]),
  technicalOutputLanguage: z.enum(["vi", "en"]),
  baseBranch: z.string().trim().min(1).max(200),
  agentProvider: z.literal("codex"),
  budgetUsd: z.coerce.number().positive().max(100),
  networkPolicy: z.enum(["deny-by-default", "package-registries"]),
  idempotencyKey: z.string().uuid(),
});

export type ForgeStartRunInput = z.infer<typeof forgeStartRunInputSchema>;
