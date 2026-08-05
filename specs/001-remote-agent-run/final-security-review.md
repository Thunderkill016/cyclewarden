# Atoryn Forge final security review

**Reviewed**: 2026-08-05  
**Scope**: workspace authorization, replay protection, credentials/secrets, network boundaries, publication invariants, sandbox cleanup, and operational evidence

## Required threat coverage

| Threat | Enforced boundary | Automated evidence | Result |
|---|---|---|---|
| Cross-workspace access | Every durable project/task/run/approval/review/publication query is scoped through membership and workspace identity. | `packages/forge-application/src/persistence/cross-workspace-authorization.integration.test.ts` plus PostgreSQL Playwright isolation acceptance. | Pass |
| Request/event replay | Request hashes bind idempotency keys to canonical input; durable provider correlations replay the original event and reject conflicting payloads; GitHub publication reuses only an exact branch/draft PR. | `postgres-idempotency-repository.integration.test.ts`, `postgres-live-provider-event-sink.integration.test.ts`, `github-source-provider.test.ts`. | Pass |
| Secret leakage | Redaction occurs before persistence/logging; credential-shaped command environment is rejected; telemetry redacts attributes before sink writes; GitHub tokens are callback-scoped. | `security/redaction.test.ts`, `vercel-sandbox-provider.test.ts`, `forge-operational-telemetry.test.ts`, `github-credential-broker.test.ts`. | Pass |
| Expired or over-scoped token | Repository grant is checked before signing; token response must contain exactly one repository, exact permissions, and an allowed short lifetime. | `github-credential-broker.test.ts` covers inactive grants, broader/missing permissions, expired and overlong credentials, and absence of private-key material. | Pass |
| Denied network | Sandbox creation defaults to deny-all; only normalized public hosts are allowed; private/malformed destinations and secret environment injection fail before provider execution. | `vercel-sandbox-provider.test.ts` plus hostile Docker sandbox proof in repository CI. | Pass |
| Direct base-branch write | Publication requires a distinct working branch, exact reviewed SHA, draft PR, and immutable base reference. | `github-source-provider.test.ts`, fake-provider publication recovery tests, and protected disposable-repository live contract harness. | Pass |
| Incomplete sandbox cleanup | Bootstrap failure destroys immediately; terminal completed/failed/expired/cancelled paths stop and destroy the sandbox and remove registry state. | `vercel-sandbox-provider.test.ts` and `vercel-sandbox-cleanup.test.ts`. | Pass |

## Operational visibility

`ForgeOperationalTelemetry` emits structured records and metric points for:

- run state transitions;
- provider request count, latency, outcome, and stable failure code;
- approval decisions;
- sandbox cleanup count, latency, outcome, and reason;
- general operational failures.

Telemetry attributes are passed through domain secret redaction before the sink receives them. High-cardinality or secret data is not used as metric dimensions.

## Publication and evidence review

Publication remains fail-closed unless all mandatory validation/evidence is current, the immutable snapshot is explicitly approved, and the source provider confirms the exact head SHA. The system never automatically merges. Provider cursors cannot replace the application-owned durable sequence.

## Residual external-validation risk

The implementation boundaries and deterministic tests are complete. Three live-spike evidence tasks remain intentionally open:

- T078: successful protected GitHub run against an explicitly disposable repository;
- T079: successful protected Vercel Sandbox/Codex deterministic smoke run;
- T080: reviewed real timing, usage, cancellation, and cleanup measurements.

Those tasks require external disposable infrastructure and protected environment credentials. Their absence is recorded as an evidence gap, not converted into a passing claim.

## Decision

**PASS FOR IMPLEMENTATION SECURITY.** No unresolved CRITICAL or HIGH implementation finding was identified. Feature-level live-provider acceptance remains conditional on T078-T080 evidence.
