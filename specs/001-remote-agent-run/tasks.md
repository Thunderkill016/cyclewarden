# Tasks: Remote Agent Run

**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `analysis.md`  
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
- [x] T006 Run official Spec Kit CLI v0.8.15 on a GitHub-hosted Linux runner and synchronize Codex skills, templates, scripts, manifests, and extensions while preserving Atoryn-authored artifacts
- [x] T007 Apply `$speckit-analyze` rules across specification artifacts, record findings in `specs/001-remote-agent-run/analysis.md`, and resolve every CRITICAL or HIGH inconsistency before implementation

**Checkpoint**: Specification artifacts are authoritative and internally consistent.

## Phase 2: Provider-neutral domain foundation

- [x] T008 Create `packages/forge-domain/package.json` and strict TypeScript configuration using existing workspace conventions
- [x] T009 [P] Define task, run, approval, validation, review, publication, event, evidence-classification, and stable-error schemas in `packages/forge-domain/src/contracts/`
- [x] T010 [P] Define `SourceProvider` contract in `packages/forge-domain/src/providers/source-provider.ts`
- [x] T011 [P] Define `CodingAgentProvider` contract in `packages/forge-domain/src/providers/coding-agent-provider.ts`
- [x] T012 [P] Define `SandboxProvider` contract in `packages/forge-domain/src/providers/sandbox-provider.ts`
- [x] T013 Implement legal run transitions, active-state classification, rejected-review completion, and next-iteration creation rules in `packages/forge-domain/src/run/run-state-machine.ts`
- [x] T014 Implement constitution/task-mandatory versus advisory evidence rules, stale-snapshot detection, and publication eligibility in `packages/forge-domain/src/review/completion-gate.ts`
- [x] T015 Implement sensitive-action classification in `packages/forge-domain/src/approval/approval-policy.ts`
- [x] T016 Implement secret-redaction contracts in `packages/forge-domain/src/security/redaction.ts`
- [x] T017 [P] Add unit tests for legal/illegal transitions, cancellable states, `ACTIVE_RUN_EXISTS`, rejected-review finalization, and next-iteration uniqueness in `packages/forge-domain/src/run/run-state-machine.test.ts`
- [x] T018 [P] Add approval-policy tests in `packages/forge-domain/src/approval/approval-policy.test.ts` and completion-gate tests for mandatory/advisory evidence and stale snapshots in `packages/forge-domain/src/review/completion-gate.test.ts`
- [x] T019 [P] Add redaction regression tests for common token/key patterns in `packages/forge-domain/src/security/redaction.test.ts`

**Checkpoint**: Domain tests pass without importing Next.js, GitHub, Codex, Vercel, or database implementations. Validation evidence: frozen pnpm install, typecheck, 13 unit tests, and package build passed on Ubuntu/Node 22 in PR #71.

## Phase 3: Fake providers and application orchestration

- [x] T020 Create `packages/forge-application/` using existing package conventions
- [x] T021 Implement workspace-authorized task creation and normalization use case in `packages/forge-application/src/tasks/create-task.ts`
- [x] T022 Implement idempotent run admission in `packages/forge-application/src/runs/start-run.ts`, including atomic active-run-limit enforcement and side-effect-free `ACTIVE_RUN_EXISTS` rejection
- [x] T023 Implement concrete use cases in `packages/forge-application/src/runs/add-instruction.ts`, `cancel-run.ts`, `create-next-iteration.ts`, `packages/forge-application/src/approvals/resolve-approval.ts`, `src/reviews/resolve-review.ts`, and `src/publications/publish-run.ts`
- [x] T024 [P] Implement deterministic fake source provider in `packages/forge-application/src/testing/fake-source-provider.ts`
- [x] T025 [P] Implement deterministic fake coding-agent provider in `packages/forge-application/src/testing/fake-agent-provider.ts`
- [x] T026 [P] Implement deterministic fake sandbox provider in `packages/forge-application/src/testing/fake-sandbox-provider.ts`
- [x] T027 Add provider contract suites reusable by every adapter in `packages/forge-application/src/testing/provider-contracts/`
- [x] T028 Add application tests for duplicate start, active-run rejection, cancel, approval races, rejected-review iteration creation, stale review, and idempotent publish in `packages/forge-application/src/**/*.test.ts`
- [x] T029 Add one deterministic fake-provider integration suite in `packages/forge-application/src/testing/remote-run.integration.test.ts` covering both rejected iteration N -> iteration N+1 and approved evidence -> draft publication

**Checkpoint**: The entire domain lifecycle runs deterministically without external providers or web UI. Validation evidence: frozen pnpm install; domain typecheck, 13 tests, and build; application typecheck, 7 tests, and build passed on Ubuntu/Node 22 in PR #72.

## Phase 4: Durable persistence and event projection

- [x] T030 Add Drizzle schema and migration for Forge entities in the existing `packages/db/` conventions
- [x] T031 Implement transactional run transition plus ordered event append in `packages/forge-application/src/persistence/`
- [x] T032 Implement idempotency repository and request-hash validation in `packages/forge-application/src/persistence/idempotency-repository.ts`
- [x] T033 Implement optimistic concurrency for run and approval mutations
- [x] T034 Implement event cursor queries and current-state snapshot projection in `packages/forge-application/src/events/`
- [x] T035 Implement stale lease, heartbeat, expired approval, and partial-publication reconciliation in `packages/forge-application/src/reconciliation/`
- [x] T036 Add database integration tests for event ordering, rollback, optimistic concurrency, and idempotency
- [x] T037 Add cross-workspace authorization tests for every project, task, run, approval, review, and publication query

**Checkpoint**: Run state survives process restart and can be reconstructed from durable records. Validation evidence: PostgreSQL 16 migrations; db/domain/application typechecks and builds; 13 domain tests and 17 application tests passed in PR #73, including transaction rollback, ordered event cursors, optimistic concurrency, persistent idempotency, reconciliation, and cross-workspace isolation.

## Phase 5: User Story 1 - Start a governed coding run

**Goal**: A developer connects/selects a repository, reviews a normalized task, and starts one governed run.

- [x] T038 [US1] Add the authenticated Forge start route and server action under `apps/web/src/app/app/forge/` and `apps/web/src/app/actions/forge.ts`
- [x] T039 [P] [US1] Build responsive repository selector in `apps/web/src/components/forge/repository-selector.tsx`
- [x] T040 [P] [US1] Build bilingual task composer in `apps/web/src/components/forge/task-composer.tsx`
- [x] T041 [US1] Build pre-run review for scope, agent, base branch, budget, network, and sensitive-action permissions in `apps/web/src/components/forge/run-review.tsx`
- [x] T042 [US1] Connect the start-run action to durable PostgreSQL creation with server-side workspace authorization, canonical request hashing, idempotency, active-run admission, ordered event creation, and explicit JSONB serialization
- [x] T043 [US1] Add validation and error UX for revoked connection, unsupported repository, deterministic `ACTIVE_RUN_EXISTS`, idempotency conflicts, and invalid tasks
- [x] T044 [P] [US1] Add component tests for repository selection, bilingual task composition, and reviewed run policy in `apps/web/src/components/forge/start-components.test.tsx`
- [x] T045 [US1] Add authenticated Playwright flow in `apps/web/e2e/forge-start.spec.ts` for Better Auth sign-up -> repository -> task -> reviewed durable PostgreSQL run creation

**Independent acceptance**: US1 scenarios pass using fake provider fixtures and persisted PostgreSQL state. Validation evidence in PR #74: synchronized frozen lockfile, web typecheck, 3/3 Forge component tests, required domain artifact build, Next.js production build, and one authenticated PostgreSQL Playwright test with `--retries=0` all passed on Ubuntu/Node 22. Temporary diagnostic workflows were removed after validation.

## Phase 6: User Story 2 - Monitor and control from another device

**Goal**: A developer can reconnect, inspect ordered progress, approve/reject, instruct, and cancel from a second device.

- [x] T046 [US2] Add authenticated run snapshot, cursor recovery, SSE, command, and approval endpoints under `apps/web/src/app/api/forge/runs/[runId]/`
- [x] T047 [US2] Implement persisted-history-then-live event projection with `Last-Event-ID`, cursor polling, heartbeat, reconnect, ordered merge, and duplicate suppression in `apps/web/src/lib/forge/run-event-projection.ts` and the SSE route
- [x] T048 [P] [US2] Build desktop run activity feed in `apps/web/src/components/forge/run-activity-feed.tsx`
- [x] T049 [P] [US2] Build responsive mobile command center in `apps/web/src/components/forge/mobile-run-command-center.tsx` and connect it through `run-console.tsx`
- [x] T050 [US2] Add server-authorized additional-instruction and cancellation commands with persistent idempotency, controllable-state guards, ordered events, and terminal completion in `apps/web/src/lib/forge/run-control-service.ts`
- [x] T051 [US2] Add sensitive-instruction approval detail and approve/reject actions with row locking and optimistic expected-version checks
- [x] T052 [P] [US2] Add tests for ordered replay, duplicate suppression, cursor-gap recovery, cancellation projection, and approval projection in `apps/web/src/lib/forge/run-event-projection.test.ts`
- [x] T053 [P] [US2] Add optimistic approval race test proving one session wins and a stale second decision is rejected
- [x] T054 [US2] Add authenticated cross-context Playwright flow in `apps/web/e2e/forge-live-controls.spec.ts`: desktop start -> close original page -> mobile recover -> sensitive instruction -> approve -> cancel

**Independent acceptance**: US2 passes while the original desktop page is closed. Validation evidence in PR #75 on Ubuntu/Node 22 and PostgreSQL 16: frozen install, Forge domain build, web typecheck, 5/5 replay and approval-race tests, and Next.js production build passed; then one authenticated cross-context Playwright test passed in 41.2 seconds with `--retries=0`, recovering the persisted event cursor and completing instruction, approval, and cancellation from a new mobile browser context. Temporary verification artifacts were removed after validation.

## Phase 7: User Story 3 - Review evidence and create a draft pull request

**Goal**: A developer reviews objective evidence, approves or rejects, and publishes only an approved change set.

- [x] T055 [US3] Reuse the Forge completion gate and CycleWarden verification principles to require mandatory checks, acceptance evidence, current snapshot version, inspectable diff, and explicit developer approval before publication
- [x] T056 [US3] Persist build, test, lint, type-check validation results and acceptance evidence in PostgreSQL through `forge_validation_results` and `forge_acceptance_evidence`
- [x] T057 [US3] Add `forge_change_sets` migration/schema and generate a secret-redacted unified diff, SHA-256 digest, exact base/head commits, changed-file scope, risks, summary, and usage estimate in `apps/web/src/lib/forge/evidence-review-service.ts`
- [x] T058 [P] [US3] Build changed-file and unified-diff review UI in `apps/web/src/components/forge/change-review.tsx`
- [x] T059 [P] [US3] Build validation, acceptance evidence, blocker, unresolved-risk, and usage panels in `apps/web/src/components/forge/evidence-status-panel.tsx`
- [x] T060 [US3] Implement immutable snapshot-bound approval and durable rejection transactions, with advisory-only waivers enforced by the completion gate, in `evidence-review-service.ts` and `resolve-rejected-review.ts`
- [x] T061 [US3] Implement exact-head publication orchestration that creates a new branch identity and fake-provider draft change request only after an approved current evidence snapshot
- [x] T062 [US3] Adapt the existing draft-publication invariants—draft only, exact verified SHA, idempotent replay, partial-failure reconciliation, and no base-branch write—without importing trusted-local worktree or `gh` assumptions
- [x] T063 [P] [US3] Expand completion-gate coverage to 6 tests for passing mandatory evidence, failed validation, missing evidence, invalid mandatory waiver, valid advisory waiver, and stale snapshot in `packages/forge-domain/src/review/completion-gate.test.ts`
- [x] T064 [P] [US3] Add publication recovery tests for completed replay, pending/pushed/failed resume, and exact-head mismatch rejection in `apps/web/src/lib/forge/evidence-review-service.test.ts`
- [x] T065 [US3] Add authenticated Playwright acceptance in `apps/web/e2e/forge-evidence-review.spec.ts`: start -> evidence -> reject -> distinct next iteration -> evidence -> approve -> fake draft pull request

**Independent acceptance**: US3 passes with fake source publication before live GitHub is enabled. Validation evidence in PR #76: PostgreSQL migrations and database typecheck passed; Forge domain build and 6/6 completion-gate tests passed; web typecheck, publication-recovery tests, and Next.js production build passed; then exactly one authenticated Playwright test with `--retries=0` completed the rejection, next-iteration, approval, and draft-publication flow. A final web typecheck and production build also passed after adding the dedicated rejected-review transaction. Temporary verification hooks and workflow files were removed afterward.

## Phase 8: User Story 4 - Bilingual workflow

**Goal**: Vietnamese interface/instructions and English technical artifacts remain separately controlled and traceable.

- [x] T066 [US4] Extend `packages/i18n/` with Atoryn Forge Vietnamese and English message namespaces
- [x] T067 [US4] Store interface locale, instruction language, and technical-output language separately in task/project flows
- [x] T068 [US4] Preserve original instruction beside normalized technical instruction in all review and audit surfaces
- [x] T069 [P] [US4] Add Vietnamese task normalization fixture and English artifact assertions
- [x] T070 [P] [US4] Add responsive locale-switch tests proving domain state does not change

**Independent acceptance**: US4 scenarios pass with Vietnamese task input and English branch/commit/PR fixture output. Validation evidence: PR #78 merged the bilingual namespaces, separate language controls, preserved instruction trace, normalization coverage, responsive locale isolation tests, and PostgreSQL-backed Playwright acceptance.

## Phase 9: Live provider technical spike

- [x] T071 Create `packages/provider-github/` implementing the source-provider contract with a GitHub App
- [x] T072 Add signed GitHub callback/webhook handling and repository-installation reconciliation
- [x] T073 Add repository-scoped short-lived credential brokerage without exposing the GitHub App private key
- [ ] T074 Create `packages/provider-sandbox-vercel/` implementing sandbox create, execute, expose, stop, and destroy
- [ ] T075 Enforce sandbox time, storage, compute, and deny-by-default network policy
- [ ] T076 Create `packages/provider-codex/` implementing start, resume, additional instruction, approval, cancel, event stream, and usage summary
- [ ] T077 Normalize live provider events into versioned Atoryn run events
- [ ] T078 Add opt-in live GitHub contract test against a disposable repository
- [ ] T079 Add opt-in live sandbox/Codex smoke test for one deterministic JavaScript/TypeScript task
- [ ] T080 Record startup time, dependency-install time, model usage, sandbox usage, cancellation time, and cleanup result in `specs/001-remote-agent-run/live-spike-results.md`

**Checkpoint**: One real disposable repository reaches reviewed draft PR through remote execution.

## Phase 10: Security, responsive hardening, and final verification

- [ ] T081 Add PWA manifest and installability metadata without making offline execution claims
- [ ] T082 Audit all Forge pages at desktop, tablet, and mobile viewports and fix overflow, focus, and touch-target defects
- [ ] T083 Add security tests for cross-workspace access, replay, secret leakage, expired token, denied network, and direct base-branch write
- [ ] T084 Add cleanup tests for completed, failed, expired, and cancelled sandboxes
- [ ] T085 Add structured operational logs and metrics for run state, provider latency, failures, approvals, and cleanup
- [ ] T086 Update active product documentation to distinguish Atoryn Forge direction from the frozen CycleWarden practical-validation scope
- [ ] T087 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and web end-to-end tests
- [ ] T088 Run `$speckit-analyze`, fix all material artifact/code inconsistencies, and update tasks if needed
- [ ] T089 Perform a final specification-to-implementation evidence review and append any missing implementation or evidence tasks
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

Security/final verification requires every implemented story and live-provider result.
```

## Recommended first implementation slice

Implement T008-T029 only. This creates the provider-neutral domain, complete fake-provider lifecycle, and automated tests before external integrations or major UI work. Do not begin T071-T080 until the fake-provider vertical slice is deterministic.