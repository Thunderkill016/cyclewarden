import { createHash, randomUUID } from "node:crypto";

import {
  acceptanceEvidenceSchema,
  approvalRequestSchema,
  isActiveRunState,
  publicationSchema,
  reviewDecisionSchema,
  runEventSchema,
  runSchema,
  taskSchema,
  validationResultSchema,
  type AcceptanceEvidence,
  type ApprovalRequest,
  type Publication,
  type ReviewDecision,
  type Run,
  type RunEvent,
  type Task,
  type ValidationResult,
} from "@cyclewarden/forge-domain";

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function requestHash(value: unknown): string {
  return createHash("sha256").update(stableSerialize(value)).digest("hex");
}

export class IdempotencyConflictError extends Error {
  readonly code = "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_INPUT" as const;

  constructor() {
    super("Idempotency key was reused with different input");
    this.name = "IdempotencyConflictError";
  }
}

interface IdempotencyEntry {
  requestHash: string;
  result: Promise<unknown>;
}

export class InMemoryForgeStore {
  private readonly tasks = new Map<string, Task>();
  private readonly taskWorkspaces = new Map<string, string>();
  private readonly runs = new Map<string, Run>();
  private readonly events = new Map<string, RunEvent[]>();
  private readonly approvals = new Map<string, ApprovalRequest>();
  private readonly validations = new Map<string, ValidationResult[]>();
  private readonly evidence = new Map<string, AcceptanceEvidence[]>();
  private readonly evidenceVersions = new Map<string, number>();
  private readonly reviews = new Map<string, ReviewDecision>();
  private readonly publications = new Map<string, Publication>();
  private readonly idempotency = new Map<string, IdempotencyEntry>();

  async executeIdempotent<T>(input: {
    workspaceId: string;
    operation: string;
    idempotencyKey: string;
    request: unknown;
    execute: () => Promise<T> | T;
  }): Promise<T> {
    const key = `${input.workspaceId}:${input.operation}:${input.idempotencyKey}`;
    const hash = requestHash(input.request);
    const existing = this.idempotency.get(key);
    if (existing) {
      if (existing.requestHash !== hash) {
        throw new IdempotencyConflictError();
      }
      return (await existing.result) as T;
    }

    const result = Promise.resolve().then(input.execute);
    this.idempotency.set(key, { requestHash: hash, result });
    try {
      return await result;
    } catch (error) {
      this.idempotency.delete(key);
      throw error;
    }
  }

  saveTask(workspaceId: string, task: Task): Task {
    const parsed = taskSchema.parse(task);
    this.tasks.set(parsed.id, parsed);
    this.taskWorkspaces.set(parsed.id, workspaceId);
    return parsed;
  }

  getTask(taskId: string): Task {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    return task;
  }

  getTaskWorkspace(taskId: string): string {
    const workspaceId = this.taskWorkspaces.get(taskId);
    if (!workspaceId) throw new Error(`Task workspace not found: ${taskId}`);
    return workspaceId;
  }

  saveRun(run: Run): Run {
    const parsed = runSchema.parse(run);
    this.runs.set(parsed.id, parsed);
    return parsed;
  }

  getRun(runId: string): Run {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    return run;
  }

  listRunsForTask(taskId: string): Run[] {
    return [...this.runs.values()]
      .filter((run) => run.taskId === taskId)
      .sort((left, right) => left.iteration - right.iteration);
  }

  listActiveRuns(workspaceId: string): Run[] {
    return [...this.runs.values()].filter(
      (run) => run.workspaceId === workspaceId && isActiveRunState(run.state),
    );
  }

  appendEvent(input: {
    runId: string;
    type: string;
    payload: unknown;
    actorType?: "user" | "system" | "agent" | "provider";
    actorId?: string | null;
    correlationId?: string | null;
  }): RunEvent {
    const current = this.events.get(input.runId) ?? [];
    const event = runEventSchema.parse({
      id: randomUUID(),
      runId: input.runId,
      sequence: current.length + 1,
      type: input.type,
      actorType: input.actorType ?? "system",
      actorId: input.actorId ?? null,
      correlationId: input.correlationId ?? null,
      payload: input.payload,
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
    });
    this.events.set(input.runId, [...current, event]);
    return event;
  }

  getEvents(runId: string): RunEvent[] {
    return [...(this.events.get(runId) ?? [])];
  }

  saveApproval(approval: ApprovalRequest): ApprovalRequest {
    const parsed = approvalRequestSchema.parse(approval);
    this.approvals.set(parsed.id, parsed);
    return parsed;
  }

  getApproval(approvalId: string): ApprovalRequest {
    const approval = this.approvals.get(approvalId);
    if (!approval) throw new Error(`Approval not found: ${approvalId}`);
    return approval;
  }

  saveValidation(result: ValidationResult): ValidationResult {
    const parsed = validationResultSchema.parse(result);
    const current = this.validations.get(parsed.runId) ?? [];
    this.validations.set(parsed.runId, [...current, parsed]);
    this.bumpEvidenceVersion(parsed.runId);
    return parsed;
  }

  getValidations(runId: string): ValidationResult[] {
    return [...(this.validations.get(runId) ?? [])];
  }

  saveEvidence(item: AcceptanceEvidence): AcceptanceEvidence {
    const parsed = acceptanceEvidenceSchema.parse(item);
    const current = this.evidence.get(parsed.runId) ?? [];
    this.evidence.set(parsed.runId, [...current, parsed]);
    this.bumpEvidenceVersion(parsed.runId);
    return parsed;
  }

  getEvidence(runId: string): AcceptanceEvidence[] {
    return [...(this.evidence.get(runId) ?? [])];
  }

  getEvidenceVersion(runId: string): number {
    return this.evidenceVersions.get(runId) ?? 0;
  }

  saveReview(review: ReviewDecision): ReviewDecision {
    const parsed = reviewDecisionSchema.parse(review);
    if (this.reviews.has(parsed.runId)) {
      throw new Error(`Review already resolved for run: ${parsed.runId}`);
    }
    this.reviews.set(parsed.runId, parsed);
    return parsed;
  }

  getReview(runId: string): ReviewDecision | undefined {
    return this.reviews.get(runId);
  }

  savePublication(publication: Publication): Publication {
    const parsed = publicationSchema.parse(publication);
    this.publications.set(parsed.runId, parsed);
    return parsed;
  }

  getPublication(runId: string): Publication | undefined {
    return this.publications.get(runId);
  }

  private bumpEvidenceVersion(runId: string): void {
    this.evidenceVersions.set(runId, this.getEvidenceVersion(runId) + 1);
  }
}
