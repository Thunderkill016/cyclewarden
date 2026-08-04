export {
  user,
  session,
  account,
  verification,
  profiles,
  notes,
  forgeWorkspaces,
  forgeWorkspaceMembers,
  forgeProviderConnections,
  forgeProjects,
  forgeTasks,
  forgeRuns,
  forgeRunEvents,
  forgeIdempotencyRecords,
  forgeApprovalRequests,
  forgeValidationResults,
  forgeAcceptanceEvidence,
  forgeReviewDecisions,
  forgePublications,
  type Profile,
  type NewProfile,
  type NoteRow,
  type NewNote,
  type ForgeRunRow,
  type NewForgeRun,
  type ForgeRunEventRow,
  type NewForgeRunEvent,
} from "./schema";

export {
  forgeChangeSets,
  type ForgeChangeSetRow,
  type NewForgeChangeSet,
} from "./forge-evidence-schema";

/** DatabasePort — thin contract for future multi-adapter work. */
export interface DatabasePort {
  ping(): Promise<boolean>;
}
