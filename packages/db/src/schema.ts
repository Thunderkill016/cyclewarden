import {
  bigint,
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

/**
 * Better Auth core tables.
 *
 * Property names intentionally match Better Auth's logical model while SQL column
 * names match the portable-pg migrations. The Drizzle adapter receives these
 * tables explicitly so it can resolve the user/session/account/verification
 * models instead of relying on schema inference from an untyped db instance.
 */
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

/** Canonical profile row — maps to Supabase `profiles` or plain Postgres. */
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email"),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Domain example: notes owned by a user (isolation = user_id match). */
export const notes = pgTable("notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const forgeWorkspaces = pgTable("forge_workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  defaultInterfaceLocale: text("default_interface_locale").notNull().default("vi"),
  defaultTechnicalOutputLanguage: text("default_technical_output_language").notNull().default("en"),
  activeRunLimit: integer("active_run_limit").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const forgeWorkspaceMembers = pgTable(
  "forge_workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => forgeWorkspaces.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    role: text("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("forge_workspace_members_identity_uq").on(table.workspaceId, table.userId),
    index("forge_workspace_members_user_idx").on(table.userId),
  ],
);

export const forgeProviderConnections = pgTable(
  "forge_provider_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => forgeWorkspaces.id, { onDelete: "cascade" }),
    providerKind: text("provider_kind").notNull(),
    providerKey: text("provider_key").notNull(),
    externalAccountId: text("external_account_id"),
    displayName: text("display_name").notNull(),
    secretHandle: text("secret_handle"),
    status: text("status").notNull(),
    scopes: jsonb("scopes").$type<string[]>().notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("forge_provider_connections_workspace_idx").on(table.workspaceId)],
);

export const forgeProjects = pgTable(
  "forge_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => forgeWorkspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sourceConnectionId: uuid("source_connection_id").references(
      () => forgeProviderConnections.id,
      { onDelete: "set null" },
    ),
    sourceProvider: text("source_provider").notNull(),
    externalRepositoryId: text("external_repository_id").notNull(),
    namespace: text("namespace").notNull(),
    repositoryName: text("repository_name").notNull(),
    defaultBranch: text("default_branch").notNull(),
    validationProfile: jsonb("validation_profile")
      .$type<Record<string, unknown>>()
      .notNull(),
    interfaceLocale: text("interface_locale").notNull(),
    technicalOutputLanguage: text("technical_output_language").notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("forge_projects_repository_uq").on(
      table.workspaceId,
      table.sourceProvider,
      table.externalRepositoryId,
    ),
    index("forge_projects_workspace_idx").on(table.workspaceId),
  ],
);

export const forgeTasks = pgTable(
  "forge_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => forgeProjects.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => forgeWorkspaces.id, { onDelete: "cascade" }),
    createdBy: text("created_by").notNull(),
    title: text("title").notNull(),
    originalInstruction: text("original_instruction").notNull(),
    instructionLanguage: text("instruction_language").notNull(),
    normalizedObjective: text("normalized_objective").notNull(),
    scope: jsonb("scope").$type<string[]>().notNull(),
    acceptanceCriteria: jsonb("acceptance_criteria").$type<unknown[]>().notNull(),
    constraints: jsonb("constraints").$type<string[]>().notNull(),
    technicalOutputLanguage: text("technical_output_language").notNull(),
    status: text("status").notNull(),
    version: integer("version").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("forge_tasks_workspace_idx").on(table.workspaceId)],
);

export const forgeRuns = pgTable(
  "forge_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => forgeTasks.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => forgeWorkspaces.id, { onDelete: "cascade" }),
    iteration: integer("iteration").notNull(),
    state: text("state").notNull(),
    reviewOutcome: text("review_outcome"),
    baseBranch: text("base_branch").notNull(),
    baseCommitSha: text("base_commit_sha"),
    workingBranch: text("working_branch"),
    agentProvider: text("agent_provider").notNull(),
    sandboxProvider: text("sandbox_provider").notNull(),
    budgetPolicy: jsonb("budget_policy").$type<Record<string, unknown>>().notNull(),
    permissionPolicy: jsonb("permission_policy")
      .$type<Record<string, unknown>>()
      .notNull(),
    sandboxExternalId: text("sandbox_external_id"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    cancelRequestedAt: timestamp("cancel_requested_at", { withTimezone: true }),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
    eventSequence: bigint("event_sequence", { mode: "number" }).notNull().default(0),
    version: integer("version").notNull().default(0),
    failureCode: text("failure_code"),
    failureSummary: text("failure_summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("forge_runs_task_iteration_uq").on(table.taskId, table.iteration),
    index("forge_runs_workspace_state_idx").on(table.workspaceId, table.state),
    index("forge_runs_heartbeat_idx").on(table.lastHeartbeatAt),
  ],
);

export const forgeRunEvents = pgTable(
  "forge_run_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => forgeRuns.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => forgeWorkspaces.id, { onDelete: "cascade" }),
    sequence: bigint("sequence", { mode: "number" }).notNull(),
    type: text("type").notNull(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id"),
    correlationId: text("correlation_id"),
    payload: jsonb("payload").notNull(),
    schemaVersion: integer("schema_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("forge_run_events_sequence_uq").on(table.runId, table.sequence),
    index("forge_run_events_cursor_idx").on(table.workspaceId, table.runId, table.sequence),
  ],
);

export const forgeIdempotencyRecords = pgTable(
  "forge_idempotency_records",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => forgeWorkspaces.id, { onDelete: "cascade" }),
    operation: text("operation").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    status: text("status").notNull(),
    resourceType: text("resource_type"),
    resourceId: uuid("resource_id"),
    response: jsonb("response"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("forge_idempotency_identity_uq").on(
      table.workspaceId,
      table.operation,
      table.idempotencyKey,
    ),
    index("forge_idempotency_expiry_idx").on(table.expiresAt),
  ],
);

export const forgeApprovalRequests = pgTable(
  "forge_approval_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => forgeRuns.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => forgeWorkspaces.id, { onDelete: "cascade" }),
    requestKey: text("request_key").notNull(),
    actionType: text("action_type").notNull(),
    summary: text("summary").notNull(),
    scope: jsonb("scope").$type<Record<string, unknown>>().notNull(),
    riskLevel: text("risk_level").notNull(),
    status: text("status").notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    resolvedBy: text("resolved_by"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    reason: text("reason"),
    version: integer("version").notNull().default(0),
  },
  (table) => [
    uniqueIndex("forge_approval_requests_key_uq").on(table.runId, table.requestKey),
    index("forge_approval_requests_pending_idx").on(table.workspaceId, table.status, table.expiresAt),
  ],
);

export const forgeValidationResults = pgTable("forge_validation_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => forgeRuns.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => forgeWorkspaces.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  command: text("command").notNull(),
  requirement: text("requirement").notNull(),
  status: text("status").notNull(),
  exitCode: integer("exit_code"),
  durationMs: integer("duration_ms"),
  outputSummary: text("output_summary"),
  artifactRef: text("artifact_ref"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const forgeAcceptanceEvidence = pgTable(
  "forge_acceptance_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => forgeRuns.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => forgeWorkspaces.id, { onDelete: "cascade" }),
    criterionKey: text("criterion_key").notNull(),
    requirement: text("requirement").notNull(),
    status: text("status").notNull(),
    evidenceType: text("evidence_type").notNull(),
    evidenceRef: text("evidence_ref"),
    explanation: text("explanation").notNull(),
    waivedBy: text("waived_by"),
    waivedReason: text("waived_reason"),
    waivedAt: timestamp("waived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("forge_acceptance_evidence_criterion_uq").on(table.runId, table.criterionKey)],
);

export const forgeReviewDecisions = pgTable(
  "forge_review_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => forgeRuns.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => forgeWorkspaces.id, { onDelete: "cascade" }),
    decision: text("decision").notNull(),
    decidedBy: text("decided_by").notNull(),
    rationale: text("rationale"),
    evidenceSnapshotVersion: integer("evidence_snapshot_version").notNull(),
    evidenceSnapshot: jsonb("evidence_snapshot").notNull(),
    advisoryWaivers: jsonb("advisory_waivers").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("forge_review_decisions_run_uq").on(table.runId)],
);

export const forgePublications = pgTable(
  "forge_publications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => forgeRuns.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => forgeWorkspaces.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    externalRepositoryId: text("external_repository_id").notNull(),
    branchName: text("branch_name").notNull(),
    commitSha: text("commit_sha").notNull(),
    changeRequestId: text("change_request_id"),
    changeRequestUrl: text("change_request_url"),
    status: text("status").notNull(),
    failureCode: text("failure_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("forge_publications_run_uq").on(table.runId),
    index("forge_publications_partial_idx").on(table.workspaceId, table.status, table.updatedAt),
  ],
);

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type NoteRow = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type ForgeRunRow = typeof forgeRuns.$inferSelect;
export type NewForgeRun = typeof forgeRuns.$inferInsert;
export type ForgeRunEventRow = typeof forgeRunEvents.$inferSelect;
export type NewForgeRunEvent = typeof forgeRunEvents.$inferInsert;
