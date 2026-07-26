# AGENTS.md — CycleWarden

CycleWarden is testing a lightweight project operating layer for software built with existing AI coding agents. Make the smallest evidence-backed change that advances the active pilot.

## Start here

Read only the context needed for the task:

1. `PROJECT_OS_SCOPE.md` — candidate active product direction and boundaries.
2. Issue #59 — pilot problem, acceptance criteria and frozen areas.
3. `docs/research/AI_PROJECT_OS_LANDSCAPE.md` — comparable products and adoption/rejection decisions.
4. `docs/project-os/PILOT_PROTOCOL.md` — greenfield and brownfield experiment.
5. `ROADMAP.md` — current milestones and gates.
6. `README.md` — public product summary.
7. `ARCHITECTURE.md` and `docs/CAPABILITIES.json` only when changing preserved runtime code.
8. The nearest path-specific instruction under `.github/instructions/`.

`IDEA.md`, issue #57 and `PRACTICAL_SCOPE.md` are historical evidence, not current product authority.

## Current phase

The current phase is research plus an artifact-first manual pilot.

Allowed work:

- correct or clarify Project OS product truth;
- improve the manual pilot from real use;
- record greenfield and brownfield pilot evidence;
- fix a concrete defect that blocks a pilot;
- implement deterministic CLI behavior only after repeated manual value is recorded.

Do not resume platform or runtime work because the code already exists or the architecture looks incomplete.

## Working agreement

For every non-trivial change:

1. State the user or pilot problem being solved.
2. Inspect current repository evidence before editing.
3. Check whether an existing product already solves the layer better.
4. Define acceptance criteria and explicit non-goals.
5. Keep the patch limited to one decision or pilot blocker.
6. Run the narrowest relevant checks while iterating.
7. Run `pnpm verify` before claiming runtime completion when a local checkout is available.
8. Review the final diff for stale source-of-truth claims and unintended product expansion.
9. Open a draft PR; do not self-merge or deploy.
10. Report checks that could not run without implying success.

## Product rules

- CycleWarden coordinates project-level intent, decisions, dependencies and status.
- Existing coding agents own implementation.
- Target repositories own tests, builds and repeatable quality gates.
- The human owner owns risky product choices, acceptance, merge and production actions.
- The MVP must not require a separate model provider or duplicate model calls.
- Exactly one project task is active by default during pilots.
- A task becomes ready only after dependencies and blocking decisions are resolved.
- A coding agent may propose a new task or decision but may not silently replace the active task.
- Generate only enough roadmap detail to reach the next useful vertical slice.
- Integrate with feature-level SDD tools instead of rebuilding them.

## Research rules

- Write the decision question and evaluation criteria before searching.
- Prefer official documentation, source repositories, standards and primary sources.
- Record source date, access date, contradiction and uncertainty for changeable claims.
- Separate confirmed fact, owner statement, vendor claim, inference and unknown.
- Compare the simplest alternative, including plain `AGENTS.md` and issue tracking.
- Popularity, repository stars and generated document volume are not product evidence.
- Research must end with an adopt, integrate, test, reject or unknown decision.

## Pilot rules

### Greenfield

- Start from the user problem, not the framework.
- Shape one first end-to-end flow.
- Record only decisions that block the first slice.
- Create three to seven vertical roadmap slices, not a complete feature backlog.
- Complete or explicitly block/drop the active task before selecting another.

### Brownfield

- Recover current behavior from code, tests, configuration and current documentation.
- Label evidence, owner statements, inference and unknowns.
- Preserve the existing stack during adoption unless the task explicitly evaluates replacement.
- Do not turn repository adoption into broad cleanup.
- Select the next task from core-flow value, correctness, security and dependencies.

## Preserved runtime boundaries

When a pilot justifies touching existing code:

| Area | Rule |
|---|---|
| App | Next.js App Router under `apps/web` |
| Auth | Use existing auth adapters and authorization boundaries |
| Vendor SDKs | Keep inside existing adapter boundaries |
| Validation | Validate writes with Zod |
| Database | Schema and SQL live under `packages/db` |
| Core CLI/runtime | Prefer focused changes under `packages/evolution-core` |
| Styling | Reuse existing Tailwind tokens |
| Skills | Reusable workflows live under `.agents/skills/**/SKILL.md` |

## Hard rules

- Do not replace the framework, auth architecture or monorepo tooling without explicit owner approval.
- Do not add a dependency before showing why repository code or an existing tool cannot solve the problem.
- Do not add model providers, hosted services, dashboards or autonomous execution during the pilot.
- Do not commit secrets, local environment files, service-role keys or production data.
- Do not weaken authorization, validation, security headers or data isolation.
- Do not change unrelated files merely to clean them up.
- Do not create a general abstraction from one hypothetical future use.
- Never claim completion while required checks fail.
- Never self-merge, deploy, alter production data or perform irreversible work without exact permission.

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

Use focused checks during iteration. `pnpm verify` is the final existing repository gate for runtime changes.

Documentation-only work should still validate links, source-of-truth consistency and any repository-owned documentation checks that can run.

## Completion report

Include:

- problem and expected outcome;
- product layer affected;
- files changed;
- research sources and decisions used;
- tests or checks run and exact outcomes;
- checks not run and why;
- assumptions, contradictions and remaining risks;
- what was intentionally not built;
- what the owner should review;
- whether the result changes a keep/integrate/manual/drop decision for the pilot.