import { createHash, randomUUID } from "node:crypto";

import {
  evaluateCompletionGate,
  redactSecrets,
  type AcceptanceEvidence,
  type ReviewDecision,
  type ValidationResult,
} from "@cyclewarden/forge-domain";
import type { Sql } from "postgres";

import { createSql } from "@/lib/db";
import type { ForgeActor } from "./actor";

export type ForgeReviewRunState =
  | "queued"
  | "provisioning"
  | "running"
  | "awaiting_approval"
  | "cancelling"
  | "validating"
  | "awaiting_review"
  | "publishing"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export interface ForgeValidationView {
  id: string;
  kind: "build" | "test" | "lint" | "typecheck" | "custom";
  command: string;
  requirement: "constitution" | "task_mandatory" | "advisory";
  status: "pending" | "running" | "passed" | "failed" | "skipped";
  exitCode: number | null;
  durationMs: number | null;
  outputSummary: string | null;
  artifactRef: string | null;
}

export interface ForgeEvidenceView {
  id: string;
  criterionKey: string;
  requirement: "constitution" | "task_mandatory" | "advisory";
  status: "satisfied" | "not_satisfied" | "inconclusive" | "waived";
  evidenceType: string;
  evidenceRef: string | null;
  explanation: string;
  waivedBy: string | null;
  waivedReason: string | null;
  waivedAt: string | null;
}

export interface ForgeChangedFileView {
  path: string;
  status: "added" | "modified" | "deleted";
  additions: number;
  deletions: number;
  scope: "expected" | "unexpected";
}

export interface ForgeChangeSetView {
  id: string;
  snapshotVersion: number;
  baseCommitSha: string;
  headCommitSha: string;
  changedFiles: ForgeChangedFileView[];
  unifiedDiff: string;
  diffDigest: string;
  containsBinary: boolean;
  containsSecretFinding: boolean;
  agentSummary: string;
  unresolvedRisks: string[];
  usageEstimate: {
    modelTokens: number;
    sandboxSeconds: number;
    estimatedUsd: number;
  };
  generatedAt: string;
}

export interface ForgeReviewDecisionView {
  id: string;
  decision: "approved" | "rejected" | "cancelled";
  decidedBy: string;
  rationale: string | null;
  evidenceSnapshotVersion: number;
  evidenceSnapshot: unknown;
  advisoryWaivers: unknown[];
  createdAt: string;
}

export interface ForgePublicationView {
  id: string;
  provider: string;
  externalRepositoryId: string;
  branchName: string;
  commitSha: string;
  changeRequestId: string | null;
  changeRequestUrl: string | null;
  status: "pending" | "pushed" | "pr_created" | "failed";
  failureCode: string | null;
  evidenceSnapshotVersion: number | null;
  diffDigest: string | null;
  unresolvedRisks: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ForgeEvidenceReviewView {
  run: {
    id: string;
    taskId: string;
    workspaceId: string;
    iteration: number;
    state: ForgeReviewRunState;
    reviewOutcome: "approved" | "rejected" | "cancelled" | null;
    version: number;
    eventSequence: number;
    baseBranch: string;
  };
  task: {
    title: string;
    originalInstruction: string;
    acceptanceCriteria: Array<{
      key: string;
      description: string;
      requirement: "constitution" | "task_mandatory" | "advisory";
    }>;
  };
  project: {
    name: string;
    provider: string;
    externalRepositoryId: string;
    repository: string;
  };
  validations: ForgeValidationView[];
  evidence: ForgeEvidenceView[];
  changeSet: ForgeChangeSetView | null;
  review: ForgeReviewDecisionView | null;
  publication: ForgePublicationView | null;
  gate: {
    eligibleForApproval: boolean;
    eligibleForPublication: boolean;
    blockers: Array<{ code: string; key: string; message: string }>;
  };
}

export interface ForgeReviewMutationResult {
  runId: string;
  state: ForgeReviewRunState;
  version: number;
  eventSequence: number;
  snapshotVersion: number | null;
  review?: ForgeReviewDecisionView;
  publication?: ForgePublicationView;
  nextRunId?: string;
  replayed?: boolean;
}

export class ForgeEvidenceReviewError extends Error {
  constructor(
    readonly code:
      | "DATABASE_UNAVAILABLE"
      | "INVALID_INPUT"
      | "NOT_FOUND_OR_UNAUTHORIZED"
      | "RUN_NOT_REVIEWABLE"
      | "EVIDENCE_BLOCKED"
      | "STALE_EVIDENCE_SNAPSHOT"
      | "REVIEW_NOT_APPROVED"
      | "IDEMPOTENCY_KEY_CONFLICT"
      | "REQUEST_IN_PROGRESS"
      | "PUBLICATION_CONFLICT"
      | "PROVIDER_UNAVAILABLE",
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ForgeEvidenceReviewError";
  }
}

type PostgresRows = readonly (object | undefined)[];
type SqlTemplateParameters =
  Parameters<Sql> extends [TemplateStringsArray, ...infer Rest] ? Rest : never;
type PostgresTimestamp = Date | string;

interface QueryableSql {
  <T extends PostgresRows = Record<string, unknown>[]>(
    strings: TemplateStringsArray,
    ...parameters: SqlTemplateParameters
  ): Promise<T>;
}

interface AuthorizedReviewRunRow {
  id: string;
  task_id: string;
  workspace_id: string;
  iteration: number;
  state: ForgeReviewRunState;
  review_outcome: "approved" | "rejected" | "cancelled" | null;
  version: number;
  event_sequence: string;
  base_branch: string;
  agent_provider: string;
  sandbox_provider: string;
  budget_policy: unknown;
  permission_policy: unknown;
  title: string;
  original_instruction: string;
  acceptance_criteria: unknown;
  project_id: string;
  project_name: string;
  source_provider: string;
  external_repository_id: string;
  namespace: string;
  repository_name: string;
}

interface ValidationRow {
  id: string;
  kind: ForgeValidationView["kind"];
  command: string;
  requirement: ForgeValidationView["requirement"];
  status: ForgeValidationView["status"];
  exit_code: number | null;
  duration_ms: number | null;
  output_summary: string | null;
  artifact_ref: string | null;
}

interface EvidenceRow {
  id: string;
  criterion_key: string;
  requirement: ForgeEvidenceView["requirement"];
  status: ForgeEvidenceView["status"];
  evidence_type: string;
  evidence_ref: string | null;
  explanation: string;
  waived_by: string | null;
  waived_reason: string | null;
  waived_at: PostgresTimestamp | null;
}

interface ChangeSetRow {
  id: string;
  snapshot_version: number;
  base_commit_sha: string;
  head_commit_sha: string;
  changed_files: ForgeChangedFileView[];
  unified_diff: string;
  diff_digest: string;
  contains_binary: boolean;
  contains_secret_finding: boolean;
  agent_summary: string;
  unresolved_risks: string[];
  usage_estimate: ForgeChangeSetView["usageEstimate"];
  generated_at: PostgresTimestamp;
}

interface ReviewRow {
  id: string;
  decision: ForgeReviewDecisionView["decision"];
  decided_by: string;
  rationale: string | null;
  evidence_snapshot_version: number;
  evidence_snapshot: unknown;
  advisory_waivers: unknown[];
  created_at: PostgresTimestamp;
}

interface PublicationRow {
  id: string;
  provider: string;
  external_repository_id: string;
  branch_name: string;
  commit_sha: string;
  change_request_id: string | null;
  change_request_url: string | null;
  status: ForgePublicationView["status"];
  failure_code: string | null;
  evidence_snapshot_version: number | null;
  diff_digest: string | null;
  unresolved_risks: string[];
  created_at: PostgresTimestamp;
  updated_at: PostgresTimestamp;
}

interface IdempotencyRow {
  request_hash: string;
  status: "pending" | "completed";
  response: ForgeReviewMutationResult | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIXTURE_COMPLETABLE_STATES = new Set<ForgeReviewRunState>([
  "queued",
  "provisioning",
  "running",
  "validating",
]);
const ACTIVE_STATES = [
  "queued",
  "provisioning",
  "running",
  "awaiting_approval",
  "cancelling",
  "validating",
  "awaiting_review",
  "publishing",
] as const;

function requireSql(): Sql {
  const sql = createSql();
  if (!sql) {
    throw new ForgeEvidenceReviewError(
      "DATABASE_UNAVAILABLE",
      "Durable evidence review requires PostgreSQL.",
      503,
    );
  }
  return sql;
}

function assertUuid(value: string, label: string): void {
  if (!UUID.test(value)) {
    throw new ForgeEvidenceReviewError("INVALID_INPUT", `${label} is invalid.`, 400);
  }
}

function assertIdempotencyKey(value: string): void {
  if (!value || value.length > 200) {
    throw new ForgeEvidenceReviewError(
      "INVALID_INPUT",
      "Idempotency key is invalid.",
      400,
    );
  }
}

function timestamp(value: PostgresTimestamp): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function iso(value: PostgresTimestamp | null): string | null {
  return value === null ? null : timestamp(value);
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function requestHash(value: unknown): string {
  return sha256(stableSerialize(value));
}

function gitSha(seed: string): string {
  return sha256(seed).slice(0, 40);
}

function normalizeCriteria(value: unknown): ForgeEvidenceReviewView["task"]["acceptanceCriteria"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const key = typeof record.key === "string" ? record.key : null;
    const description = typeof record.description === "string" ? record.description : null;
    const requirement = record.requirement;
    if (
      !key ||
      !description ||
      (requirement !== "constitution" &&
        requirement !== "task_mandatory" &&
        requirement !== "advisory")
    ) {
      return [];
    }
    return [{ key, description, requirement }];
  });
}

function mapValidation(row: ValidationRow): ForgeValidationView {
  return {
    id: row.id,
    kind: row.kind,
    command: row.command,
    requirement: row.requirement,
    status: row.status,
    exitCode: row.exit_code,
    durationMs: row.duration_ms,
    outputSummary: row.output_summary,
    artifactRef: row.artifact_ref,
  };
}

function mapEvidence(row: EvidenceRow): ForgeEvidenceView {
  return {
    id: row.id,
    criterionKey: row.criterion_key,
    requirement: row.requirement,
    status: row.status,
    evidenceType: row.evidence_type,
    evidenceRef: row.evidence_ref,
    explanation: row.explanation,
    waivedBy: row.waived_by,
    waivedReason: row.waived_reason,
    waivedAt: iso(row.waived_at),
  };
}

function mapChangeSet(row: ChangeSetRow): ForgeChangeSetView {
  return {
    id: row.id,
    snapshotVersion: row.snapshot_version,
    baseCommitSha: row.base_commit_sha,
    headCommitSha: row.head_commit_sha,
    changedFiles: row.changed_files,
    unifiedDiff: row.unified_diff,
    diffDigest: row.diff_digest,
    containsBinary: row.contains_binary,
    containsSecretFinding: row.contains_secret_finding,
    agentSummary: row.agent_summary,
    unresolvedRisks: row.unresolved_risks,
    usageEstimate: row.usage_estimate,
    generatedAt: timestamp(row.generated_at),
  };
}

function mapReview(row: ReviewRow): ForgeReviewDecisionView {
  return {
    id: row.id,
    decision: row.decision,
    decidedBy: row.decided_by,
    rationale: row.rationale,
    evidenceSnapshotVersion: row.evidence_snapshot_version,
    evidenceSnapshot: row.evidence_snapshot,
    advisoryWaivers: row.advisory_waivers,
    createdAt: timestamp(row.created_at),
  };
}

function mapPublication(row: PublicationRow): ForgePublicationView {
  return {
    id: row.id,
    provider: row.provider,
    externalRepositoryId: row.external_repository_id,
    branchName: row.branch_name,
    commitSha: row.commit_sha,
    changeRequestId: row.change_request_id,
    changeRequestUrl: row.change_request_url,
    status: row.status,
    failureCode: row.failure_code,
    evidenceSnapshotVersion: row.evidence_snapshot_version,
    diffDigest: row.diff_digest,
    unresolvedRisks: row.unresolved_risks,
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  };
}

async function getAuthorizedRun(
  sql: QueryableSql,
  actor: ForgeActor,
  runId: string,
  lock = false,
): Promise<AuthorizedReviewRunRow> {
  assertUuid(runId, "Run ID");
  const rows = await sql<AuthorizedReviewRunRow[]>`
    SELECT r.id, r.task_id, r.workspace_id, r.iteration, r.state,
           r.review_outcome, r.version, r.event_sequence, r.base_branch,
           r.agent_provider, r.sandbox_provider, r.budget_policy,
           r.permission_policy, t.title, t.original_instruction,
           t.acceptance_criteria, t.project_id,
           p.name AS project_name, p.source_provider,
           p.external_repository_id, p.namespace, p.repository_name
    FROM forge_runs r
    JOIN forge_tasks t ON t.id = r.task_id
    JOIN forge_projects p ON p.id = t.project_id
    JOIN forge_workspace_members m ON m.workspace_id = r.workspace_id
    WHERE r.id = ${runId}::uuid
      AND m.user_id = ${actor.id}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) {
    throw new ForgeEvidenceReviewError(
      "NOT_FOUND_OR_UNAUTHORIZED",
      "Run was not found.",
      404,
    );
  }
  if (lock) {
    const locked = await sql<AuthorizedReviewRunRow[]>`
      SELECT r.id, r.task_id, r.workspace_id, r.iteration, r.state,
             r.review_outcome, r.version, r.event_sequence, r.base_branch,
             r.agent_provider, r.sandbox_provider, r.budget_policy,
             r.permission_policy, t.title, t.original_instruction,
             t.acceptance_criteria, t.project_id,
             p.name AS project_name, p.source_provider,
             p.external_repository_id, p.namespace, p.repository_name
      FROM forge_runs r
      JOIN forge_tasks t ON t.id = r.task_id
      JOIN forge_projects p ON p.id = t.project_id
      JOIN forge_workspace_members m ON m.workspace_id = r.workspace_id
      WHERE r.id = ${runId}::uuid
        AND m.user_id = ${actor.id}
      FOR UPDATE OF r
    `;
    return locked[0] ?? row;
  }
  return row;
}

async function readValidations(
  sql: QueryableSql,
  workspaceId: string,
  runId: string,
): Promise<ForgeValidationView[]> {
  const rows = await sql<ValidationRow[]>`
    SELECT id, kind, command, requirement, status, exit_code,
           duration_ms, output_summary, artifact_ref
    FROM forge_validation_results
    WHERE workspace_id = ${workspaceId}::uuid
      AND run_id = ${runId}::uuid
    ORDER BY kind ASC, id ASC
  `;
  return rows.map(mapValidation);
}

async function readEvidence(
  sql: QueryableSql,
  workspaceId: string,
  runId: string,
): Promise<ForgeEvidenceView[]> {
  const rows = await sql<EvidenceRow[]>`
    SELECT id, criterion_key, requirement, status, evidence_type,
           evidence_ref, explanation, waived_by, waived_reason, waived_at
    FROM forge_acceptance_evidence
    WHERE workspace_id = ${workspaceId}::uuid
      AND run_id = ${runId}::uuid
    ORDER BY criterion_key ASC
  `;
  return rows.map(mapEvidence);
}

async function readChangeSet(
  sql: QueryableSql,
  workspaceId: string,
  runId: string,
): Promise<ForgeChangeSetView | null> {
  const rows = await sql<ChangeSetRow[]>`
    SELECT id, snapshot_version, base_commit_sha, head_commit_sha,
           changed_files, unified_diff, diff_digest, contains_binary,
           contains_secret_finding, agent_summary, unresolved_risks,
           usage_estimate, generated_at
    FROM forge_change_sets
    WHERE workspace_id = ${workspaceId}::uuid
      AND run_id = ${runId}::uuid
    LIMIT 1
  `;
  return rows[0] ? mapChangeSet(rows[0]) : null;
}

async function readReview(
  sql: QueryableSql,
  workspaceId: string,
  runId: string,
): Promise<ForgeReviewDecisionView | null> {
  const rows = await sql<ReviewRow[]>`
    SELECT id, decision, decided_by, rationale,
           evidence_snapshot_version, evidence_snapshot,
           advisory_waivers, created_at
    FROM forge_review_decisions
    WHERE workspace_id = ${workspaceId}::uuid
      AND run_id = ${runId}::uuid
    LIMIT 1
  `;
  return rows[0] ? mapReview(rows[0]) : null;
}

async function readPublication(
  sql: QueryableSql,
  workspaceId: string,
  runId: string,
): Promise<ForgePublicationView | null> {
  const rows = await sql<PublicationRow[]>`
    SELECT id, provider, external_repository_id, branch_name,
           commit_sha, change_request_id, change_request_url,
           status, failure_code, evidence_snapshot_version,
           diff_digest, unresolved_risks, created_at, updated_at
    FROM forge_publications
    WHERE workspace_id = ${workspaceId}::uuid
      AND run_id = ${runId}::uuid
    LIMIT 1
  `;
  return rows[0] ? mapPublication(rows[0]) : null;
}

function toDomainValidation(item: ForgeValidationView): ValidationResult {
  return {
    id: item.id,
    runId: "00000000-0000-4000-8000-000000000000",
    kind: item.kind,
    command: item.command,
    requirement: item.requirement,
    status: item.status,
    exitCode: item.exitCode,
    durationMs: item.durationMs,
    outputSummary: item.outputSummary,
    artifactRef: item.artifactRef,
  };
}

function toDomainEvidence(item: ForgeEvidenceView): AcceptanceEvidence {
  return {
    id: item.id,
    runId: "00000000-0000-4000-8000-000000000000",
    criterionKey: item.criterionKey,
    requirement: item.requirement,
    status: item.status,
    evidenceType: item.evidenceType,
    evidenceRef: item.evidenceRef,
    explanation: item.explanation,
    waivedBy: item.waivedBy,
    waivedReason: item.waivedReason,
    waivedAt: item.waivedAt,
  };
}

function toDomainReview(item: ForgeReviewDecisionView): ReviewDecision {
  return {
    id: item.id,
    runId: "00000000-0000-4000-8000-000000000000",
    decision: item.decision,
    decidedBy: item.decidedBy,
    rationale: item.rationale,
    evidenceSnapshotVersion: item.evidenceSnapshotVersion,
    evidenceSnapshot: item.evidenceSnapshot,
    advisoryWaivers: item.advisoryWaivers as ReviewDecision["advisoryWaivers"],
    createdAt: item.createdAt,
  };
}

function evaluateViewGate(input: {
  validations: ForgeValidationView[];
  evidence: ForgeEvidenceView[];
  changeSet: ForgeChangeSetView | null;
  review: ForgeReviewDecisionView | null;
}) {
  if (!input.changeSet) {
    return {
      eligibleForApproval: false,
      eligibleForPublication: false,
      blockers: [
        {
          code: "MANDATORY_EVIDENCE_MISSING",
          key: "change-set",
          message: "A redacted change set has not been generated.",
        },
      ],
    };
  }
  const result = evaluateCompletionGate({
    currentSnapshotVersion: input.changeSet.snapshotVersion,
    validations: input.validations.map(toDomainValidation),
    acceptanceEvidence: input.evidence.map(toDomainEvidence),
    ...(input.review ? { reviewDecision: toDomainReview(input.review) } : {}),
  });
  if (input.changeSet.containsBinary) {
    result.blockers.push({
      code: "MANDATORY_EVIDENCE_MISSING",
      key: "binary-diff",
      message: "Binary changes require a separate inspectable artifact.",
    });
  }
  if (input.changeSet.containsSecretFinding) {
    result.blockers.push({
      code: "MANDATORY_EVIDENCE_MISSING",
      key: "secret-scan",
      message: "The diff contained a secret-like value and cannot be approved.",
    });
  }
  return {
    eligibleForApproval: result.eligibleForApproval && result.blockers.length === 0,
    eligibleForPublication:
      result.eligibleForPublication && result.blockers.length === 0,
    blockers: result.blockers,
  };
}

export async function getForgeEvidenceReviewView(
  actor: ForgeActor,
  runId: string,
): Promise<ForgeEvidenceReviewView> {
  const sql = requireSql();
  const run = await getAuthorizedRun(sql, actor, runId);
  const [validations, evidence, changeSet, review, publication] = await Promise.all([
    readValidations(sql, run.workspace_id, runId),
    readEvidence(sql, run.workspace_id, runId),
    readChangeSet(sql, run.workspace_id, runId),
    readReview(sql, run.workspace_id, runId),
    readPublication(sql, run.workspace_id, runId),
  ]);
  return {
    run: {
      id: run.id,
      taskId: run.task_id,
      workspaceId: run.workspace_id,
      iteration: run.iteration,
      state: run.state,
      reviewOutcome: run.review_outcome,
      version: run.version,
      eventSequence: Number(run.event_sequence),
      baseBranch: run.base_branch,
    },
    task: {
      title: run.title,
      originalInstruction: run.original_instruction,
      acceptanceCriteria: normalizeCriteria(run.acceptance_criteria),
    },
    project: {
      name: run.project_name,
      provider: run.source_provider,
      externalRepositoryId: run.external_repository_id,
      repository: `${run.namespace}/${run.repository_name}`,
    },
    validations,
    evidence,
    changeSet,
    review,
    publication,
    gate: evaluateViewGate({ validations, evidence, changeSet, review }),
  };
}

async function claimMutation(
  sql: QueryableSql,
  input: {
    workspaceId: string;
    operation: string;
    idempotencyKey: string;
    hash: string;
    allowPendingReconciliation?: boolean;
  },
): Promise<{ replay: ForgeReviewMutationResult | null; reconcile: boolean }> {
  const inserted = await sql<{ request_hash: string }[]>`
    INSERT INTO forge_idempotency_records (
      workspace_id, operation, idempotency_key, request_hash,
      status, expires_at
    ) VALUES (
      ${input.workspaceId}::uuid,
      ${input.operation},
      ${input.idempotencyKey},
      ${input.hash},
      'pending',
      now() + interval '24 hours'
    )
    ON CONFLICT (workspace_id, operation, idempotency_key) DO NOTHING
    RETURNING request_hash
  `;
  if (inserted[0]) return { replay: null, reconcile: false };
  const rows = await sql<IdempotencyRow[]>`
    SELECT request_hash, status, response
    FROM forge_idempotency_records
    WHERE workspace_id = ${input.workspaceId}::uuid
      AND operation = ${input.operation}
      AND idempotency_key = ${input.idempotencyKey}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row || row.request_hash !== input.hash) {
    throw new ForgeEvidenceReviewError(
      "IDEMPOTENCY_KEY_CONFLICT",
      "The request key was already used with different input.",
      409,
    );
  }
  if (row.status === "completed" && row.response) {
    return { replay: { ...row.response, replayed: true }, reconcile: false };
  }
  if (input.allowPendingReconciliation) {
    return { replay: null, reconcile: true };
  }
  throw new ForgeEvidenceReviewError(
    "REQUEST_IN_PROGRESS",
    "An identical request is still being processed.",
    409,
  );
}

async function completeMutation(
  sql: QueryableSql,
  input: {
    workspaceId: string;
    operation: string;
    idempotencyKey: string;
    response: ForgeReviewMutationResult;
  },
): Promise<void> {
  await sql`
    UPDATE forge_idempotency_records
    SET status = 'completed',
        resource_type = 'run',
        resource_id = ${input.response.runId}::uuid,
        response = ${JSON.stringify(input.response)}::jsonb,
        updated_at = now()
    WHERE workspace_id = ${input.workspaceId}::uuid
      AND operation = ${input.operation}
      AND idempotency_key = ${input.idempotencyKey}
  `;
}

export async function prepareFixtureForgeEvidence(input: {
  actor: ForgeActor;
  runId: string;
  idempotencyKey: string;
}): Promise<ForgeReviewMutationResult> {
  assertIdempotencyKey(input.idempotencyKey);
  const root = requireSql();
  return root.begin(async (transaction) => {
    const run = await getAuthorizedRun(transaction, input.actor, input.runId, true);
    const operation = "prepare-fixture-evidence";
    const claim = await claimMutation(transaction, {
      workspaceId: run.workspace_id,
      operation,
      idempotencyKey: input.idempotencyKey,
      hash: requestHash({ runId: run.id }),
    });
    if (claim.replay) return claim.replay;
    if (run.source_provider !== "fake-source") {
      throw new ForgeEvidenceReviewError(
        "PROVIDER_UNAVAILABLE",
        "Fixture evidence is available only for the fake source provider.",
        409,
      );
    }
    if (!FIXTURE_COMPLETABLE_STATES.has(run.state)) {
      throw new ForgeEvidenceReviewError(
        "RUN_NOT_REVIEWABLE",
        `Evidence cannot be generated while the run is ${run.state}.`,
        409,
      );
    }

    const baseCommitSha = gitSha(`${run.id}:base:${run.iteration}`);
    const headCommitSha = gitSha(`${run.id}:head:${run.iteration}`);
    const rawDiff = [
      "diff --git a/src/atoryn-task.ts b/src/atoryn-task.ts",
      "new file mode 100644",
      "index 0000000..1111111",
      "--- /dev/null",
      "+++ b/src/atoryn-task.ts",
      "@@ -0,0 +1,3 @@",
      `+export const requestedChange = ${JSON.stringify(run.original_instruction)};`,
      "+export const validationStatus = \"passed\";",
      "+export const reviewRequired = true;",
      "",
    ].join("\n");
    const redacted = redactSecrets(rawDiff);
    const diffDigest = sha256(redacted.value);
    const nextVersion = run.version + 1;
    const changedFiles: ForgeChangedFileView[] = [
      {
        path: "src/atoryn-task.ts",
        status: "added",
        additions: 3,
        deletions: 0,
        scope: "expected",
      },
    ];
    const unresolvedRisks = [
      "Execution uses deterministic fake providers; live provider behavior remains unverified.",
    ];
    const usageEstimate = {
      modelTokens: 1_240,
      sandboxSeconds: 18,
      estimatedUsd: 0.04,
    };

    await transaction`
      DELETE FROM forge_validation_results
      WHERE workspace_id = ${run.workspace_id}::uuid
        AND run_id = ${run.id}::uuid
    `;
    const validations: Array<{
      kind: ForgeValidationView["kind"];
      command: string;
      requirement: ForgeValidationView["requirement"];
      durationMs: number;
    }> = [
      { kind: "build", command: "pnpm build", requirement: "constitution", durationMs: 1_820 },
      { kind: "test", command: "pnpm test", requirement: "task_mandatory", durationMs: 930 },
      { kind: "lint", command: "pnpm lint", requirement: "advisory", durationMs: 410 },
      { kind: "typecheck", command: "pnpm typecheck", requirement: "constitution", durationMs: 670 },
    ];
    for (const validation of validations) {
      await transaction`
        INSERT INTO forge_validation_results (
          id, run_id, workspace_id, kind, command, requirement,
          status, exit_code, duration_ms, output_summary,
          artifact_ref, started_at, finished_at
        ) VALUES (
          ${randomUUID()}::uuid,
          ${run.id}::uuid,
          ${run.workspace_id}::uuid,
          ${validation.kind},
          ${validation.command},
          ${validation.requirement},
          'passed', 0, ${validation.durationMs},
          ${`${validation.kind} passed in the deterministic fixture.`},
          ${`artifact://forge/${run.id}/${validation.kind}`},
          now() - interval '2 seconds', now()
        )
      `;
    }

    await transaction`
      DELETE FROM forge_acceptance_evidence
      WHERE workspace_id = ${run.workspace_id}::uuid
        AND run_id = ${run.id}::uuid
    `;
    const criteria = normalizeCriteria(run.acceptance_criteria);
    for (const criterion of criteria) {
      await transaction`
        INSERT INTO forge_acceptance_evidence (
          id, run_id, workspace_id, criterion_key, requirement,
          status, evidence_type, evidence_ref, explanation
        ) VALUES (
          ${randomUUID()}::uuid,
          ${run.id}::uuid,
          ${run.workspace_id}::uuid,
          ${criterion.key},
          ${criterion.requirement},
          'satisfied',
          'validation-and-diff',
          ${`diff://${diffDigest}#${criterion.key}`},
          ${`The redacted diff and passing validation support: ${criterion.description}`}
        )
      `;
    }
    await transaction`
      INSERT INTO forge_acceptance_evidence (
        id, run_id, workspace_id, criterion_key, requirement,
        status, evidence_type, evidence_ref, explanation
      ) VALUES (
        ${randomUUID()}::uuid,
        ${run.id}::uuid,
        ${run.workspace_id}::uuid,
        'secret-scan',
        'constitution',
        ${redacted.redactionCount === 0 ? "satisfied" : "not_satisfied"},
        'redacted-diff-scan',
        ${`diff://${diffDigest}`},
        ${redacted.redactionCount === 0
          ? "No supported secret pattern was found in the generated change set."
          : `${redacted.redactionCount} secret-like value(s) were redacted from the diff.`}
      )
    `;

    await transaction`
      INSERT INTO forge_change_sets (
        id, run_id, workspace_id, snapshot_version,
        base_commit_sha, head_commit_sha, changed_files,
        unified_diff, diff_digest, contains_binary,
        contains_secret_finding, agent_summary,
        unresolved_risks, usage_estimate, generated_at
      ) VALUES (
        ${randomUUID()}::uuid,
        ${run.id}::uuid,
        ${run.workspace_id}::uuid,
        ${nextVersion},
        ${baseCommitSha},
        ${headCommitSha},
        ${JSON.stringify(changedFiles)}::jsonb,
        ${redacted.value},
        ${diffDigest},
        false,
        ${redacted.redactionCount > 0},
        ${`Implemented the reviewed task in one expected file and recorded four validation results.`},
        ${JSON.stringify(unresolvedRisks)}::jsonb,
        ${JSON.stringify(usageEstimate)}::jsonb,
        now()
      )
      ON CONFLICT (run_id) DO UPDATE SET
        snapshot_version = EXCLUDED.snapshot_version,
        base_commit_sha = EXCLUDED.base_commit_sha,
        head_commit_sha = EXCLUDED.head_commit_sha,
        changed_files = EXCLUDED.changed_files,
        unified_diff = EXCLUDED.unified_diff,
        diff_digest = EXCLUDED.diff_digest,
        contains_binary = EXCLUDED.contains_binary,
        contains_secret_finding = EXCLUDED.contains_secret_finding,
        agent_summary = EXCLUDED.agent_summary,
        unresolved_risks = EXCLUDED.unresolved_risks,
        usage_estimate = EXCLUDED.usage_estimate,
        generated_at = EXCLUDED.generated_at
    `;

    const firstSequence = Number(run.event_sequence) + 1;
    const events = [
      { type: "run.started", payload: { provider: "fake-agent" } },
      { type: "validation.started", payload: { commands: validations.length } },
      { type: "validation.completed", payload: { passed: validations.length, failed: 0 } },
      { type: "review.ready", payload: { snapshotVersion: nextVersion, diffDigest } },
    ];
    for (const [index, event] of events.entries()) {
      await transaction`
        INSERT INTO forge_run_events (
          run_id, workspace_id, sequence, type, actor_type,
          actor_id, payload, schema_version
        ) VALUES (
          ${run.id}::uuid,
          ${run.workspace_id}::uuid,
          ${firstSequence + index}::bigint,
          ${event.type},
          'system', null,
          ${JSON.stringify(event.payload)}::jsonb,
          1
        )
      `;
    }
    const updatedRows = await transaction<{
      version: number;
      event_sequence: string;
    }[]>`
      UPDATE forge_runs
      SET state = 'awaiting_review',
          started_at = COALESCE(started_at, now()),
          event_sequence = event_sequence + ${events.length},
          version = version + 1,
          updated_at = now()
      WHERE id = ${run.id}::uuid
        AND workspace_id = ${run.workspace_id}::uuid
      RETURNING version, event_sequence
    `;
    await transaction`
      UPDATE forge_tasks
      SET status = 'review', version = version + 1, updated_at = now()
      WHERE id = ${run.task_id}::uuid
        AND workspace_id = ${run.workspace_id}::uuid
    `;
    const updated = updatedRows[0];
    if (!updated) throw new Error("Run update returned no row");
    const response: ForgeReviewMutationResult = {
      runId: run.id,
      state: "awaiting_review",
      version: updated.version,
      eventSequence: Number(updated.event_sequence),
      snapshotVersion: nextVersion,
    };
    await completeMutation(transaction, {
      workspaceId: run.workspace_id,
      operation,
      idempotencyKey: input.idempotencyKey,
      response,
    });
    return response;
  });
}

export async function resolveForgeEvidenceReview(input: {
  actor: ForgeActor;
  runId: string;
  idempotencyKey: string;
  decision: "approved" | "rejected";
  rationale?: string;
  expectedSnapshotVersion: number;
}): Promise<ForgeReviewMutationResult> {
  assertIdempotencyKey(input.idempotencyKey);
  if (input.decision !== "approved" && input.decision !== "rejected") {
    throw new ForgeEvidenceReviewError(
      "INVALID_INPUT",
      "Review decision must be approved or rejected.",
      400,
    );
  }
  if (!Number.isInteger(input.expectedSnapshotVersion) || input.expectedSnapshotVersion < 0) {
    throw new ForgeEvidenceReviewError(
      "INVALID_INPUT",
      "Evidence snapshot version is invalid.",
      400,
    );
  }
  const rationale = input.rationale?.trim().slice(0, 1_000) || null;
  const root = requireSql();
  return root.begin(async (transaction) => {
    const run = await getAuthorizedRun(transaction, input.actor, input.runId, true);
    const operation = "resolve-evidence-review";
    const claim = await claimMutation(transaction, {
      workspaceId: run.workspace_id,
      operation,
      idempotencyKey: input.idempotencyKey,
      hash: requestHash({
        runId: run.id,
        decision: input.decision,
        rationale,
        expectedSnapshotVersion: input.expectedSnapshotVersion,
      }),
    });
    if (claim.replay) return claim.replay;
    if (run.state !== "awaiting_review") {
      throw new ForgeEvidenceReviewError(
        "RUN_NOT_REVIEWABLE",
        `The run is ${run.state}, not awaiting review.`,
        409,
      );
    }

    const [validations, evidence, changeSet, existingReview] = await Promise.all([
      readValidations(transaction, run.workspace_id, run.id),
      readEvidence(transaction, run.workspace_id, run.id),
      readChangeSet(transaction, run.workspace_id, run.id),
      readReview(transaction, run.workspace_id, run.id),
    ]);
    if (!changeSet || changeSet.snapshotVersion !== input.expectedSnapshotVersion) {
      throw new ForgeEvidenceReviewError(
        "STALE_EVIDENCE_SNAPSHOT",
        "The evidence changed after this review was opened.",
        409,
      );
    }
    if (existingReview) {
      throw new ForgeEvidenceReviewError(
        "RUN_NOT_REVIEWABLE",
        "This run already has a review decision.",
        409,
      );
    }
    const gate = evaluateViewGate({
      validations,
      evidence,
      changeSet,
      review: null,
    });
    if (input.decision === "approved" && !gate.eligibleForApproval) {
      throw new ForgeEvidenceReviewError(
        "EVIDENCE_BLOCKED",
        gate.blockers.map((blocker) => blocker.message).join(" "),
        409,
      );
    }

    const reviewId = randomUUID();
    const evidenceSnapshot = {
      validationIds: validations.map((item) => item.id).sort(),
      evidenceIds: evidence.map((item) => item.id).sort(),
      changeSetId: changeSet.id,
      diffDigest: changeSet.diffDigest,
      headCommitSha: changeSet.headCommitSha,
    };
    const reviewRows = await transaction<ReviewRow[]>`
      INSERT INTO forge_review_decisions (
        id, run_id, workspace_id, decision, decided_by,
        rationale, evidence_snapshot_version, evidence_snapshot,
        advisory_waivers, created_at
      ) VALUES (
        ${reviewId}::uuid,
        ${run.id}::uuid,
        ${run.workspace_id}::uuid,
        ${input.decision},
        ${input.actor.id},
        ${rationale},
        ${changeSet.snapshotVersion},
        ${JSON.stringify(evidenceSnapshot)}::jsonb,
        '[]'::jsonb,
        now()
      )
      RETURNING id, decision, decided_by, rationale,
                evidence_snapshot_version, evidence_snapshot,
                advisory_waivers, created_at
    `;
    const reviewRow = reviewRows[0];
    if (!reviewRow) throw new Error("Review insert returned no row");
    const nextState: ForgeReviewRunState =
      input.decision === "rejected" ? "completed" : "awaiting_review";
    const eventSequence = Number(run.event_sequence) + 1;
    const updatedRows = await transaction<{ version: number }[]>`
      UPDATE forge_runs
      SET state = ${nextState},
          review_outcome = ${input.decision === "rejected" ? "rejected" : null},
          finished_at = ${input.decision === "rejected" ? new Date() : null},
          event_sequence = event_sequence + 1,
          version = version + 1,
          updated_at = now()
      WHERE id = ${run.id}::uuid
        AND workspace_id = ${run.workspace_id}::uuid
      RETURNING version
    `;
    await transaction`
      INSERT INTO forge_run_events (
        run_id, workspace_id, sequence, type, actor_type,
        actor_id, payload, schema_version
      ) VALUES (
        ${run.id}::uuid,
        ${run.workspace_id}::uuid,
        ${eventSequence}::bigint,
        'review.resolved',
        'user',
        ${input.actor.id},
        ${JSON.stringify({
          reviewId,
          decision: input.decision,
          snapshotVersion: changeSet.snapshotVersion,
          diffDigest: changeSet.diffDigest,
        })}::jsonb,
        1
      )
    `;
    const version = updatedRows[0]?.version;
    if (version === undefined) throw new Error("Run review update returned no row");
    const response: ForgeReviewMutationResult = {
      runId: run.id,
      state: nextState,
      version,
      eventSequence,
      snapshotVersion: changeSet.snapshotVersion,
      review: mapReview(reviewRow),
    };
    await completeMutation(transaction, {
      workspaceId: run.workspace_id,
      operation,
      idempotencyKey: input.idempotencyKey,
      response,
    });
    return response;
  });
}

export async function createNextForgeIteration(input: {
  actor: ForgeActor;
  previousRunId: string;
  idempotencyKey: string;
}): Promise<ForgeReviewMutationResult> {
  assertIdempotencyKey(input.idempotencyKey);
  const root = requireSql();
  return root.begin(async (transaction) => {
    const previous = await getAuthorizedRun(
      transaction,
      input.actor,
      input.previousRunId,
      true,
    );
    const operation = "create-next-iteration";
    const claim = await claimMutation(transaction, {
      workspaceId: previous.workspace_id,
      operation,
      idempotencyKey: input.idempotencyKey,
      hash: requestHash({ previousRunId: previous.id }),
    });
    if (claim.replay) return claim.replay;
    if (previous.state !== "completed" || previous.review_outcome !== "rejected") {
      throw new ForgeEvidenceReviewError(
        "RUN_NOT_REVIEWABLE",
        "A new iteration requires a completed rejected run.",
        409,
      );
    }

    const workspaceRows = await transaction<{ active_run_limit: number }[]>`
      SELECT active_run_limit
      FROM forge_workspaces
      WHERE id = ${previous.workspace_id}::uuid
      FOR UPDATE
    `;
    const limit = workspaceRows[0]?.active_run_limit ?? 1;
    const activeRows = await transaction<{ count: string }[]>`
      SELECT count(*)::text AS count
      FROM forge_runs
      WHERE workspace_id = ${previous.workspace_id}::uuid
        AND state IN ${transaction([...ACTIVE_STATES])}
    `;
    if (Number(activeRows[0]?.count ?? "0") >= limit) {
      throw new ForgeEvidenceReviewError(
        "RUN_NOT_REVIEWABLE",
        "The workspace already has an active run.",
        409,
      );
    }

    const nextRunId = randomUUID();
    const nextIteration = previous.iteration + 1;
    await transaction`
      INSERT INTO forge_runs (
        id, task_id, workspace_id, iteration, state, base_branch,
        agent_provider, sandbox_provider, budget_policy,
        permission_policy, event_sequence, version
      ) VALUES (
        ${nextRunId}::uuid,
        ${previous.task_id}::uuid,
        ${previous.workspace_id}::uuid,
        ${nextIteration},
        'queued',
        ${previous.base_branch},
        ${previous.agent_provider},
        ${previous.sandbox_provider},
        ${JSON.stringify(previous.budget_policy)}::jsonb,
        ${JSON.stringify(previous.permission_policy)}::jsonb,
        1, 0
      )
    `;
    await transaction`
      INSERT INTO forge_run_events (
        run_id, workspace_id, sequence, type, actor_type,
        actor_id, payload, schema_version
      ) VALUES (
        ${nextRunId}::uuid,
        ${previous.workspace_id}::uuid,
        1,
        'run.created',
        'user',
        ${input.actor.id},
        ${JSON.stringify({
          previousRunId: previous.id,
          iteration: nextIteration,
          reason: "rejected-review-follow-up",
        })}::jsonb,
        1
      )
    `;
    await transaction`
      UPDATE forge_tasks
      SET status = 'running', version = version + 1, updated_at = now()
      WHERE id = ${previous.task_id}::uuid
        AND workspace_id = ${previous.workspace_id}::uuid
    `;
    const response: ForgeReviewMutationResult = {
      runId: previous.id,
      state: "completed",
      version: previous.version,
      eventSequence: Number(previous.event_sequence),
      snapshotVersion: null,
      nextRunId,
    };
    await completeMutation(transaction, {
      workspaceId: previous.workspace_id,
      operation,
      idempotencyKey: input.idempotencyKey,
      response,
    });
    return response;
  });
}

export type PublicationRecoveryDecision =
  | "reuse-completed"
  | "resume-publication"
  | "reject-head-mismatch";

export function planPublicationRecovery(input: {
  status: ForgePublicationView["status"];
  recordedCommitSha: string;
  currentHeadSha: string;
  changeRequestId: string | null;
}): PublicationRecoveryDecision {
  if (input.recordedCommitSha !== input.currentHeadSha) {
    return "reject-head-mismatch";
  }
  if (input.status === "pr_created" && input.changeRequestId) {
    return "reuse-completed";
  }
  return "resume-publication";
}

function fakeDraftPublication(input: {
  repository: string;
  runId: string;
  branchName: string;
  headCommitSha: string;
}): { id: string; url: string } {
  const id = `draft-${sha256(`${input.runId}:${input.branchName}:${input.headCommitSha}`).slice(0, 12)}`;
  const repositoryPath = input.repository.split("/").map(encodeURIComponent).join("/");
  return {
    id,
    url: `https://example.invalid/${repositoryPath}/pull/${encodeURIComponent(id)}`,
  };
}

export async function publishApprovedForgeRun(input: {
  actor: ForgeActor;
  runId: string;
  idempotencyKey: string;
  expectedSnapshotVersion: number;
}): Promise<ForgeReviewMutationResult> {
  assertIdempotencyKey(input.idempotencyKey);
  if (!Number.isInteger(input.expectedSnapshotVersion) || input.expectedSnapshotVersion < 0) {
    throw new ForgeEvidenceReviewError(
      "INVALID_INPUT",
      "Evidence snapshot version is invalid.",
      400,
    );
  }
  const root = requireSql();
  const phase = await root.begin(async (transaction) => {
    const run = await getAuthorizedRun(transaction, input.actor, input.runId, true);
    const operation = "publish-approved-run";
    const hash = requestHash({
      runId: run.id,
      expectedSnapshotVersion: input.expectedSnapshotVersion,
    });
    const claim = await claimMutation(transaction, {
      workspaceId: run.workspace_id,
      operation,
      idempotencyKey: input.idempotencyKey,
      hash,
      allowPendingReconciliation: true,
    });
    if (claim.replay) return { replay: claim.replay } as const;
    if (
      run.state !== "awaiting_review" &&
      run.state !== "publishing" &&
      run.state !== "completed"
    ) {
      throw new ForgeEvidenceReviewError(
        "RUN_NOT_REVIEWABLE",
        `The run cannot publish while it is ${run.state}.`,
        409,
      );
    }

    const [validations, evidence, changeSet, review, publication] = await Promise.all([
      readValidations(transaction, run.workspace_id, run.id),
      readEvidence(transaction, run.workspace_id, run.id),
      readChangeSet(transaction, run.workspace_id, run.id),
      readReview(transaction, run.workspace_id, run.id),
      readPublication(transaction, run.workspace_id, run.id),
    ]);
    if (!changeSet || changeSet.snapshotVersion !== input.expectedSnapshotVersion) {
      throw new ForgeEvidenceReviewError(
        "STALE_EVIDENCE_SNAPSHOT",
        "The approved evidence snapshot is stale.",
        409,
      );
    }
    const gate = evaluateViewGate({ validations, evidence, changeSet, review });
    if (!review || review.decision !== "approved" || !gate.eligibleForPublication) {
      throw new ForgeEvidenceReviewError(
        "REVIEW_NOT_APPROVED",
        gate.blockers.map((blocker) => blocker.message).join(" ") ||
          "The evidence snapshot has not been approved.",
        409,
      );
    }

    const branchName = `atoryn/run-${run.id.slice(0, 8)}-i${run.iteration}`;
    if (publication) {
      const recovery = planPublicationRecovery({
        status: publication.status,
        recordedCommitSha: publication.commitSha,
        currentHeadSha: changeSet.headCommitSha,
        changeRequestId: publication.changeRequestId,
      });
      if (recovery === "reject-head-mismatch") {
        throw new ForgeEvidenceReviewError(
          "PUBLICATION_CONFLICT",
          "The recorded publication head differs from the approved evidence head.",
          409,
        );
      }
      if (recovery === "reuse-completed") {
        const response: ForgeReviewMutationResult = {
          runId: run.id,
          state: "completed",
          version: run.version,
          eventSequence: Number(run.event_sequence),
          snapshotVersion: changeSet.snapshotVersion,
          publication,
          replayed: true,
        };
        await completeMutation(transaction, {
          workspaceId: run.workspace_id,
          operation,
          idempotencyKey: input.idempotencyKey,
          response,
        });
        return { replay: response } as const;
      }
    }

    let publicationId = publication?.id ?? randomUUID();
    if (!publication) {
      await transaction`
        INSERT INTO forge_publications (
          id, run_id, workspace_id, provider, external_repository_id,
          branch_name, commit_sha, status, failure_code,
          evidence_snapshot_version, diff_digest, unresolved_risks
        ) VALUES (
          ${publicationId}::uuid,
          ${run.id}::uuid,
          ${run.workspace_id}::uuid,
          ${run.source_provider},
          ${run.external_repository_id},
          ${branchName},
          ${changeSet.headCommitSha},
          'pending', null,
          ${changeSet.snapshotVersion},
          ${changeSet.diffDigest},
          ${JSON.stringify(changeSet.unresolvedRisks)}::jsonb
        )
      `;
    } else {
      publicationId = publication.id;
      await transaction`
        UPDATE forge_publications
        SET status = 'pending', failure_code = null, updated_at = now()
        WHERE id = ${publication.id}::uuid
          AND workspace_id = ${run.workspace_id}::uuid
      `;
    }

    let eventSequence = Number(run.event_sequence);
    let version = run.version;
    if (run.state === "awaiting_review") {
      eventSequence += 1;
      version += 1;
      await transaction`
        UPDATE forge_runs
        SET state = 'publishing',
            working_branch = ${branchName},
            event_sequence = event_sequence + 1,
            version = version + 1,
            updated_at = now()
        WHERE id = ${run.id}::uuid
          AND workspace_id = ${run.workspace_id}::uuid
      `;
      await transaction`
        INSERT INTO forge_run_events (
          run_id, workspace_id, sequence, type, actor_type,
          actor_id, payload, schema_version
        ) VALUES (
          ${run.id}::uuid,
          ${run.workspace_id}::uuid,
          ${eventSequence}::bigint,
          'publication.started',
          'user',
          ${input.actor.id},
          ${JSON.stringify({
            publicationId,
            branchName,
            commitSha: changeSet.headCommitSha,
            diffDigest: changeSet.diffDigest,
          })}::jsonb,
          1
        )
      `;
    }
    return {
      replay: null,
      workspaceId: run.workspace_id,
      runId: run.id,
      repository: `${run.namespace}/${run.repository_name}`,
      branchName,
      publicationId,
      changeSet,
      version,
      eventSequence,
      operation,
    } as const;
  });
  if ("replay" in phase && phase.replay) return phase.replay;
  if (!("workspaceId" in phase)) {
    throw new ForgeEvidenceReviewError(
      "PROVIDER_UNAVAILABLE",
      "Publication could not be prepared.",
      503,
    );
  }

  if (process.env.FORGE_FAKE_PUBLICATION_FAILURE === "1") {
    await root.begin(async (transaction) => {
      const run = await getAuthorizedRun(transaction, input.actor, phase.runId, true);
      const sequence = Number(run.event_sequence) + 1;
      await transaction`
        UPDATE forge_publications
        SET status = 'failed', failure_code = 'PROVIDER_UNAVAILABLE', updated_at = now()
        WHERE id = ${phase.publicationId}::uuid
          AND workspace_id = ${phase.workspaceId}::uuid
      `;
      await transaction`
        UPDATE forge_runs
        SET event_sequence = event_sequence + 1,
            version = version + 1,
            updated_at = now()
        WHERE id = ${phase.runId}::uuid
          AND workspace_id = ${phase.workspaceId}::uuid
      `;
      await transaction`
        INSERT INTO forge_run_events (
          run_id, workspace_id, sequence, type, actor_type,
          actor_id, payload, schema_version
        ) VALUES (
          ${phase.runId}::uuid,
          ${phase.workspaceId}::uuid,
          ${sequence}::bigint,
          'publication.failed',
          'provider', null,
          ${JSON.stringify({ failureCode: "PROVIDER_UNAVAILABLE" })}::jsonb,
          1
        )
      `;
    });
    throw new ForgeEvidenceReviewError(
      "PROVIDER_UNAVAILABLE",
      "The fake source provider simulated a partial publication failure.",
      503,
    );
  }

  const providerResult = fakeDraftPublication({
    repository: phase.repository,
    runId: phase.runId,
    branchName: phase.branchName,
    headCommitSha: phase.changeSet.headCommitSha,
  });
  return root.begin(async (transaction) => {
    const run = await getAuthorizedRun(transaction, input.actor, phase.runId, true);
    const currentChangeSet = await readChangeSet(
      transaction,
      phase.workspaceId,
      phase.runId,
    );
    if (
      !currentChangeSet ||
      currentChangeSet.snapshotVersion !== phase.changeSet.snapshotVersion ||
      currentChangeSet.diffDigest !== phase.changeSet.diffDigest ||
      currentChangeSet.headCommitSha !== phase.changeSet.headCommitSha
    ) {
      throw new ForgeEvidenceReviewError(
        "STALE_EVIDENCE_SNAPSHOT",
        "Evidence changed during publication.",
        409,
      );
    }
    const publicationRows = await transaction<PublicationRow[]>`
      UPDATE forge_publications
      SET status = 'pr_created',
          change_request_id = ${providerResult.id},
          change_request_url = ${providerResult.url},
          failure_code = null,
          updated_at = now()
      WHERE id = ${phase.publicationId}::uuid
        AND workspace_id = ${phase.workspaceId}::uuid
        AND commit_sha = ${currentChangeSet.headCommitSha}
        AND diff_digest = ${currentChangeSet.diffDigest}
      RETURNING id, provider, external_repository_id, branch_name,
                commit_sha, change_request_id, change_request_url,
                status, failure_code, evidence_snapshot_version,
                diff_digest, unresolved_risks, created_at, updated_at
    `;
    const publicationRow = publicationRows[0];
    if (!publicationRow) {
      throw new ForgeEvidenceReviewError(
        "PUBLICATION_CONFLICT",
        "Publication no longer matches the approved change set.",
        409,
      );
    }
    const sequence = Number(run.event_sequence) + 1;
    const updatedRows = await transaction<{ version: number }[]>`
      UPDATE forge_runs
      SET state = 'completed',
          review_outcome = 'approved',
          finished_at = now(),
          event_sequence = event_sequence + 1,
          version = version + 1,
          updated_at = now()
      WHERE id = ${phase.runId}::uuid
        AND workspace_id = ${phase.workspaceId}::uuid
      RETURNING version
    `;
    await transaction`
      UPDATE forge_tasks
      SET status = 'completed', version = version + 1, updated_at = now()
      WHERE id = ${run.task_id}::uuid
        AND workspace_id = ${phase.workspaceId}::uuid
    `;
    await transaction`
      INSERT INTO forge_run_events (
        run_id, workspace_id, sequence, type, actor_type,
        actor_id, payload, schema_version
      ) VALUES (
        ${phase.runId}::uuid,
        ${phase.workspaceId}::uuid,
        ${sequence}::bigint,
        'publication.completed',
        'provider', null,
        ${JSON.stringify({
          publicationId: phase.publicationId,
          branchName: phase.branchName,
          commitSha: currentChangeSet.headCommitSha,
          changeRequestId: providerResult.id,
          changeRequestUrl: providerResult.url,
        })}::jsonb,
        1
      )
    `;
    const publication = mapPublication(publicationRow);
    const response: ForgeReviewMutationResult = {
      runId: phase.runId,
      state: "completed",
      version: updatedRows[0]?.version ?? run.version + 1,
      eventSequence: sequence,
      snapshotVersion: currentChangeSet.snapshotVersion,
      publication,
    };
    await completeMutation(transaction, {
      workspaceId: phase.workspaceId,
      operation: phase.operation,
      idempotencyKey: input.idempotencyKey,
      response,
    });
    return response;
  });
}
