import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const timestampSchema = z.string().datetime();
export const localeSchema = z.enum(["vi", "en"]);
export const evidenceRequirementSchema = z.enum([
  "constitution",
  "task_mandatory",
  "advisory",
]);

export const stableErrorCodeSchema = z.enum([
  "ACTIVE_RUN_EXISTS",
  "ILLEGAL_RUN_TRANSITION",
  "INVALID_EVIDENCE_WAIVER",
  "MANDATORY_EVIDENCE_MISSING",
  "MANDATORY_VALIDATION_FAILED",
  "STALE_EVIDENCE_SNAPSHOT",
  "REVIEW_NOT_APPROVED",
  "PROVIDER_UNAVAILABLE",
  "UNAUTHORIZED",
]);

export const taskStatusSchema = z.enum([
  "draft",
  "ready",
  "running",
  "review",
  "completed",
  "cancelled",
]);

export const taskSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  createdBy: uuidSchema,
  title: z.string().trim().min(1).max(200),
  originalInstruction: z.string().min(1),
  instructionLanguage: localeSchema,
  normalizedObjective: z.string().min(1),
  scope: z.array(z.string().min(1)),
  acceptanceCriteria: z.array(
    z.object({
      key: z.string().min(1),
      description: z.string().min(1),
      requirement: evidenceRequirementSchema,
    }),
  ),
  constraints: z.array(z.string().min(1)),
  technicalOutputLanguage: localeSchema,
  status: taskStatusSchema,
  version: z.number().int().nonnegative(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const runStateSchema = z.enum([
  "draft",
  "queued",
  "provisioning",
  "running",
  "awaiting_approval",
  "cancelling",
  "validating",
  "awaiting_review",
  "publishing",
  "completed",
  "failed",
  "cancelled",
  "expired",
]);

export const reviewOutcomeSchema = z.enum([
  "approved",
  "rejected",
  "cancelled",
]);

export const runSchema = z.object({
  id: uuidSchema,
  taskId: uuidSchema,
  workspaceId: uuidSchema,
  iteration: z.number().int().positive(),
  state: runStateSchema,
  reviewOutcome: reviewOutcomeSchema.nullable(),
  baseBranch: z.string().min(1),
  baseCommitSha: z.string().min(1).nullable(),
  workingBranch: z.string().min(1).nullable(),
  agentProvider: z.string().min(1),
  sandboxProvider: z.string().min(1),
  budgetPolicy: z.record(z.string(), z.unknown()),
  permissionPolicy: z.record(z.string(), z.unknown()),
  startedAt: timestampSchema.nullable(),
  finishedAt: timestampSchema.nullable(),
  version: z.number().int().nonnegative(),
  failureCode: stableErrorCodeSchema.or(z.string().min(1)).nullable(),
  failureSummary: z.string().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const runEventSchema = z.object({
  id: uuidSchema,
  runId: uuidSchema,
  sequence: z.number().int().nonnegative(),
  type: z.string().min(1),
  actorType: z.enum(["user", "system", "agent", "provider"]),
  actorId: z.string().nullable(),
  correlationId: z.string().nullable(),
  payload: z.unknown(),
  schemaVersion: z.number().int().positive(),
  createdAt: timestampSchema,
});

export const approvalStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "expired",
  "cancelled",
]);

export const riskLevelSchema = z.enum(["low", "medium", "high", "critical"]);

export const approvalRequestSchema = z.object({
  id: uuidSchema,
  runId: uuidSchema,
  requestKey: z.string().min(1),
  actionType: z.string().min(1),
  summary: z.string().min(1),
  scope: z.record(z.string(), z.unknown()),
  riskLevel: riskLevelSchema,
  status: approvalStatusSchema,
  requestedAt: timestampSchema,
  expiresAt: timestampSchema.nullable(),
  resolvedBy: uuidSchema.nullable(),
  resolvedAt: timestampSchema.nullable(),
  reason: z.string().nullable(),
  version: z.number().int().nonnegative(),
});

export const validationStatusSchema = z.enum([
  "pending",
  "running",
  "passed",
  "failed",
  "skipped",
]);

export const validationResultSchema = z.object({
  id: uuidSchema,
  runId: uuidSchema,
  kind: z.enum(["build", "test", "lint", "typecheck", "custom"]),
  command: z.string().min(1),
  requirement: evidenceRequirementSchema,
  status: validationStatusSchema,
  exitCode: z.number().int().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  outputSummary: z.string().nullable(),
  artifactRef: z.string().nullable(),
});

export const evidenceStatusSchema = z.enum([
  "satisfied",
  "not_satisfied",
  "inconclusive",
  "waived",
]);

export const acceptanceEvidenceSchema = z.object({
  id: uuidSchema,
  runId: uuidSchema,
  criterionKey: z.string().min(1),
  requirement: evidenceRequirementSchema,
  status: evidenceStatusSchema,
  evidenceType: z.string().min(1),
  evidenceRef: z.string().nullable(),
  explanation: z.string().min(1),
  waivedBy: uuidSchema.nullable(),
  waivedReason: z.string().min(1).nullable(),
  waivedAt: timestampSchema.nullable(),
});

export const reviewDecisionSchema = z.object({
  id: uuidSchema,
  runId: uuidSchema,
  decision: reviewOutcomeSchema,
  decidedBy: uuidSchema,
  rationale: z.string().nullable(),
  evidenceSnapshotVersion: z.number().int().nonnegative(),
  evidenceSnapshot: z.unknown(),
  advisoryWaivers: z.array(
    z.object({
      evidenceKey: z.string().min(1),
      reason: z.string().min(1),
      scope: z.string().min(1),
      waivedAt: timestampSchema,
    }),
  ),
  createdAt: timestampSchema,
});

export const publicationSchema = z.object({
  id: uuidSchema,
  runId: uuidSchema,
  provider: z.string().min(1),
  externalRepositoryId: z.string().min(1),
  branchName: z.string().min(1),
  commitSha: z.string().min(1),
  changeRequestId: z.string().nullable(),
  changeRequestUrl: z.string().url().nullable(),
  status: z.enum(["pending", "pushed", "pr_created", "failed"]),
  failureCode: z.string().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type Locale = z.infer<typeof localeSchema>;
export type EvidenceRequirement = z.infer<typeof evidenceRequirementSchema>;
export type StableErrorCode = z.infer<typeof stableErrorCodeSchema>;
export type Task = z.infer<typeof taskSchema>;
export type RunState = z.infer<typeof runStateSchema>;
export type ReviewOutcome = z.infer<typeof reviewOutcomeSchema>;
export type Run = z.infer<typeof runSchema>;
export type RunEvent = z.infer<typeof runEventSchema>;
export type ApprovalRequest = z.infer<typeof approvalRequestSchema>;
export type RiskLevel = z.infer<typeof riskLevelSchema>;
export type ValidationResult = z.infer<typeof validationResultSchema>;
export type AcceptanceEvidence = z.infer<typeof acceptanceEvidenceSchema>;
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;
export type Publication = z.infer<typeof publicationSchema>;
