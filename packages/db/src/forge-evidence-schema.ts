import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { forgeRuns, forgeWorkspaces } from "./schema";

export const forgeChangeSets = pgTable(
  "forge_change_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => forgeRuns.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => forgeWorkspaces.id, { onDelete: "cascade" }),
    snapshotVersion: integer("snapshot_version").notNull(),
    baseCommitSha: text("base_commit_sha").notNull(),
    headCommitSha: text("head_commit_sha").notNull(),
    changedFiles: jsonb("changed_files").$type<
      Array<{
        path: string;
        status: "added" | "modified" | "deleted";
        additions: number;
        deletions: number;
        scope: "expected" | "unexpected";
      }>
    >().notNull(),
    unifiedDiff: text("unified_diff").notNull(),
    diffDigest: text("diff_digest").notNull(),
    containsBinary: boolean("contains_binary").notNull().default(false),
    containsSecretFinding: boolean("contains_secret_finding").notNull().default(false),
    agentSummary: text("agent_summary").notNull(),
    unresolvedRisks: jsonb("unresolved_risks").$type<string[]>().notNull(),
    usageEstimate: jsonb("usage_estimate")
      .$type<{ modelTokens: number; sandboxSeconds: number; estimatedUsd: number }>()
      .notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("forge_change_sets_run_uq").on(table.runId),
    index("forge_change_sets_workspace_idx").on(table.workspaceId, table.runId),
  ],
);

export type ForgeChangeSetRow = typeof forgeChangeSets.$inferSelect;
export type NewForgeChangeSet = typeof forgeChangeSets.$inferInsert;
