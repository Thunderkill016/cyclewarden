# AGENTS.md — CycleWarden

You are building a product on CycleWarden. Preserve the chosen stack and make the
smallest verifiable change that satisfies the current task.

## Start here

Read only the context needed for the task:

1. `IDEA.md` — product scope and MVP.
2. `docs/ai/PROJECT_MODEL.md` — current evidence-backed map, coverage, and blind spots.
3. `docs/CAPABILITIES.json` — current capability and verification state.
4. `AI_WORKFLOW.md` — delivery, discovery, and improvement loops.
5. `ARCHITECTURE.md` — when changing boundaries, data flow, or packages.
6. The active plan in `docs/ai/plans/`, when one exists.
7. The nearest path-specific instruction under `.github/instructions/`.

For open-ended requests such as “understand and improve this project,” read
`docs/ai/AUTONOMOUS_IMPROVEMENT.md`. For uncertain ideas, market research, or
technology choices, read `docs/ai/DISCOVERY_RESEARCH.md`.

Do not treat this file as an encyclopedia. Follow its links to the current
source of truth.

## Working agreement

For every non-trivial change:

1. Inspect relevant code and runtime evidence before editing.
2. State current behavior, evidence, confidence, and important blind spots.
3. Define acceptance criteria.
4. Save a plan in `docs/ai/plans/` when the task crosses a subsystem, changes
   data, touches security, or is expected to modify more than five files.
5. Implement one reviewable slice at a time.
6. Run the narrowest relevant checks while iterating.
7. Run `pnpm verify` before reporting completion.
8. Review the final diff for regressions and out-of-scope changes.
9. Report verification evidence and remaining risks.

Use a fresh agent session for independent review when practical.

## Hubcode worktrees

When a task is launched through Hubcode:

- Treat the linked GitHub issue and Hubcode task card as the active task boundary.
  Stop and report the conflict if they disagree.
- Treat the Hubcode worktree as an isolated, disposable branch. Do not modify the
  source checkout or another worktree.
- Use one implementation session and a fresh independent verification session.
  The implementer must not approve its own work.
- Use Hubcode only as the development control plane. Do not add Hubcode as an
  application runtime dependency.
- Do not rebuild agent-session management, worktree orchestration, or a Kanban
  surface inside CycleWarden unless the active issue explicitly tests a proven
  Hubcode gap.
- Never merge or deploy from an agent session. The human owner keeps the final
  decision.

The pilot workflow and success criteria live in
`docs/practical/HUBCODE_PILOT.md`.

## Open-ended improvement requests

Do not immediately clean up or rewrite the repository.

1. Declare the objective and autonomy level. Default to A2: research and plan.
2. Read and refresh `docs/ai/PROJECT_MODEL.md`; read
   `docs/CAPABILITIES.json` before ranking work.
3. Validate the baseline and trace critical journeys.
4. Create a health report and rank improvement candidates.
5. Select one bounded candidate.
6. Research only decision-critical unknowns using current primary sources.
7. Implement only when the autonomy level and risk gates allow it.
8. Open a draft PR; do not self-merge or deploy.

Never claim to understand the entire project without reporting inspected areas,
blind spots, and confidence.

## Research rules

- Inspect internal evidence before public web research.
- Write the decision and questions before searching.
- Prefer official, direct, and primary sources for technical decisions.
- Record URLs, source dates, access dates, contradiction, and uncertainty.
- Separate fact, user statement, source interpretation, and agent inference.
- Do not invent analytics, interviews, incidents, source access, or market facts.
- Discovery may create research artifacts but must not edit product code.

## Stack and boundaries

| Area | Rule |
|---|---|
| App | Next.js App Router under `apps/web` |
| Product UI | Prefer `apps/web/src/app/app/**` for authenticated features |
| Auth | Use `getAuth()` and existing adapters |
| Vendor SDKs | Keep inside `apps/web/src/lib/adapters/**` |
| Validation | Validate writes with Zod |
| Database | Schema and SQL live under `packages/db` |
| Styling | Reuse Tailwind tokens from `apps/web/src/app/globals.css` |
| Skills | Reusable workflows live under `.agents/skills/**/SKILL.md` |

## Hard rules

- Do not replace the framework, auth architecture, or monorepo tooling unless
  the human explicitly requests it.
- Do not add a dependency without explaining why existing code cannot solve
  the task.
- Do not commit secrets, `.env.local`, service-role keys, or production data.
- Do not weaken security headers, authorization, row isolation, or validation.
- Do not edit an already-deployed migration; add a new migration.
- Do not remove code until usage has been checked and evidence is recorded.
- Do not change unrelated files just to make them “cleaner.”
- Never claim completion while required checks are failing.
- Never self-merge, deploy, alter production data, or perform irreversible work
  without explicit permission for that exact action.

## Commands

```bash
pnpm install
pnpm doctor
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:ai
pnpm verify
```

Use focused tests during implementation. `pnpm verify` is the final local gate.

## Risk gates

Pause and present a clear plan before actions involving:

- authentication or authorization;
- database migrations or destructive data changes;
- secrets, billing, external paid services, or production;
- broad refactors, dependency replacement, or public API changes;
- legal, privacy, safety, or regulated data decisions.

## Completion report

Include:

- objective and autonomy level when applicable;
- repository coverage, blind spots, and confidence;
- behavior changed;
- files changed;
- research and sources used;
- tests or checks run and their outcomes;
- assumptions and unresolved risks;
- what the project owner should review manually;
- durable project memory updated for the next agent.

When teaching the owner, follow `docs/ai/LEARNING_MODE.md`.
