# Specification Analysis Report

**Feature**: `001-remote-agent-run`  
**Analyzed**: 2026-08-04  
**Artifacts**: `spec.md`, `plan.md`, `tasks.md`, `data-model.md`, `.specify/memory/constitution.md`  
**Method**: Spec Kit `speckit-analyze` rules applied as a read-first cross-artifact review, followed by direct remediation of all CRITICAL and HIGH findings.

## Findings

| ID | Category | Severity | Location(s) | Summary | Resolution |
|---|---|---:|---|---|---|
| C1 | Constitution alignment | CRITICAL | constitution Principle VI; spec FR-016; data model `AcceptanceEvidence` | The specification allowed mandatory evidence to be waived, which could permit completion without the evidence required by the constitution. | Split evidence into constitution, task-mandatory, and advisory classes. Constitution and task-mandatory evidence cannot be waived; advisory waivers require actor, reason, scope, time, and an immutable evidence snapshot. |
| H1 | Lifecycle inconsistency | HIGH | spec US3/FR-018; plan state machine; data model `Run` | Rejected review required another iteration, but the plan did not define whether the existing run reopened or a new run was created. | A rejected run now transitions to `completed` with `reviewOutcome = rejected`, remains unpublished, and is immutable. A new instruction creates a new `Run` with the next iteration number. |
| H2 | Requirement ambiguity | HIGH | spec FR-020; plan constraints; tasks T022/T043 | The MVP allowed either rejecting or queueing a second active run, leaving core admission behavior undefined. | The MVP now rejects a second start with stable result `ACTIVE_RUN_EXISTS` and creates no run, queue entry, sandbox, or provider side effect. |
| H3 | Cancellation ambiguity | HIGH | spec FR-013; plan state machine | “Active or blocked” did not enumerate cancellable states, risking inconsistent terminal behavior across adapters. | Cancellable states are explicitly `queued`, `provisioning`, `running`, `awaiting_approval`, and `validating`; the state machine owns the transition through `cancelling`. |
| M1 | Task granularity | MEDIUM | tasks T018, T023, T028 | Several tasks grouped multiple use cases or directories without exact files, weakening independent completion evidence. | Phase 2 and 3 tasks were refined to name concrete files and explicit behaviors while retaining task numbering. |
| M2 | Evidence freshness | MEDIUM | spec FR-016; plan review flow | Approval did not explicitly bind to an immutable evidence snapshot, allowing a later mutation to invalidate the reviewed result. | Review decisions now reference an evidence snapshot; later file or validation changes make the prior review stale. |
| L1 | Terminology | LOW | plan and tasks | “Iteration” could mean reopening a run or creating a new run. | `Run.iteration` is now explicitly a unique per-task sequence, and every new iteration is a new run record. |

## Coverage Summary

| Requirement area | Covered by tasks | Primary tasks | Notes |
|---|---|---|---|
| Authentication and workspace ownership | Yes | T021, T037, T038, T042 | Server-side authorization remains mandatory. |
| Provider-neutral domain | Yes | T009-T012, T027 | No provider imports are allowed in domain code. |
| Run lifecycle and active-run limit | Yes | T013, T017, T022, T028-T029 | Includes rejected-review iteration and `ACTIVE_RUN_EXISTS`. |
| Sensitive approvals | Yes | T015, T018, T023, T051, T053 | Approval resolution is idempotent and scope-bound. |
| Completion evidence | Yes | T014, T018, T055-T060, T063 | Mandatory evidence cannot be waived. |
| Redaction and credential safety | Yes | T016, T019, T057, T073, T083 | Redaction occurs before persistence and presentation. |
| Durable events and reconnect | Yes | T031-T035, T046-T054 | Persisted history precedes live events. |
| Review and publication | Yes | T023, T029, T055-T065 | Publication requires approved current evidence. |
| Bilingual workflow | Yes | T066-T070 | Original and normalized instructions remain traceable. |
| Responsive UX | Yes | T039-T049, T058-T059, T081-T082 | Desktop, tablet, and mobile acceptance remains explicit. |

## Metrics

- Functional requirements: 22
- Non-functional requirements: 6
- Implementation tasks: 90
- CRITICAL findings before remediation: 1
- HIGH findings before remediation: 3
- Remaining CRITICAL findings: 0
- Remaining HIGH findings: 0
- Material requirement areas with task coverage: 10 / 10

## Constitution Alignment

The remediated artifacts comply with all ten Atoryn Forge principles. In particular:

- no agent claim or advisory waiver can bypass mandatory completion evidence;
- provider-specific APIs remain outside the core domain;
- a browser is never authoritative for run state;
- sensitive actions remain blocked pending an explicit scoped decision;
- rejected work remains auditable and immutable across later iterations.

## Decision

**PASS FOR IMPLEMENTATION FOUNDATION.**

T008-T029 may begin. Live GitHub, Codex, and sandbox adapters remain blocked until the provider-neutral domain and deterministic fake-provider lifecycle pass their tests.
