# Requirements Quality Checklist: Remote Agent Run

**Purpose**: Validate completeness, clarity, consistency, and testability before implementation.  
**Created**: 2026-08-04  
**Feature**: `specs/001-remote-agent-run/spec.md`

## Scope and product boundary

- [x] The primary user is explicitly a software developer.
- [x] The product is defined as a web control plane rather than a no-code generator.
- [x] Desktop, tablet, and mobile responsibilities are represented in acceptance scenarios.
- [x] The MVP limits source, agent, sandbox, concurrency, and repository type.
- [x] Multi-agent, marketplace, arbitrary MCP/skills, production deploy, and managed Git are explicitly out of scope.
- [x] Full-stack capability is preserved as an architectural requirement without expanding the first vertical slice.

## User journeys

- [x] Starting a run has an independently testable scenario.
- [x] Browser disconnect and cross-device recovery have independently testable scenarios.
- [x] Sensitive approval and cancellation have independently testable scenarios.
- [x] Review, rejection, retry, and draft-PR publication have independently testable scenarios.
- [x] Vietnamese input and English technical output have an independently testable scenario.
- [x] Failure states for revoked connections, expired tokens, failed validation, and failed publication are included.

## Functional clarity

- [x] Every functional requirement uses MUST language and can be verified by test or inspection.
- [x] Original instruction and normalized task are distinct requirements.
- [x] Budget, permissions, repository, branch, and agent are reviewed before start.
- [x] Run start, approval, cancellation, and publication require idempotent handling.
- [x] Durable event persistence is required before presentation.
- [x] Completion evidence is enumerated.
- [x] Provider neutrality is required despite fixed MVP providers.
- [x] Base-branch direct writes are excluded.

## Security and privacy

- [x] Remote execution is isolated and resource bounded.
- [x] Long-lived credentials are prohibited from sandbox and agent context.
- [x] Repository credentials are temporary and repository scoped.
- [x] Sensitive actions require explicit human approval.
- [x] Authorization is enforced server-side.
- [x] Secret redaction is required before persistence.
- [x] Security-sensitive failures fail closed.
- [x] Cross-workspace access is covered by the test strategy.

## Durability and concurrency

- [x] Authoritative state is server-side.
- [x] Reconnect semantics include snapshot, cursor, history, and live events.
- [x] Run events have an explicit ordering requirement.
- [x] Concurrent approval resolution is covered as an edge case.
- [x] Cancellation has a transitional state and prevents new work after acknowledgement.
- [x] One active run per workspace is explicit.
- [x] Provider failure and partial publication recovery are represented in the plan.

## Evidence and review

- [x] Agent self-report is insufficient for completion.
- [x] Changed files and readable diff are required.
- [x] Build/test/lint/type-check results are required when configured.
- [x] Acceptance-criteria evidence and unresolved risks are required.
- [x] Evidence waivers require a recorded reason.
- [x] Pull-request publication is gated by developer approval of the current evidence snapshot.
- [x] Rejected iterations preserve prior evidence.

## Internationalization and accessibility

- [x] Interface locale, instruction language, and technical-output language are separate concepts.
- [x] Vietnamese and English are both represented.
- [x] Mobile behavior is not defined as a shrunken desktop layout.
- [x] Responsive usability is a non-functional requirement.
- [x] Keyboard accessibility is included in the constitution and plan.

## Measurable outcomes

- [x] First progress timing has a measurable target and external-delay qualifier.
- [x] Cross-device control has a measurable success criterion.
- [x] Sensitive action approval coverage is measurable.
- [x] Evidence-to-pull-request traceability is measurable.
- [x] Duplicate mutation safety is measurable.
- [x] Credential leakage is measurable through security tests.

## Remaining clarification before live-provider implementation

- [ ] Confirm the exact Codex integration surface selected for start/resume/approval/cancel events.
- [ ] Confirm the first sandbox provider account limits and acceptable per-run timeout.
- [ ] Confirm whether model credentials are Atoryn-managed or user-provided during the private technical spike.
- [ ] Confirm the first disposable repository used for the end-to-end acceptance test.

**Checklist result**: Requirements are ready for domain and fake-provider implementation. The four open items block live-provider rollout, not provider-neutral core work.
