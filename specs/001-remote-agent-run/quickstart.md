# Quickstart: Remote Agent Run Development

This guide validates the first Atoryn Forge vertical slice in the existing CycleWarden monorepo.

## Prerequisites

- Node.js 20 or later
- pnpm 9.15.0
- PostgreSQL available through the repository's existing database configuration
- A GitHub App test installation with access to one non-production test repository
- Codex credentials for a non-production test account
- Sandbox-provider test credentials

Never use production repositories, production secrets, or destructive production integrations while developing this feature.

## Install and verify the existing repository

```bash
pnpm install
pnpm ready
pnpm typecheck
pnpm test
pnpm build
```

Record existing failures before changing code. Do not weaken an existing check to make the feature pass.

## Active Spec Kit feature

The active feature is stored in:

```text
.specify/feature.json
```

Expected value:

```json
{
  "feature_directory": "specs/001-remote-agent-run"
}
```

Run the full Spec Kit quality path before implementation when the official CLI and Codex skills are installed locally:

```text
$speckit-clarify
$speckit-plan
$speckit-checklist
$speckit-tasks
$speckit-analyze
$speckit-implement
```

The committed artifacts are the source of truth even when commands are unavailable in a particular environment.

## Local environment boundaries

Create test-only environment variables using the repository's documented secret mechanism. Required logical values are:

```text
DATABASE_URL
ATORYN_ENCRYPTION_KEY or secret-manager connection
GITHUB_APP_ID
GITHUB_APP_PRIVATE_KEY
GITHUB_APP_WEBHOOK_SECRET
CODEX_PROVIDER_CREDENTIAL_REFERENCE
SANDBOX_PROVIDER_CREDENTIAL_REFERENCE
APP_BASE_URL
```

Provider credentials MUST be read by server-only code. They MUST NOT be prefixed for browser exposure, returned from API routes, copied into task prompts, or persisted in run events.

## Development sequence

### 1. Implement the provider-neutral domain

Start with fake providers and no live external calls:

- task normalization data structures;
- run state machine;
- run events;
- approval requests;
- idempotency records;
- validation/evidence completion gate;
- review and publication preconditions.

Run focused unit tests before continuing.

### 2. Add durable persistence and recovery

Create migrations for the entities in `data-model.md`, then implement:

- transactional state transition plus event append;
- monotonic per-run event sequence;
- optimistic concurrency;
- reconnect by event cursor;
- stale-run reconciliation;
- secret redaction before event persistence.

Test duplicate start, cancel, approval, and publish requests.

### 3. Build the responsive web surfaces with fake providers

Required surfaces:

1. Connect/select repository.
2. Create and review task.
3. Start run with budget and permission summary.
4. Durable chronological activity feed.
5. Approval detail and resolve action.
6. Cancel and additional-instruction controls.
7. Diff, validation, evidence, risk, and usage review.
8. Approve/reject and draft-PR publication result.

Test at desktop and mobile viewport sizes before live provider integration.

### 4. Integrate GitHub

Use a GitHub App and verify:

- only installation-accessible repositories are listed;
- repository selection is workspace scoped;
- temporary repository credentials expire and are repository scoped;
- branch and draft-PR creation are idempotent;
- no direct write to the base branch is possible;
- revoked installation produces a recoverable project state.

### 5. Integrate the sandbox provider

Verify:

- one sandbox per run iteration;
- bounded duration, storage, compute, and network;
- no cross-run filesystem access;
- cleanup on completion, failure, expiry, and cancellation;
- durable evidence remains after cleanup;
- only short-lived credentials enter the sandbox.

### 6. Integrate Codex

Normalize provider events into Atoryn run events. Verify:

- start and resume;
- additional instructions;
- approval requests;
- cancellation;
- provider/process failure;
- redaction;
- final summary and usage extraction.

### 7. Connect validation, review, and publication

Use the selected repository's validation profile to run configured checks. Generate a change set only after mutation stops. Require evidence before approval. Publish only an approved evidence snapshot.

## End-to-end acceptance flow

Use one disposable JavaScript/TypeScript repository with a small deterministic task.

```text
Desktop browser
1. Sign in.
2. Connect GitHub.
3. Select the test repository.
4. Submit a Vietnamese task.
5. Keep technical output language as English.
6. Review normalized scope, budget, and permissions.
7. Start the run.

Mobile viewport or second device
8. Reconnect to the same run.
9. Confirm historical events load before live events.
10. Resolve one simulated or real approval request.
11. Send one additional instruction or inspect progress.

Desktop browser
12. Review changed files and diff.
13. Review build/test/lint/type-check evidence.
14. Approve the result.
15. Create a draft pull request.
16. Confirm branch, commit SHA, and PR are recorded.
```

## Required validation commands

At minimum before a pull request is ready for review:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm --filter @cyclewarden/web test:e2e
```

If external provider tests require credentials, keep deterministic fake-provider contract tests in the default suite and mark live-provider tests as explicit opt-in checks.

## Security verification

- Attempt cross-workspace access and expect denial.
- Replay start, approval, cancel, and publish requests with the same idempotency key.
- Send the same approval from two sessions concurrently; only one resolution may win.
- Emit a fake secret in agent output and confirm it is redacted before persistence.
- Expire the repository token during execution and confirm the run blocks or fails closed.
- Request an unapproved network domain and confirm command execution remains blocked.
- Attempt direct base-branch publication and confirm it is rejected.

## Definition of done

The feature is done only when:

- all P1 acceptance scenarios pass;
- the full desktop-to-mobile-to-PR flow passes;
- required tests and build pass;
- no long-lived credential appears in events or logs;
- the implementation has been reviewed against `spec.md`, `plan.md`, and `tasks.md`;
- known limitations and live-provider costs are documented.
