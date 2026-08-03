# Implementation Plan: Remote Agent Run

**Branch**: `agent/atoryn-forge-spec-foundation` | **Date**: 2026-08-04 | **Spec**: `specs/001-remote-agent-run/spec.md`

## Summary

Extend the existing CycleWarden monorepo into the first Atoryn Forge vertical slice: a responsive web control plane that starts one Codex run in a remote sandbox, persists its lifecycle and event history, allows approval/cancellation from another device, verifies the resulting change, and publishes an approved branch as a draft GitHub pull request.

The implementation reuses the existing Next.js web application, deterministic lifecycle/evidence core, delivery progress events, cancellation controls, authentication, database, i18n, and verification capabilities. New provider-specific behavior is isolated behind typed source, agent, and sandbox adapters.

## Technical Context

**Language/Version**: TypeScript 5, Node.js 20+  
**Web**: Existing Next.js 15 / React 19 application in `apps/web`  
**Monorepo**: pnpm 9 workspaces (`apps/*`, `packages/*`)  
**Persistence**: Existing PostgreSQL access through Drizzle; Supabase may host Atoryn platform data but domain code remains standard PostgreSQL/Drizzle  
**Authentication**: Existing Better Auth and Supabase SSR integration, adapted to workspace ownership  
**Validation**: Zod at external and IPC/API boundaries  
**Realtime**: Persisted event log plus Server-Sent Events; polling fallback for recovery  
**Source Provider**: GitHub App through `SourceProvider`; repository-scoped short-lived installation token  
**Coding Agent**: Codex app-server/SDK through `CodingAgentProvider`  
**Execution**: Vercel Sandbox spike through `SandboxProvider`; no provider API in core domain types  
**Testing**: Vitest for domain/services; Playwright for desktop/mobile cross-session flow; provider contract tests with fakes  
**Target Platform**: Responsive web and installable PWA-compatible shell; no native application  
**Initial Repository Support**: JavaScript/TypeScript repositories with package-manager validation commands  
**Performance Goal**: Durable start acknowledgement within 2 seconds and first run-progress event within 30 seconds excluding external clone/provider delay  
**Constraints**: One active run per workspace; a second start is rejected with `ACTIVE_RUN_EXISTS`; one agent provider, one source provider, one sandbox provider, no production deployment

## Constitution Check

| Principle | Plan compliance |
|---|---|
| Web-First Control Plane | Server-owned run lifecycle; responsive desktop/tablet/mobile UI; reconnect by cursor |
| Developer-First Product | Exposes scope, commands, events, changed files, validation, diff, approvals, and PR outcome |
| Provider-Neutral Core | Typed `SourceProvider`, `CodingAgentProvider`, and `SandboxProvider`; provider IDs stored separately |
| Durable Remote Execution | Database-backed run/event state, sandbox lease, limits, heartbeat, cancellation, recovery |
| Human-Governed Risk | Approval policy engine blocks sensitive actions; idempotent approve/reject endpoints |
| Evidence-Based Completion | Constitution baseline and task-mandatory evidence cannot be waived; advisory evidence waivers are explicit and audited |
| Auditable Runs | Append-only ordered run events retained after sandbox destruction |
| Bilingual Product Boundary | Existing i18n package reused; locale and technical-output language stored separately |
| Open Extension Model | No Spec Kit dependency in runtime domain; first adapters are replaceable |
| Incremental Full-Stack Delivery | One-agent vertical slice only; no swarm, marketplace, arbitrary MCP, or production deployment |

**Gate result**: PASS. No constitution exception is required for planning.

## Architecture

```text
apps/web
  responsive project/task/run/review surfaces
       |
       v
Run Application Service
  authorization + idempotency + lifecycle transitions
       |
       +--> SourceProvider (GitHub adapter)
       +--> CodingAgentProvider (Codex adapter)
       +--> SandboxProvider (Vercel adapter)
       +--> Approval Policy
       +--> Verification/Evidence Core
       |
       v
PostgreSQL durable state + ordered run events
       |
       +--> SSE projection to any connected device
```

### Domain boundaries

1. **Run domain** owns legal states, events, iterations, cancellation, approvals, and completion gates.
2. **Provider adapters** translate Atoryn contracts into GitHub, Codex, and sandbox operations.
3. **Credential broker** issues or retrieves short-lived credentials and never returns long-lived secrets to the web client or agent prompt.
4. **Event projector** persists facts before streaming them to clients.
5. **Review service** combines change-set metadata, validation results, acceptance evidence, and developer decision.
6. **Publication service** creates an isolated branch and draft pull request only from an approved change set.

## Run State Machine

```text
DRAFT
  -> QUEUED
  -> PROVISIONING
  -> RUNNING
  -> AWAITING_APPROVAL
  -> RUNNING
  -> VALIDATING
  -> AWAITING_REVIEW

Approved review:
AWAITING_REVIEW
  -> PUBLISHING
  -> COMPLETED

Rejected review:
AWAITING_REVIEW
  -> COMPLETED (unpublished, review outcome = rejected)
  -> explicit new instruction creates Run(iteration + 1) in QUEUED

Terminal alternatives:
FAILED | CANCELLED | EXPIRED

Transitional cancellation:
QUEUED | PROVISIONING | RUNNING | AWAITING_APPROVAL | VALIDATING
  -> CANCELLING
  -> CANCELLED | FAILED
```

State transitions MUST be executed through one domain service and guarded by optimistic concurrency/version checks. A completed run is never reopened. A new iteration is a new `Run` with the same `taskId` and the next unique iteration number. Creating that iteration and enforcing the workspace active-run limit MUST occur atomically.

## Active-Run Admission Policy

- The MVP has `activeRunLimit = 1` per workspace.
- Active states are `queued`, `provisioning`, `running`, `awaiting_approval`, `cancelling`, `validating`, `awaiting_review`, and `publishing`.
- A start request while another run is active returns the stable `ACTIVE_RUN_EXISTS` result.
- The rejected request creates no run, sandbox lease, provider call, or queued work.
- Duplicate delivery of the same accepted start request replays the original result through the idempotency record.

## Evidence and Waiver Policy

The completion gate classifies evidence into two groups:

1. **Mandatory evidence**: constitution baseline plus task-declared required checks and acceptance evidence. Missing or failed mandatory evidence blocks approval and publication and cannot be waived.
2. **Advisory evidence**: optional diagnostics or non-blocking checks. An advisory item may be waived only with actor, reason, scope, and timestamp recorded in the review decision and audit events.

The completion gate evaluates an immutable evidence snapshot. A later file change or validation result makes the previous review snapshot stale and requires a new review.

## Project Structure

```text
apps/web/
  app/
    (forge)/projects/
    api/forge/
  components/forge/
  lib/forge/

packages/
  evolution-core/          # reuse deterministic lifecycle/evidence primitives where valid
  forge-domain/            # new provider-neutral task/run/approval/review domain
  forge-application/       # use cases, authorization, idempotency, orchestration
  forge-events/            # durable event contracts and SSE projection
  provider-github/         # GitHub App source adapter
  provider-codex/          # Codex agent adapter
  provider-sandbox-vercel/ # first sandbox adapter
  db/                      # existing persistence package extended with Forge schema
  i18n/                    # existing locale resources extended

specs/001-remote-agent-run/
  spec.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  checklists/requirements.md
  analysis.md
  tasks.md
```

Exact package creation MAY be reduced if existing package boundaries already satisfy dependency direction. Core/domain code MUST NOT import provider packages or Next.js modules.

## API Surface

Minimum server endpoints or equivalent server actions:

- `POST /api/forge/projects/connect-github`
- `GET /api/forge/repositories`
- `POST /api/forge/tasks`
- `POST /api/forge/runs`
- `GET /api/forge/runs/:runId`
- `GET /api/forge/runs/:runId/events?after=` (SSE)
- `POST /api/forge/runs/:runId/instructions`
- `POST /api/forge/runs/:runId/cancel`
- `POST /api/forge/approvals/:approvalId/resolve`
- `POST /api/forge/runs/:runId/review`
- `POST /api/forge/runs/:runId/publish`

All mutations require idempotency keys and workspace authorization. Provider callbacks require signature verification.

## Security Design

- GitHub App private key remains in the Atoryn credential boundary.
- Sandbox receives only a short-lived, repository-scoped credential when cloning/pushing is necessary.
- Sandbox network starts deny-by-default and expands only through explicit policy.
- Agent tool/command requests are classified before execution.
- Secret-like values are redacted before event persistence and again before presentation.
- Approval links never authorize action by possession alone; authenticated workspace membership is required.
- Base-branch direct writes and production deployment are prohibited in this feature.
- Sandbox lease, run heartbeat, and cleanup jobs handle abandoned work.

## Realtime and Recovery

1. Every material state change is committed with a monotonic per-run sequence number.
2. SSE sends events only after commit.
3. A client reconnects with the last seen sequence/cursor.
4. The server first returns current run snapshot, then missing events, then live events.
5. Duplicate client events are ignored by sequence; duplicate mutation requests are handled by idempotency key.
6. A background reconciler detects stale leases, missing heartbeats, expired approvals, and partially completed publication.

## Validation Strategy

- **Unit**: state transitions, rejected-review iteration creation, active-run admission, approval classification, budget rules, event ordering, redaction, completion gate, mandatory/advisory waiver rules.
- **Contract**: fake implementations verify source/agent/sandbox adapter contracts.
- **Integration**: database transaction and idempotency tests; SSE reconnect; credential-broker boundaries.
- **End-to-end**: desktop starts run, mobile reconnects and resolves approval, validation completes, desktop reviews and creates draft PR.
- **Security**: cross-workspace access, replayed approval, duplicate publish, secret in command output, expired token, sandbox escape simulation.

## Delivery Phases

1. Domain model and durable state.
2. Provider contracts and fake adapters.
3. GitHub connection and repository selection.
4. Sandbox + Codex execution spike.
5. Event feed, reconnect, cancellation, and approval.
6. Validation, diff, review, and publication.
7. Responsive/mobile hardening and bilingual copy.
8. Final evidence review against the specification.

## Deferred Decisions

- Final production sandbox provider after the Vercel spike is benchmarked.
- Managed model billing versus user-provided credentials.
- Arbitrary MCP/skill installation.
- Concurrent runs and multi-agent scheduling.
- GitLab/Bitbucket adapters.
- Production deployment integrations.
