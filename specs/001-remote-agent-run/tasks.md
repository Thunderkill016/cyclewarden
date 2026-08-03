# Tasks: Remote Agent Run

**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`  
**Tests**: Required by the constitution for domain logic, provider contracts, security boundaries, recovery, and end-to-end acceptance.  
**Organization**: Tasks are dependency ordered and grouped by independently testable user story.

## Format

`- [ ] T### [P?] [US?] Description with exact target path`

- **[P]**: Can run in parallel with other tasks in the same phase.
- **[US1-US4]**: Maps directly to a user story in `spec.md`.

## Phase 1: Spec Kit and direction foundation

- [x] T001 Create Atoryn Forge constitution at `.specify/memory/constitution.md`
- [x] T002 Set the active feature in `.specify/feature.json`
- [x] T003 Create feature specification at `specs/001-remote-agent-run/spec.md`
- [x] T004 Create technical plan and research decisions in `specs/001-remote-agent-run/plan.md` and `research.md`
- [x] T005 Create data model, quickstart, and requirements checklist under `specs/001-remote-agent-run/`
- [ ] T006 Run the official Spec Kit CLI locally with Codex skills and reconcile generated templates without overwriting committed artifacts
- [ ] T007 Run `$speckit-analyze` and resolve every CRITICAL or HIGH inconsistency before implementation

**Checkpoint**: Specification artifacts are authoritative and internally consistent.

## Phase 2: Provider-neutral domain foundation

- [ ] T008 Create `packages/forge-domain/package.json` and strict TypeScript configuration using existing workspace conventions
- [ ] T009 [P] Define task, run, approval, validation, review, publication, and event schemas in `packages/forge-domain/src/contracts/`
- [ ] T010 [P] Define `SourceProvider` contract in `packages/forge-domain/src/providers/source-provider.ts`
- [ ] T011 [P] Define `CodingAgentProvider` contract in `packages/forge-domain/src/providers/coding-agent-provider.ts`
- [ ] T012 [P] Define `SandboxProvider` contract in `packages/forge-domain/src/providers/sandbox-provider.ts`
- [ ] T013 Implement the run state machine and legal transitions in `packages/forge-domain/src/run/run-state-machine.ts`
- [ ] T014 Implement completion-evidence rules in `packages/forge-domain/src/review/completion-gate.ts`
- [ ] T015 Implement sensitive-action classification in `packages/forge-domain/src/approval/approval-policy.ts`
- [ ] T016 Implement secret-redaction contracts in `packages/forge-domain/src/security/redaction.ts`
- [ ] T017 [P] Add unit tests for run transitions in `packages/forge-domain/src/run/run-state-machine.test.ts`
- [ ] T018 [P] Add unit tests for approval classification and completion gates in `packages/forge-domain/src/approval/` and `src/review/`
- [ ] T019 [P] Add redaction regression tests for common token/key patterns in `packages/forge-domain/src/security/redaction.test.ts`

**Checkpoint**: Domain tests pass without importing Next.js, GitHub, Codex, Vercel, or database implementations.

## Phase 3: Fake providers and application orchestration

- [ ] T020 Create `packages/forge-application/` using existing package conventions
- [ ] T021 Implement workspace-authorized task creation and normalization use case in `packages/forge-application/src/tasks/create-task.ts`
- [ ] T022 Implement idempotent run start use case in `packages/forge-application/src/runs/start-run.ts`
- [ ] T023 Implement instruction, cancel, approval-resolution, review, and publish use cases under `packages/forge-application/src/`
- [ ] T024 [P] Implement deterministic fake source provider in `packages/forge-application/src/testing/fake-source-provider.ts`
- [ ] T025 [P] Implement deterministic fake coding-agent provider in `packages/forge-application/src/testing/fake-agent-provider.ts`
- [ ] T026 [P] Implement deterministic fake sandbox provider in `packages/forge-application/src/testing/fake-sandbox-provider.ts`
- [ ] T027 Add provider contract suites reusable by every adapter in `packages/forge-application/src/testing/provider-contracts/`
- [ ] T028 Add application tests for duplicate start, cancel, approval, review, and publish requests in `packages/forge-application/src/**/*.test.ts`
- [ ] T029 Add one complete fake-provider run test from task creation through approved publication in `packages/forge-application/src/testing/remote-run.integration.test.ts`

**Checkpoint**: The entire domain lifecycle runs deterministically without external providers or web UI.

## Phase 4: Durable persistence and event projection

- [ ] T030 Add Drizzle schema and migration for Forge entities in the existing `packages/db/` conventions
- [ ] T031 Implement transactional run transition plus ordered event append in `packages/forge-application/src/persistence/`
- [ ] T032 Implement idempotency repository and request-hash validation in `packages/forge-application/src/persistence/idempotency-repository.ts`
- [ ] T033 Implement optimistic concurrency for run and approval mutations
- [ ] T034 Implement event cursor queries and current-state snapshot projection in `packages/forge-application/src/events/`
- [ ] T035 Implement stale lease, heartbeat, expired approval, and partial-publication reconciliation in `packages/forge-application/src/reconciliation/`
- [ ] T036 Add database integration tests for event ordering, rollback, optimistic concurrency, and idempotency
- [ ] T037 Add cross-workspace authorization tests for every project, task, run, approval, review, and publication query

**Checkpoint**: Run state survives process restart and can be reconstructed from durable records.

## Phase 5: User Story 1 - Start a governed coding run

**Goal**: A developer connects/selects a repository, reviews a normalized task, and starts one governed run.

- [ ] T038 [US1] Add Forge project and repository selection routes/actions under `apps/web/app/api/forge/`
- [ ] T039 [P] [US1] Build responsive repository selector in `apps/web/components/forge/repository-selector.tsx`
- [ ] T040 [P] [US1] Build bilingual task composer in `apps/web/components/forge/task-composer.tsx`
- [ ] T041 [US1] Build pre-run review for scope, agent, base branch, budget, and permissions in `apps/web/components/forge/run-review.tsx`
- [ ] T042 [US1] Connect the start-run action to the application service with server-side workspace authorization and idempotency
- [ ] T043 [US1] Add validation and error UX for revoked connection, unsupported repository, active-run limit, and invalid task
- [ ] T044 [P] [US1] Add component tests for repository selection and task review
- [ ] T045 [US1] Add Playwright flow for sign-in fixture -> repository -> task -> durable run creation

**Independent acceptance**: US1 scenarios pass using fake providers and persisted state.

## Phase 6: User Story 2 - Monitor and control from another device

**Goal**: A developer can reconnect, inspect ordered progress, approve/reject, instruct, and cancel from a second device.

- [ ] T046 [US2] Add run snapshot endpoint and SSE endpoint under `apps/web/app/api/forge/runs/[runId]/`
- [ ] T047 [US2] Implement persisted-history-then-live event projection with event cursor recovery
- [ ] T048 [P] [US2] Build desktop run activity feed in `apps/web/components/forge/run-activity-feed.tsx`
- [ ] T049 [P] [US2] Build mobile run command center in `apps/web/components/forge/mobile-run-command-center.tsx`
- [ ] T050 [US2] Add additional-instruction and cancellation actions with idempotency and terminal-state guards
- [ ] T051 [US2] Add approval detail and resolve actions with optimistic concurrency
- [ ] T052 [P] [US2] Add tests for event replay, duplicate event suppression, and reconnect after cursor
- [ ] T053 [P] [US2] Add race test where two sessions resolve the same approval and only one succeeds
- [ ] T054 [US2] Add Playwright cross-context test: desktop start -> disconnect -> mobile recover -> approve/cancel

**Independent acceptance**: US2 scenarios pass while the original browser is closed.

## Phase 7: User Story 3 - Review evidence and create a draft pull request

**Goal**: A developer reviews objective evidence, approves or rejects, and publishes only an approved change set.

- [ ] T055 [US3] Adapt existing changed-file and verification capabilities into the Forge completion gate
- [ ] T056 [US3] Persist validation results and acceptance evidence for build, test, lint, type-check, and custom commands
- [ ] T057 [US3] Generate and store a redacted change set and unified diff after mutation stops
- [ ] T058 [P] [US3] Build changed-file and diff review surface in `apps/web/components/forge/change-review.tsx`
- [ ] T059 [P] [US3] Build validation, acceptance evidence, unresolved risk, and usage panels
- [ ] T060 [US3] Implement review approval/rejection against an evidence snapshot
- [ ] T061 [US3] Implement publication orchestration that creates a new branch and draft pull request only after approval
- [ ] T062 [US3] Reuse or adapt existing draft-PR publication code without retaining trusted-local assumptions
- [ ] T063 [P] [US3] Add completion-gate tests for missing evidence, failed required checks, waivers, and stale evidence snapshots
- [ ] T064 [P] [US3] Add publication idempotency and partial-failure reconciliation tests
- [ ] T065 [US3] Add Playwright flow for review -> approve -> draft PR result and reject -> new iteration

**Independent acceptance**: US3 scenarios pass with fake source publication before the live GitHub adapter is enabled.

## Phase 8: User Story 4 - Bilingual workflow

**Goal**: Vietnamese interface/instructions and English technical artifacts remain separately controlled and traceable.

- [ ] T066 [US4] Extend `packages/i18n/` with Atoryn Forge Vietnamese and English message namespaces
- [ ] T067 [US4] Store interface locale, instruction language, and technical-output language separately in task/project flows
- [ ] T068 [US4] Preserve original instruction beside normalized technical instruction in all review and audit surfaces
- [ ] T069 [P] [US4] Add Vietnamese task normalization fixture and English artifact assertions
- [ ] T070 [P] [US4] Add responsive locale-switch tests proving domain state does not change

**Independent acceptance**: US4 scenarios pass with Vietnamese task input and English branch/commit/PR fixture output.

## Phase 9: Live provider technical spike

- [ ] T071 Create `packages/provider-github/` implementing the source-provider contract with a GitHub App
- [ ] T072 Add signed GitHub callback/webhook handling and repository-installation reconciliation
- [ ] T073 Add repository-scoped short-lived credential brokerage without exposing the GitHub App private key
- [ ] T074 Create `packages/provider-sandbox-vercel/` implementing sandbox create, execute, expose, stop, and destroy
- [ ] T075 Enforce sandbox time, storage, compute, and deny-by-default network policy
- [ ] T076 Create `packages/provider-codex/` implementing start, resume, additional instruction, approval, cancel, event stream, and usage summary
- [ ] T077 Normalize live provider events into versioned Atoryn run events
- [ ] T078 Add opt-in live GitHub contract test against a disposable repository
- [ ] T079 Add opt-in live sandbox/Codex smoke test for one deterministic JavaScript/TypeScript task
- [ ] T080 Record startup time, dependency-install time, model usage, sandbox usage, cancellation time, and cleanup result in `specs/001-remote-agent-run/live-spike-results.md`

**Checkpoint**: One real disposable repository reaches reviewed draft PR through remote execution.

## Phase 10: Security, responsive hardening, and convergence

- [ ] T081 Add PWA manifest and installability metadata without making offline execution claims
- [ ] T082 Audit all Forge pages at desktop, tablet, and mobile viewports and fix overflow, focus, and touch-target defects
- [ ] T083 Add security tests for cross-workspace access, replay, secret leakage, expired token, denied network, and direct base-branch write
- [ ] T084 Add cleanup tests for completed, failed, expired, and cancelled sandboxes
- [ ] T085 Add structured operational logs and metrics for run state, provider latency, failures, approvals, and cleanup
- [ ] T086 Update active product documentation to distinguish Atoryn Forge direction from the frozen CycleWarden practical-validation scope
- [ ] T087 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and web end-to-end tests
- [ ] T088 Run `$speckit-analyze`, fix all material artifact/code inconsistencies, and update tasks if needed
- [ ] T089 Run `$speckit-converge` and append any missing implementation or evidence tasks
- [ ] T090 Complete final security and evidence review before marking the feature ready for merge

## Dependency graph

```text
Phase 1
  -> Phase 2
  -> Phase 3
  -> Phase 4
  -> US1
  -> US2
  -> US3

US4 can begin after Phase 4 and proceed alongside US1-US3 UI work.

Live provider spike requires Phase 3 provider contracts, Phase 4 persistence,
and the corresponding US1-US3 application use cases.

Security/convergence requires every implemented story and live-provider result.
```

## Recommended first implementation slice

Implement T008-T029 only. This creates the provider-neutral domain, complete fake-provider lifecycle, and automated tests before external integrations or major UI work. Do not begin T071-T080 until the fake-provider vertical slice is deterministic.
