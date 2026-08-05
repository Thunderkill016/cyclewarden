# Atoryn Forge

**A governed web platform for delegating software work to remote AI coding agents.**

Atoryn Forge turns a developer request into a controlled remote run:

```text
repository + task
→ reviewed execution policy
→ isolated sandbox
→ governed coding-agent session
→ ordered events and approvals
→ objective validation evidence
→ human review
→ exact-head draft pull request
```

The repository was previously developed as **CycleWarden**, an experimental trusted-local workflow. That local workflow is now frozen as technical evidence. The active product direction is Atoryn Forge: a provider-neutral, bilingual, web-operated system that can continue a run from another device while preserving human control over sensitive actions and publication.

## Current implementation

The repository contains an end-to-end Forge foundation:

- provider-neutral domain contracts for source control, coding agents, and sandboxes;
- durable PostgreSQL state, idempotency, optimistic concurrency, ordered event projection, and reconciliation;
- authenticated repository/task/run creation;
- desktop and mobile run monitoring with reconnectable event streams;
- additional instructions, approvals, rejection, cancellation, and next-iteration flows;
- immutable evidence snapshots, redacted unified diffs, validation results, and explicit review decisions;
- exact-head, draft-only, idempotent publication rules;
- separate Vietnamese interface/instruction language and English technical-output controls;
- GitHub App source-provider, webhook reconciliation, and repository-scoped credential brokerage;
- ephemeral Vercel Sandbox provider with deny-by-default networking and resource ceilings;
- resumable Codex app-server provider with approvals, cancellation, event streaming, and usage summaries;
- versioned provider-event normalization and durable replay protection;
- protected live-provider contract and smoke-test harnesses.

The deterministic fake-provider workflow and PostgreSQL Playwright acceptance tests are complete. Protected live GitHub and Vercel/Codex workflows exist, but their tasks remain evidence-gated until successful runs are recorded with disposable infrastructure and real environment credentials.

## Product boundaries

Atoryn Forge is deliberately governed:

- it never merges a pull request automatically;
- it never writes directly to the base branch;
- sensitive actions require explicit policy or approval;
- provider credentials are short-lived and repository-scoped where supported;
- sandbox network access is denied unless explicitly allowed;
- application event sequence is owned by Atoryn, not by provider cursors;
- evidence must match the current immutable change snapshot before publication;
- secrets are redacted before logs, events, reviews, or evidence are persisted.

PWA metadata makes the web application installable, but the project does **not** claim offline execution. Remote runs, approvals, event recovery, and publication require server and provider connectivity.

## Repository layout

| Path | Responsibility |
| --- | --- |
| `packages/forge-domain/` | Provider-neutral contracts, policies, state machine, completion gate, and redaction |
| `packages/forge-application/` | Orchestration, persistence boundaries, reconciliation, event normalization, and telemetry |
| `packages/provider-github/` | GitHub App source provider, webhooks, credential brokerage, and live contract harness |
| `packages/provider-sandbox-vercel/` | Ephemeral Vercel Sandbox lifecycle and security policy |
| `packages/provider-codex/` | Governed Codex app-server adapter |
| `apps/web/` | Authenticated Forge interface, API routes, responsive controls, evidence review, and E2E tests |
| `specs/001-remote-agent-run/` | Active Forge specification, plan, task ledger, and live-spike evidence |
| `packages/evolution-core/` | Frozen CycleWarden research and trusted-local delivery mechanisms |

## Development

### Prerequisites

- Node.js 20 or later
- pnpm 9.15
- PostgreSQL 16 for durable integration and E2E tests
- Docker for hostile-sandbox proof workflows
- external credentials only for protected opt-in live-provider workflows

### Install and verify

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm check:ai
```

### Run the web application

```bash
pnpm db:up
pnpm db:migrate
pnpm dev
```

Open the authenticated Forge area at `/app/forge`.

## Live-provider validation

Live workflows are manual and protected:

- `Forge live GitHub contract` targets only a repository explicitly designated as disposable and cleans up its draft pull request and branch;
- `Forge live sandbox Codex smoke` creates a non-persistent Vercel Sandbox, runs a deterministic Codex repair task, validates it independently, records timing/usage evidence, and destroys the sandbox.

Harness code is not treated as proof. The live task ledger remains open until the protected workflow artifacts are reviewed and recorded in `specs/001-remote-agent-run/live-spike-results.md`.

## Frozen CycleWarden material

The previous CycleWarden practical-validation direction is retained for history and reuse:

- [`PRACTICAL_SCOPE.md`](PRACTICAL_SCOPE.md)
- [`docs/practical/TASK_RECORD_TEMPLATE.md`](docs/practical/TASK_RECORD_TEMPLATE.md)
- [`docs/evolution/GOVERNED_DELIVERY.md`](docs/evolution/GOVERNED_DELIVERY.md)
- [`docs/RENAMING_FROM_SHIPKIT.md`](docs/RENAMING_FROM_SHIPKIT.md)

These documents describe the frozen trusted-local experiment. They are not the active Atoryn Forge roadmap.

## Active specification

Start with:

- [`specs/001-remote-agent-run/spec.md`](specs/001-remote-agent-run/spec.md)
- [`specs/001-remote-agent-run/plan.md`](specs/001-remote-agent-run/plan.md)
- [`specs/001-remote-agent-run/tasks.md`](specs/001-remote-agent-run/tasks.md)
- [`specs/001-remote-agent-run/live-spike-results.md`](specs/001-remote-agent-run/live-spike-results.md)

## License

Distributed under the MIT License. See [`LICENSE`](LICENSE).
