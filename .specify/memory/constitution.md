<!--
Sync Impact Report
- Version change: none -> 1.0.0
- Added principles: Web-First Control Plane; Developer-First Product; Provider-Neutral Core; Durable Remote Execution; Human-Governed Risk; Evidence-Based Completion; Auditable Runs; Bilingual Product Boundary; Open Extension Model; Incremental Full-Stack Delivery
- Added sections: Platform Constraints; Delivery Workflow; Governance
- Template propagation: official Spec Kit v0.8.15 Codex skills, templates, scripts, manifests, bundled workflow, and Git extension synchronized on 2026-08-04.
-->

# Atoryn Forge Constitution

## Core Principles

### I. Web-First Control Plane
Atoryn Forge MUST be usable through a responsive web interface on desktop, tablet, and mobile. Long-running work MUST execute on server-owned infrastructure and MUST continue when a browser disconnects. A user MUST be able to reconnect from another device and recover the current run state without replaying the run.

### II. Developer-First Product
Atoryn Forge is a control plane for software developers coordinating coding agents. It MUST expose enough technical evidence for informed engineering decisions, including task scope, commands, changed files, validation results, approvals, and source-control outcomes. It MUST NOT be designed as a no-code application generator.

### III. Provider-Neutral Core
Core domain models MUST NOT depend directly on one coding agent, source provider, sandbox provider, MCP server, database platform, or deployment platform. External systems MUST be integrated through typed adapters with provider-specific behavior isolated behind explicit contracts.

### IV. Durable Remote Execution
Every coding-agent run MUST have durable server-side state, an isolated execution environment, bounded time and resource budgets, repository-scoped access, and an explicit lifecycle. Long-lived credentials MUST NOT be exposed to agents or persisted in run logs.

### V. Human-Governed Risk
Production deployment, destructive data changes, protected-branch writes, secret access, unrestricted network access, privilege expansion, and budget increases MUST require explicit human approval. Denial, cancellation, timeout, or lost authorization MUST fail closed.

### VI. Evidence-Based Completion
An agent claim is never sufficient evidence of completion. A task MAY be marked complete only when the system records the code diff, configured build/test/lint/type-check results, acceptance-criteria evidence, unresolved risks, and the developer's final decision.

### VII. Auditable Runs
Every run MUST record ordered, immutable-enough audit events for instructions, agent messages, tool calls, commands, file changes, approvals, validation results, costs, errors, and final outcome. Audit history MUST remain available after the sandbox is destroyed.

### VIII. Bilingual Product Boundary
The interface and user workflows MUST support Vietnamese and English. Interface language, user instruction language, and technical output language MUST be modeled separately so a Vietnamese task can produce English code, commits, documentation, and pull requests without losing intent.

### IX. Open Extension Model
Skills, MCP servers, coding agents, source providers, deployment providers, database providers, and custom workflows MUST be user-selectable extensions. Spec Kit governs development of Atoryn Forge itself but MUST NOT be mandatory for projects later operated through Atoryn Forge.

### X. Incremental Full-Stack Delivery
Atoryn Forge MUST support full-stack workflows, including frontend, backend, data, authentication, testing, infrastructure, and deployment integrations, without hard-coding a single stack. Delivery MUST proceed through independently verifiable vertical slices. Multi-agent swarms, marketplaces, visual builders, and broad provider support MUST NOT precede proof of the single-agent remote execution loop.

## Platform Constraints

- TypeScript MUST use strict mode for new application and domain code.
- System boundaries MUST validate untrusted input with explicit schemas.
- Agent, source, and sandbox providers MUST be represented by typed interfaces.
- Server-side run state MUST be authoritative; browser state is a projection only.
- Secrets MUST be stored through a dedicated secret-management boundary and redacted from logs.
- Source code remains in a user-selected source provider; GitHub is the first supported provider, not a permanent domain assumption.
- Every sensitive operation MUST carry a reason, scope, actor, expiration, and approval state.
- Responsive behavior and keyboard accessibility MUST be acceptance criteria for user-facing features.

## Delivery Workflow

Every production feature MUST follow the Spec Kit path:

1. Constitution compliance review.
2. User-centered specification defining what and why.
3. Clarification of material ambiguity.
4. Technical plan with provider boundaries and security model.
5. Requirements-quality checklist.
6. Dependency-ordered implementation tasks.
7. Cross-artifact consistency analysis.
8. Incremental implementation with tests and evidence.
9. Convergence review against specification and acceptance criteria.

Pull requests MUST state the affected specification, constitution impact, validation evidence, known risks, and rollback path. Complexity beyond the smallest viable vertical slice MUST be justified in the plan.

## Governance

This constitution supersedes conflicting project documents for the Atoryn Forge direction. Amendments require a documented rationale, affected-principle analysis, migration impact, and semantic version change. MAJOR versions remove or redefine governing principles, MINOR versions add or materially expand principles, and PATCH versions clarify wording without changing obligations.

Every specification, plan, task list, implementation review, and release decision MUST verify constitution compliance. Non-compliance MUST be corrected or explicitly documented as a temporary exception with owner, expiry date, and remediation task.

**Version**: 1.0.0 | **Ratified**: 2026-08-04 | **Last Amended**: 2026-08-04
