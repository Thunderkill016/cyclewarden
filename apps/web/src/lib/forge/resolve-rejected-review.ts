import { createHash, randomUUID } from "node:crypto";

import type { Sql } from "postgres";

import { createSql } from "@/lib/db";
import type { ForgeActor } from "./actor";
import {
  ForgeEvidenceReviewError,
  type ForgeReviewDecisionView,
  type ForgeReviewMutationResult,
} from "./evidence-review-service";

type PostgresTimestamp = Date | string;
type PostgresRows = readonly (object | undefined)[];
type SqlTemplateParameters =
  Parameters<Sql> extends [TemplateStringsArray, ...infer Rest] ? Rest : never;

interface QueryableSql {
  <T extends PostgresRows = Record<string, unknown>[]>(
    strings: TemplateStringsArray,
    ...parameters: SqlTemplateParameters
  ): Promise<T>;
}

interface RunRow {
  id: string;
  task_id: string;
  workspace_id: string;
  state: string;
  version: number;
  event_sequence: string;
}

interface ChangeSetRow {
  id: string;
  snapshot_version: number;
  diff_digest: string;
  head_commit_sha: string;
}

interface ReviewRow {
  id: string;
  decision: "rejected";
  decided_by: string;
  rationale: string | null;
  evidence_snapshot_version: number;
  evidence_snapshot: unknown;
  advisory_waivers: unknown[];
  created_at: PostgresTimestamp;
}

interface IdempotencyRow {
  request_hash: string;
  status: "pending" | "completed";
  response: ForgeReviewMutationResult | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function timestamp(value: PostgresTimestamp): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
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

function requestHash(value: unknown): string {
  return createHash("sha256").update(stableSerialize(value)).digest("hex");
}

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

async function completeIdempotency(
  sql: QueryableSql,
  input: {
    workspaceId: string;
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
      AND operation = 'resolve-evidence-review'
      AND idempotency_key = ${input.idempotencyKey}
  `;
}

export async function resolveRejectedForgeReview(input: {
  actor: ForgeActor;
  runId: string;
  idempotencyKey: string;
  rationale?: string;
  expectedSnapshotVersion: number;
}): Promise<ForgeReviewMutationResult> {
  if (!UUID.test(input.runId)) {
    throw new ForgeEvidenceReviewError("INVALID_INPUT", "Run ID is invalid.", 400);
  }
  if (!input.idempotencyKey || input.idempotencyKey.length > 200) {
    throw new ForgeEvidenceReviewError(
      "INVALID_INPUT",
      "Idempotency key is invalid.",
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
  const hash = requestHash({
    runId: input.runId,
    decision: "rejected",
    rationale,
    expectedSnapshotVersion: input.expectedSnapshotVersion,
  });
  const root = requireSql();

  return root.begin(async (transaction) => {
    const runRows = await transaction<RunRow[]>`
      SELECT r.id, r.task_id, r.workspace_id, r.state,
             r.version, r.event_sequence
      FROM forge_runs r
      JOIN forge_workspace_members m ON m.workspace_id = r.workspace_id
      WHERE r.id = ${input.runId}::uuid
        AND m.user_id = ${input.actor.id}
      FOR UPDATE OF r
    `;
    const run = runRows[0];
    if (!run) {
      throw new ForgeEvidenceReviewError(
        "NOT_FOUND_OR_UNAUTHORIZED",
        "Run was not found.",
        404,
      );
    }

    const inserted = await transaction<{ request_hash: string }[]>`
      INSERT INTO forge_idempotency_records (
        workspace_id, operation, idempotency_key, request_hash,
        status, expires_at
      ) VALUES (
        ${run.workspace_id}::uuid,
        'resolve-evidence-review',
        ${input.idempotencyKey},
        ${hash},
        'pending',
        now() + interval '24 hours'
      )
      ON CONFLICT (workspace_id, operation, idempotency_key) DO NOTHING
      RETURNING request_hash
    `;
    if (!inserted[0]) {
      const existingRows = await transaction<IdempotencyRow[]>`
        SELECT request_hash, status, response
        FROM forge_idempotency_records
        WHERE workspace_id = ${run.workspace_id}::uuid
          AND operation = 'resolve-evidence-review'
          AND idempotency_key = ${input.idempotencyKey}
        LIMIT 1
      `;
      const existing = existingRows[0];
      if (!existing || existing.request_hash !== hash) {
        throw new ForgeEvidenceReviewError(
          "IDEMPOTENCY_KEY_CONFLICT",
          "The request key was already used with different input.",
          409,
        );
      }
      if (existing.status === "completed" && existing.response) {
        return { ...existing.response, replayed: true };
      }
      throw new ForgeEvidenceReviewError(
        "REQUEST_IN_PROGRESS",
        "An identical request is still being processed.",
        409,
      );
    }

    if (run.state !== "awaiting_review") {
      throw new ForgeEvidenceReviewError(
        "RUN_NOT_REVIEWABLE",
        `The run is ${run.state}, not awaiting review.`,
        409,
      );
    }

    const changeSetRows = await transaction<ChangeSetRow[]>`
      SELECT id, snapshot_version, diff_digest, head_commit_sha
      FROM forge_change_sets
      WHERE workspace_id = ${run.workspace_id}::uuid
        AND run_id = ${run.id}::uuid
      LIMIT 1
    `;
    const changeSet = changeSetRows[0];
    if (!changeSet || changeSet.snapshot_version !== input.expectedSnapshotVersion) {
      throw new ForgeEvidenceReviewError(
        "STALE_EVIDENCE_SNAPSHOT",
        "The evidence changed after this review was opened.",
        409,
      );
    }

    const existingReview = await transaction<{ exists: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM forge_review_decisions
        WHERE workspace_id = ${run.workspace_id}::uuid
          AND run_id = ${run.id}::uuid
      ) AS exists
    `;
    if (existingReview[0]?.exists) {
      throw new ForgeEvidenceReviewError(
        "RUN_NOT_REVIEWABLE",
        "This run already has a review decision.",
        409,
      );
    }

    const validationRows = await transaction<{ id: string }[]>`
      SELECT id FROM forge_validation_results
      WHERE workspace_id = ${run.workspace_id}::uuid
        AND run_id = ${run.id}::uuid
      ORDER BY id ASC
    `;
    const evidenceRows = await transaction<{ id: string }[]>`
      SELECT id FROM forge_acceptance_evidence
      WHERE workspace_id = ${run.workspace_id}::uuid
        AND run_id = ${run.id}::uuid
      ORDER BY id ASC
    `;
    const evidenceSnapshot = {
      validationIds: validationRows.map((item) => item.id),
      evidenceIds: evidenceRows.map((item) => item.id),
      changeSetId: changeSet.id,
      diffDigest: changeSet.diff_digest,
      headCommitSha: changeSet.head_commit_sha,
    };
    const reviewId = randomUUID();
    const reviewRows = await transaction<ReviewRow[]>`
      INSERT INTO forge_review_decisions (
        id, run_id, workspace_id, decision, decided_by,
        rationale, evidence_snapshot_version, evidence_snapshot,
        advisory_waivers, created_at
      ) VALUES (
        ${reviewId}::uuid,
        ${run.id}::uuid,
        ${run.workspace_id}::uuid,
        'rejected',
        ${input.actor.id},
        ${rationale},
        ${changeSet.snapshot_version},
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

    const eventSequence = Number(run.event_sequence) + 1;
    const updatedRows = await transaction<{ version: number }[]>`
      UPDATE forge_runs
      SET state = 'completed',
          review_outcome = 'rejected',
          finished_at = now(),
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
          decision: "rejected",
          snapshotVersion: changeSet.snapshot_version,
          diffDigest: changeSet.diff_digest,
        })}::jsonb,
        1
      )
    `;

    const version = updatedRows[0]?.version;
    if (version === undefined) throw new Error("Run review update returned no row");
    const response: ForgeReviewMutationResult = {
      runId: run.id,
      state: "completed",
      version,
      eventSequence,
      snapshotVersion: changeSet.snapshot_version,
      review: mapReview(reviewRow),
    };
    await completeIdempotency(transaction, {
      workspaceId: run.workspace_id,
      idempotencyKey: input.idempotencyKey,
      response,
    });
    return response;
  });
}
