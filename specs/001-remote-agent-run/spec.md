# Feature Specification: Remote Agent Run

**Feature Branch**: `agent/atoryn-forge-spec-foundation`  
**Created**: 2026-08-04  
**Status**: Draft  
**Input**: First end-to-end web workflow for a developer to run and govern one coding agent remotely.

## User Scenarios & Testing

### User Story 1 - Start a governed coding run (Priority: P1)

A signed-in developer connects a GitHub account, selects one accessible repository, creates a task in Vietnamese or English, reviews the normalized task scope, chooses Codex, sets a maximum budget, and starts the run.

**Why this priority**: Without a trustworthy start flow, Atoryn Forge cannot prove its central value as a web control plane.

**Independent Test**: Connect one test repository, submit a bounded change, start the run, and verify that a durable run record and isolated execution request are created.

**Acceptance Scenarios**:

1. **Given** a developer with a valid GitHub connection, **when** they select an accessible repository and submit a valid task, **then** Forge displays the normalized objective, acceptance criteria, repository, base branch, agent, budget, and requested permissions before execution.
2. **Given** the reviewed task, **when** the developer starts the run, **then** Forge creates exactly one durable run and begins isolated remote execution.
3. **Given** an invalid or revoked repository connection, **when** the developer starts the run, **then** no sandbox is created and the UI explains how to reconnect safely.
4. **Given** the workspace already has an active run, **when** the developer attempts another start, **then** Forge rejects it with the stable `ACTIVE_RUN_EXISTS` result and creates neither a run nor a sandbox.

---

### User Story 2 - Monitor and control from another device (Priority: P1)

A developer starts a run on desktop, closes the browser, then opens Atoryn Forge on a phone or tablet to inspect progress, send an additional instruction, approve or reject a sensitive action, or cancel the run.

**Why this priority**: Multi-device continuity is the product's defining advantage over local-only agent workspaces.

**Independent Test**: Start a run in one browser session, disconnect, reconnect through a second viewport or device, and verify that state, event order, approvals, and controls are preserved.

**Acceptance Scenarios**:

1. **Given** an active run, **when** the original browser disconnects, **then** execution continues without losing authoritative state.
2. **Given** a second authenticated device, **when** it opens the run, **then** it receives the current state and ordered historical events before live events.
3. **Given** a pending sensitive action, **when** the developer approves or rejects it from mobile, **then** the decision is recorded once with actor, timestamp, scope, and result.
4. **Given** an active run, **when** the developer cancels it, **then** Forge transitions it to cancelling and prevents new agent work after cancellation is acknowledged.

---

### User Story 3 - Review evidence and create a pull request (Priority: P1)

After the agent finishes implementation, the developer reviews changed files, code diff, configured validation results, acceptance-criteria evidence, unresolved risks, and usage estimates. They may approve the result and create a branch and draft pull request, or reject it and request another iteration.

**Why this priority**: Atoryn Forge must produce reviewable engineering outcomes, not merely agent transcripts.

**Independent Test**: Complete a run against a fixture repository and verify that the developer can review evidence and create a draft pull request only after required checks are recorded.

**Acceptance Scenarios**:

1. **Given** a completed implementation attempt, **when** validation finishes, **then** Forge displays changed files, diff, check results, acceptance evidence, summary, risks, and usage.
2. **Given** missing constitution-mandated or task-mandatory evidence, **when** the developer attempts to approve, **then** Forge blocks approval and pull-request creation and identifies the missing evidence.
3. **Given** sufficient evidence and developer approval, **when** pull-request creation succeeds, **then** Forge records the source branch, pull-request identifier, URL reference, commit SHA, and final run outcome.
4. **Given** developer rejection, **when** they provide a new instruction, **then** Forge records the current run as completed with a rejected review outcome and creates a new run under the same task with the next iteration number, without rewriting prior instructions, events, diff, evidence, or review history.

---

### User Story 4 - Work bilingually without changing technical output (Priority: P2)

A developer uses the interface and submits a task in Vietnamese while keeping source code, branch names, commit messages, and pull-request content in English.

**Independent Test**: Submit a Vietnamese task with English technical-output preference and verify that intent remains traceable while generated engineering artifacts follow the chosen output language.

**Acceptance Scenarios**:

1. **Given** Vietnamese interface language and English technical output, **when** Forge normalizes a task, **then** both the original instruction and normalized technical version are retained.
2. **Given** a device using a different interface language, **when** the same run is opened, **then** domain state remains unchanged and only display copy changes.

## Edge Cases

- The repository is archived, empty, too large, or lacks a supported default branch.
- The GitHub installation token expires during a run.
- The sandbox starts but dependency installation exceeds the budget or time limit.
- The agent requests network access outside the current allowlist.
- Two devices answer the same approval request concurrently.
- The event stream disconnects and later resumes with duplicate or missing client-side events.
- The agent process exits while child processes remain active.
- Validation commands are absent, invalid, or intentionally not configured.
- The diff contains secrets, binary files, generated files, or changes outside the approved scope.
- Pull-request creation fails after a successful commit and push.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST authenticate a developer and protect project/run data by workspace ownership.
- **FR-002**: The system MUST support connecting a GitHub account through a GitHub App and listing only repositories accessible to that installation.
- **FR-003**: The system MUST retain the original task instruction and a normalized task containing objective, scope, acceptance criteria, constraints, and output language.
- **FR-004**: The developer MUST review repository, base branch, agent, budget, permissions, and normalized scope before starting execution.
- **FR-005**: The system MUST create one durable run with an explicit lifecycle and idempotent start behavior.
- **FR-006**: Execution MUST occur in a remote isolated sandbox with bounded duration, compute, storage, and network policy.
- **FR-007**: Repository access MUST use temporary repository-scoped credentials and MUST NOT expose long-lived provider credentials to the sandbox.
- **FR-008**: The system MUST persist ordered run events before presenting them as durable history.
- **FR-009**: A reconnecting client MUST receive a current-state snapshot plus events after a supplied cursor.
- **FR-010**: The developer MUST be able to send an additional instruction to a running or awaiting-approval run. A rejected review creates a new run iteration rather than reopening the completed run.
- **FR-011**: Sensitive actions MUST create explicit approval requests and MUST remain blocked until approved, rejected, expired, or cancelled.
- **FR-012**: Approval resolution MUST be idempotent and record actor, decision, reason, scope, and time.
- **FR-013**: The developer MUST be able to cancel a queued, provisioning, running, awaiting-approval, or validating run from any supported device.
- **FR-014**: The system MUST run configured validation commands and record command, exit status, duration, and summarized output.
- **FR-015**: The review surface MUST show changed files, readable diff, validation outcomes, acceptance evidence, agent summary, unresolved risks, and usage estimates.
- **FR-016**: Completion and approval MUST be blocked until the constitution baseline and every task-mandatory evidence item are present. Only explicitly advisory evidence MAY be waived, and each waiver MUST record actor, reason, scope, and time; a waiver MUST NOT bypass a failed or missing constitution-mandated check.
- **FR-017**: Approved results MUST be publishable to a new source branch and draft pull request without writing directly to the protected base branch.
- **FR-018**: A rejected review MUST finalize the current run as unpublished and MAY create exactly one next run iteration for the same task after a new instruction is supplied; all prior instructions, events, diffs, evidence, and review decisions MUST remain immutable.
- **FR-019**: Interface locale and technical-output language MUST be independently configurable as Vietnamese or English.
- **FR-020**: The MVP MUST support exactly one active Codex run per workspace. Additional starts while a run is active MUST be rejected deterministically with `ACTIVE_RUN_EXISTS`; the MVP MUST NOT silently queue them.
- **FR-021**: The system MUST expose a provider-neutral domain boundary even though the first implementations are GitHub, Codex, and one sandbox provider.
- **FR-022**: The system MUST redact known secret patterns from persisted logs and user-facing event payloads.

### Non-Functional Requirements

- **NFR-001**: Core pages MUST remain usable at desktop, tablet, and mobile viewport sizes.
- **NFR-002**: Run state MUST survive browser closure, server process restart, and transient event-stream disconnection.
- **NFR-003**: Duplicate start, cancel, approval, and publish requests MUST be safe and idempotent.
- **NFR-004**: Authorization decisions MUST be enforced server-side and never rely only on hidden UI controls.
- **NFR-005**: New domain and boundary code MUST use strict TypeScript and schema validation.
- **NFR-006**: Security-sensitive failures MUST fail closed and produce an auditable error event.

## Key Entities

- **Workspace**: Security and ownership boundary for projects, integrations, budgets, and users.
- **Project**: Atoryn representation of a source repository and its configuration.
- **Provider Connection**: User-authorized connection to an external source, agent, or sandbox provider.
- **Task**: Developer intent, normalized scope, acceptance criteria, constraints, and lifecycle across iterations.
- **Run**: One durable remote execution attempt with agent, sandbox, budget, state, and timestamps.
- **Run Event**: Ordered persisted fact describing progress, command, message, approval, error, or result.
- **Approval Request**: Sensitive proposed action and the developer's governed decision.
- **Validation Result**: Recorded evidence for build, test, lint, type-check, or project-defined command.
- **Change Set**: Files, diff metadata, commit information, and scope classification for an iteration.
- **Review Decision**: Developer approval, rejection, waiver, or cancellation with rationale.
- **Publication**: Source branch and draft pull-request outcome produced from an approved change set.

## Success Criteria

- **SC-001**: A developer can start one governed run from a connected repository and receive the first durable progress event within 30 seconds, excluding provider outages and repository clone time.
- **SC-002**: A run started on desktop can be inspected and controlled from a mobile viewport without losing state or event history.
- **SC-003**: 100% of sensitive actions in acceptance tests require a persisted approval decision before execution.
- **SC-004**: 100% of approved pull requests in acceptance tests are linked to recorded diff and validation evidence.
- **SC-005**: Repeated delivery of the same start, cancel, approval, or publish request does not create duplicate runs, decisions, commits, or pull requests.
- **SC-006**: No long-lived provider credential appears in sandbox environment dumps, persisted event payloads, or user-visible logs during security tests.
- **SC-007**: Vietnamese instructions remain accessible alongside their normalized technical representation and can produce English engineering artifacts.

## Assumptions

- The existing CycleWarden monorepo and deterministic lifecycle/evidence code are retained and reused where they satisfy this specification.
- GitHub is the only source provider in this feature, but domain types remain provider-neutral.
- Codex is the only coding-agent adapter in this feature.
- One remote sandbox provider is selected during planning.
- The first supported repositories are JavaScript/TypeScript projects with explicit package-manager commands.
- The MVP rejects, rather than queues, a second run while the workspace has an active run.
- Production deployment, arbitrary MCP installation, skill installation, multi-agent execution, and team collaboration are outside this feature.

## Out of Scope

- Native mobile or desktop applications.
- No-code or visual application generation.
- GitLab, Bitbucket, and Atoryn-managed repositories.
- Multiple simultaneous agents or autonomous swarms.
- Production deployment or destructive production database operations.
- User-installable skills and arbitrary MCP servers.
- Marketplace, billing, team collaboration, and organization administration.
