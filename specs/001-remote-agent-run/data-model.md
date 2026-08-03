# Data Model: Remote Agent Run

## Modeling rules

- Internal UUIDs are canonical identities; provider IDs and URLs are attributes.
- Workspace authorization is enforced on every read and mutation.
- Run events are append-only facts ordered by a per-run sequence.
- Mutable aggregates use optimistic concurrency versions.
- Provider credentials are referenced through secret handles, never stored in task/run payloads.
- Original instructions and normalized technical instructions are both retained.

## Workspace

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | string | Display name |
| defaultInterfaceLocale | `vi` \| `en` | UI default |
| defaultTechnicalOutputLanguage | `vi` \| `en` | Engineering artifact default |
| activeRunLimit | integer | `1` for MVP |
| createdAt / updatedAt | timestamp | Audit timestamps |

## WorkspaceMember

| Field | Type | Notes |
|---|---|---|
| workspaceId | UUID | Workspace FK |
| userId | UUID | Auth user FK |
| role | `owner` | Only owner role needed for MVP |
| createdAt | timestamp | Membership audit |

Unique: `(workspaceId, userId)`.

## ProviderConnection

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| workspaceId | UUID | Ownership boundary |
| providerKind | `source` \| `agent` \| `sandbox` | Capability category |
| providerKey | string | `github`, `codex`, `vercel-sandbox` |
| externalAccountId | string nullable | Provider account/installation identity |
| displayName | string | User-visible connection name |
| secretHandle | string nullable | Reference to secret manager only |
| status | `active` \| `expired` \| `revoked` \| `error` | Connection state |
| scopes | JSON array | Granted provider capabilities |
| metadata | JSON | Non-secret provider metadata |
| createdAt / updatedAt | timestamp | Audit timestamps |

Unique where relevant: `(workspaceId, providerKey, externalAccountId)`.

## Project

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| workspaceId | UUID | Ownership boundary |
| name | string | Atoryn display name |
| sourceConnectionId | UUID | Provider connection FK |
| sourceProvider | string | Provider-neutral discriminator |
| externalRepositoryId | string | GitHub repo ID in MVP |
| namespace | string | Provider namespace/owner |
| repositoryName | string | Provider repository name |
| defaultBranch | string | Resolved base branch |
| validationProfile | JSON | Build/test/lint/typecheck commands |
| interfaceLocale | `vi` \| `en` | Project UI preference |
| technicalOutputLanguage | `vi` \| `en` | Engineering artifact preference |
| status | `active` \| `disconnected` \| `archived` | Project state |
| createdAt / updatedAt | timestamp | Audit timestamps |

Unique: `(sourceProvider, externalRepositoryId)` within a workspace.

## Task

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| projectId | UUID | Project FK |
| createdBy | UUID | User FK |
| title | string | Developer-facing title |
| originalInstruction | text | Unmodified developer input |
| instructionLanguage | `vi` \| `en` | Input language |
| normalizedObjective | text | Technical objective |
| scope | JSON | Allowed/expected areas |
| acceptanceCriteria | JSON array | Verifiable criteria |
| constraints | JSON array | Security, provider, and project constraints |
| technicalOutputLanguage | `vi` \| `en` | Artifact language |
| status | `draft` \| `ready` \| `running` \| `review` \| `completed` \| `cancelled` | Task lifecycle |
| version | integer | Optimistic concurrency |
| createdAt / updatedAt | timestamp | Audit timestamps |

## Run

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| taskId | UUID | Task FK |
| iteration | integer | Starts at 1; unique per task |
| agentConnectionId | UUID | Agent provider connection |
| sandboxConnectionId | UUID | Sandbox provider connection |
| sourceConnectionId | UUID | Source provider connection |
| state | enum | See state machine below |
| baseBranch | string | Reviewed base branch |
| baseCommitSha | string nullable | Resolved before mutation |
| workingBranch | string nullable | Created for publication |
| agentProvider | string | Provider-neutral key |
| sandboxProvider | string | Provider-neutral key |
| budgetPolicy | JSON | Time/model/sandbox limits |
| permissionPolicy | JSON | Network, command, source scopes |
| sandboxExternalId | string nullable | Provider sandbox identity |
| startedAt / finishedAt | timestamp nullable | Lifecycle timestamps |
| cancelRequestedAt | timestamp nullable | Cancellation audit |
| lastHeartbeatAt | timestamp nullable | Reconciliation |
| eventSequence | bigint | Latest committed sequence |
| version | integer | Optimistic concurrency |
| failureCode | string nullable | Stable machine-readable code |
| failureSummary | text nullable | Redacted explanation |
| createdAt / updatedAt | timestamp | Audit timestamps |

Unique: `(taskId, iteration)`.

### Run state enum

`draft`, `queued`, `provisioning`, `running`, `awaiting_approval`, `cancelling`, `validating`, `awaiting_review`, `publishing`, `completed`, `failed`, `cancelled`, `expired`.

## RunEvent

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| runId | UUID | Run FK |
| sequence | bigint | Monotonic within run |
| type | string | Stable event type |
| actorType | `user` \| `system` \| `agent` \| `provider` | Origin |
| actorId | string nullable | User/provider/agent identity |
| correlationId | string nullable | Links request/tool/result |
| payload | JSON | Versioned, redacted event payload |
| schemaVersion | integer | Event contract version |
| createdAt | timestamp | Persisted time |

Unique: `(runId, sequence)`. Events are never updated; corrections are new events.

Initial event types:

- `run.created`
- `run.queued`
- `sandbox.provisioning_started`
- `sandbox.ready`
- `agent.started`
- `agent.message_recorded`
- `agent.instruction_added`
- `command.requested`
- `command.started`
- `command.completed`
- `file.change_detected`
- `approval.requested`
- `approval.resolved`
- `validation.started`
- `validation.completed`
- `review.ready`
- `publication.started`
- `publication.completed`
- `run.cancel_requested`
- `run.cancelled`
- `run.failed`
- `run.completed`

## IdempotencyRecord

| Field | Type | Notes |
|---|---|---|
| workspaceId | UUID | Ownership boundary |
| operation | string | `start-run`, `cancel-run`, `resolve-approval`, `publish` |
| idempotencyKey | string | Client supplied |
| requestHash | string | Reject same key with different input |
| resourceType | string | Created/affected resource kind |
| resourceId | UUID nullable | Result resource |
| response | JSON nullable | Replay-safe response summary |
| expiresAt | timestamp | Retention boundary |
| createdAt | timestamp | Audit |

Unique: `(workspaceId, operation, idempotencyKey)`.

## ApprovalRequest

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| runId | UUID | Run FK |
| requestKey | string | Provider/agent request identity |
| actionType | string | Stable sensitive action class |
| summary | text | User-facing redacted explanation |
| scope | JSON | Command/resource/network/secret scope |
| riskLevel | `low` \| `medium` \| `high` \| `critical` | Policy classification |
| status | `pending` \| `approved` \| `rejected` \| `expired` \| `cancelled` | Decision state |
| requestedAt | timestamp | Creation |
| expiresAt | timestamp nullable | Automatic expiry |
| resolvedBy | UUID nullable | User FK |
| resolvedAt | timestamp nullable | Decision time |
| reason | text nullable | Developer rationale |
| version | integer | Concurrency guard |

Unique: `(runId, requestKey)`.

## ValidationResult

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| runId | UUID | Run FK |
| kind | `build` \| `test` \| `lint` \| `typecheck` \| `custom` | Validation category |
| command | text | Redacted command |
| required | boolean | Completion gate |
| status | `pending` \| `running` \| `passed` \| `failed` \| `skipped` | Result |
| exitCode | integer nullable | Process result |
| durationMs | integer nullable | Duration |
| outputSummary | text nullable | Redacted summary |
| artifactRef | string nullable | Full log/artifact storage reference |
| startedAt / finishedAt | timestamp nullable | Audit |

## AcceptanceEvidence

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| runId | UUID | Run FK |
| criterionKey | string | Stable criterion identifier |
| status | `satisfied` \| `not_satisfied` \| `inconclusive` \| `waived` | Evidence verdict |
| evidenceType | string | Test, diff, manual, screenshot, log, etc. |
| evidenceRef | string nullable | Artifact/event/file reference |
| explanation | text | Why evidence supports verdict |
| waivedBy | UUID nullable | Required for waiver |
| createdAt | timestamp | Audit |

Unique: `(runId, criterionKey)`.

## ChangeSet

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| runId | UUID | Run FK |
| baseCommitSha | string | Diff base |
| headCommitSha | string nullable | Commit after accepted changes |
| changedFiles | JSON | Path/status/additions/deletions/scope classification |
| diffArtifactRef | string | Stored unified diff or provider reference |
| containsBinary | boolean | Review warning |
| containsSecretFinding | boolean | Security gate |
| generatedAt | timestamp | Snapshot time |

One active change set per run iteration.

## ReviewDecision

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| runId | UUID | Run FK |
| decision | `approved` \| `rejected` \| `cancelled` | Developer outcome |
| decidedBy | UUID | User FK |
| rationale | text nullable | Review notes |
| evidenceSnapshot | JSON | IDs/versions reviewed |
| createdAt | timestamp | Decision time |

Only one final approval per run; rejection may lead to a new task iteration.

## Publication

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| runId | UUID | Run FK |
| provider | string | `github` in MVP |
| externalRepositoryId | string | Provider repo identity |
| branchName | string | Created branch |
| commitSha | string | Published commit |
| changeRequestId | string nullable | Pull request ID |
| changeRequestUrl | string nullable | Display reference |
| status | `pending` \| `pushed` \| `pr_created` \| `failed` | Publication state |
| failureCode | string nullable | Reconciliation reason |
| createdAt / updatedAt | timestamp | Audit |

Unique: `(runId)` and provider-side idempotency metadata.

## Important invariants

1. A workspace cannot exceed its active run limit.
2. A run cannot enter `running` without a resolved project, base branch, budget, permission policy, and provider connections.
3. A command classified as sensitive cannot start without a valid approved request covering the exact scope.
4. An approval request can resolve only once.
5. A run cannot enter `awaiting_review` until sandbox mutation has stopped and the change set plus validation records exist.
6. A run cannot publish without an approved review decision referencing the current evidence snapshot.
7. A publication cannot write directly to the base branch.
8. Prior run events, evidence, decisions, and iterations are never overwritten by retries.
9. Terminal states are immutable except through explicit administrative reconciliation that adds audit events.
10. All user-visible provider errors are redacted and mapped to stable internal failure codes.
