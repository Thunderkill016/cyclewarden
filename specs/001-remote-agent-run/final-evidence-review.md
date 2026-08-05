# Atoryn Forge final specification-to-implementation evidence review

**Reviewed**: 2026-08-05  
**Feature**: `001-remote-agent-run`

## User-story evidence

| Area | Implementation evidence | Acceptance evidence | Status |
|---|---|---|---|
| Provider-neutral foundation | Forge domain/application packages, state machine, completion gate, approval policy, redaction, provider contracts, deterministic fakes | Domain and application unit/integration suites from PRs #71-#72 | Complete |
| Durable lifecycle | PostgreSQL schema/repositories, ordered events, optimistic concurrency, idempotency, reconciliation, workspace-scoped queries | PostgreSQL integration tests and isolation proof from PR #73 | Complete |
| US1 governed run start | Authenticated Forge route/action, repository selector, bilingual task composer, reviewed policy and durable run admission | Component tests and authenticated PostgreSQL Playwright flow from PR #74 | Complete |
| US2 reconnect and control | Snapshot/SSE recovery, command service, approvals, cancellation, responsive command center | Replay/race tests and cross-context desktop-to-mobile Playwright flow from PR #75 | Complete |
| US3 evidence and publication | Validation/evidence persistence, immutable change set, redacted diff, completion gate, approval/rejection and exact-head publication | Completion/recovery tests and reject-next-iteration-approve-draft-PR Playwright flow from PR #76 | Complete |
| US4 bilingual traceability | Separate interface, instruction, and technical-output language controls; original and normalized instruction trace | Locale isolation, Vietnamese normalization and PostgreSQL-backed acceptance from PR #78 | Complete |
| Live GitHub implementation | GitHub source provider, signed webhooks, installation reconciliation, repository-scoped credential broker, normalized events | Unit/integration CI plus protected disposable-repository contract harness from PRs #79-#85 | Implementation complete; live evidence pending T078 |
| Live sandbox/Codex implementation | Ephemeral Vercel Sandbox lifecycle/policy, governed Codex app-server adapter, normalized durable event sink | Unit/integration CI plus protected deterministic live smoke harness from PRs #82-#86 | Implementation complete; live evidence pending T079-T080 |
| Final hardening | PWA metadata, responsive fixes/regressions, security mapping, terminal cleanup matrix, structured telemetry, active-product documentation | Final repository CI and browser acceptance required by T087 | Pending final CI |

## Specification coverage decision

Every functional and non-functional requirement has an implementation task and concrete code/test/document target. The final review found no missing implementation task that must be appended to the ledger.

The only remaining gaps are external acceptance evidence already represented by T078-T080:

1. a disposable GitHub repository and scoped live token;
2. protected Vercel/OpenAI environment credentials;
3. successful artifacts containing real usage/timing/cancellation/cleanup measurements.

No new task number is added because these are not newly discovered requirements; they are the explicit acceptance conditions of existing tasks.

## Evidence integrity

- Unit or fake-provider results are not relabeled as live-provider success.
- CI success proves implementation checks, not external provider availability or product-market value.
- Timing, token usage, and cleanup measurements remain pending until produced by protected live workflows.
- The production repository is prohibited as the disposable GitHub target.
- External credentials and private-key material must not appear in commits, logs, events, or artifacts.

## Merge readiness rule

The implementation may merge after T081-T090 deterministic verification passes, while T078-T080 remain visibly open and block the stronger claim that the complete live-provider checkpoint has passed.
