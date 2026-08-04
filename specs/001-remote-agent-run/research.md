# Research: Remote Agent Run

## Decision 1: Reuse CycleWarden instead of starting a blank repository

**Decision**: Treat the existing CycleWarden monorepo as the technical foundation for Atoryn Forge.

**Rationale**: The repository already contains a Next.js web app, authentication, database packages, i18n, deterministic lifecycle/evidence logic, durable delivery progress, cancellation, verification, and draft-PR publication mechanisms. Reusing proven boundaries is faster and safer than rebuilding the same primitives.

**Alternatives considered**:

- New `atoryn-forge` repository: cleaner naming but discards working technical evidence and creates migration work before product validation.
- Extend `cw`: that repository is a narrow governance CLI/library, not the full web platform foundation.

## Decision 2: Keep Spec Kit as a development method, not a runtime dependency

**Decision**: Store Atoryn Forge specifications and plans using Spec Kit artifacts. Do not require projects operated by Atoryn Forge to use Spec Kit.

**Rationale**: Spec Kit improves requirement discipline for this product, while the product's extension model must allow users to choose their own skills and workflows.

**Alternatives considered**:

- Make Spec Kit the built-in mandatory workflow: simpler implementation but conflicts with provider and workflow neutrality.
- Do not use a specification workflow: increases the chance of rebuilding a broad platform without a verified vertical slice.

## Decision 3: Use durable persisted events plus SSE

**Decision**: Persist ordered events in PostgreSQL and project them to clients through Server-Sent Events. Use normal HTTP mutations for controls.

**Rationale**: Run progress is primarily server-to-client. SSE supports reconnect semantics with less protocol complexity than a universal WebSocket layer. Persist-first delivery allows switching devices and recovering after browser/server disconnection.

**Alternatives considered**:

- WebSocket for everything: supports bidirectional terminal I/O but adds connection and scaling complexity before interactive terminal input is required.
- Polling only: simple but produces slower approval and progress UX and unnecessary repeated reads.
- In-memory event bus: fails multi-device continuity and process-restart recovery.

## Decision 4: Implement provider contracts before live adapters

**Decision**: Define and contract-test `SourceProvider`, `CodingAgentProvider`, and `SandboxProvider` with fake adapters before connecting GitHub, Codex, or Vercel Sandbox.

**Rationale**: Provider neutrality is a constitutional requirement. Fake adapters allow complete lifecycle and UI testing without paying for external execution or coupling domain logic to one provider.

**Alternatives considered**:

- Direct GitHub/Codex/Vercel calls in Next.js routes: faster for a demo but expensive to untangle and difficult to test deterministically.
- Generic MCP as the only provider boundary: MCP is useful for user-installed tools later, but source credentials, run cancellation, sandbox leasing, and provider reconciliation require explicit application contracts.

## Decision 5: GitHub App is the first source integration

**Decision**: Use a GitHub App connection and short-lived repository-scoped installation tokens.

**Rationale**: Developers can select repositories without sharing a personal access token. Repository scope and token expiration support least privilege. The domain stores internal connection and repository IDs rather than treating GitHub URLs as primary identity.

**Alternatives considered**:

- Personal access tokens: faster but creates poor credential hygiene and support burden.
- Managed repositories first: increases hosting, tenancy, backup, and legal scope before the control-plane workflow is proven.
- GitHub MCP only: useful agent tool surface, but Atoryn still needs backend-owned authorization, repository listing, credentials, and publication reconciliation.

## Decision 6: Codex is the first coding-agent adapter

**Decision**: Start with one Codex adapter and normalize its events into Atoryn run events.

**Rationale**: One agent is enough to prove orchestration, approval, cancellation, reconnect, evidence, and publication. Multi-agent support should follow a stable event and permission contract.

**Alternatives considered**:

- Codex and Claude together: doubles integration and test matrix before the core loop is proven.
- Raw terminal parsing: loses structured lifecycle and approval semantics and is fragile across CLI output changes.

## Decision 7: Vercel Sandbox is a spike implementation, not a domain commitment

**Decision**: Implement the first remote sandbox behind `SandboxProvider`, targeting Vercel Sandbox for the technical spike.

**Rationale**: It can provision isolated remote execution without Atoryn operating its own VM fleet. The adapter boundary preserves the ability to benchmark Cloudflare Sandbox, E2B, or self-hosted infrastructure later.

**Alternatives considered**:

- Browser-only WebContainers: insufficient for broad full-stack, credentials, background processes, and non-Node toolchains.
- Self-hosted Docker workers: greater control but adds scheduling, hardening, networking, cleanup, and multi-tenant risk too early.
- Local agent: useful later, but does not prove remote multi-device execution.

## Decision 8: Preserve existing verification and evidence concepts

**Decision**: Map the new task/run lifecycle onto existing CycleWarden verification, changed-file scope, validation command, evidence, and draft-publication mechanisms wherever their contracts remain valid.

**Rationale**: These are among the repository's strongest existing capabilities and directly support evidence-based completion.

**Alternatives considered**:

- Replace verification with agent self-report: violates the constitution and product purpose.
- Duplicate a second evidence system: creates conflicting verdicts and migration burden.

## Decision 9: Separate interface locale from technical output language

**Decision**: Store `interfaceLocale`, `instructionLanguage`, and `technicalOutputLanguage` independently.

**Rationale**: Vietnamese-first UX must not force Vietnamese code comments, branches, commits, or pull requests. Keeping original and normalized instructions supports traceability.

**Alternatives considered**:

- One project language setting: too coarse and causes unexpected technical artifacts.
- Translate only the interface: misses the core need to normalize Vietnamese product requests into precise engineering instructions.

## Decision 10: One active run per workspace for the MVP

**Decision**: Reject or deterministically queue a second run while one is active in the same workspace.

**Rationale**: This limits concurrency, budget, reconciliation, and conflicting repository mutation complexity while preserving the entire product loop.

**Alternatives considered**:

- Unlimited concurrent runs: attractive demo but creates branch collision, budget, scheduling, and approval races.
- One run globally: too restrictive for later testing and not a valid tenancy boundary.

## Open Questions for the Technical Spike

1. Which Codex integration surface provides the required event, approval, cancel, and resume semantics in the selected runtime?
2. What sandbox startup and dependency-install times are acceptable for the first supported repository class?
3. Which existing CycleWarden packages can be reused without importing local-trusted execution assumptions into remote execution?
4. What is the minimum safe network allowlist for cloning and package installation?
5. How will model usage and sandbox usage be estimated consistently before managed billing exists?
