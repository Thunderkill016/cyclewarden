# AGENTS.md — CycleWarden

CycleWarden is testing a free local project operating layer for software built with existing AI coding agents. Make the smallest evidence-backed change that advances the active pilot.

## Start here

Read only the context needed for the task:

1. `PROJECT_OS_SCOPE.md` — active Project OS responsibilities and deterministic contract.
2. Issue #59 — pilot problem, acceptance criteria and frozen areas.
3. `docs/research/AI_PROJECT_OS_LANDSCAPE.md` — comparable products and adoption/rejection decisions.
4. `docs/project-os/PILOT_PROTOCOL.md` — greenfield and brownfield experiment.
5. `ROADMAP.md` — current milestones and evidence gates.
6. `README.md` — public product summary and CLI usage.
7. `scripts/cw.mjs` and `scripts/cw.test.mjs` when changing deterministic project-state behavior.
8. `ARCHITECTURE.md` and `docs/CAPABILITIES.json` only when changing preserved runtime code.
9. The nearest path-specific instruction under `.github/instructions/`.

`IDEA.md`, issue #57 and `PRACTICAL_SCOPE.md` are historical evidence, not current product authority.

## Current phase

The current phase is a deterministic CLI plus real greenfield/brownfield pilots.

Allowed work:

- correct or clarify Project OS product truth;
- record real pilot evidence;
- fix a concrete state-model or CLI defect exposed by a pilot;
- keep scaffold, status, next and validation behavior small and deterministic;
- simplify or remove commands when evidence shows no value.

Do not resume the previous execution platform because the code already exists or the architecture looks incomplete.

## Working agreement

For every non-trivial change:

1. State the user or pilot problem being solved.
2. Inspect current repository and pilot evidence before editing.
3. Check whether an existing product already solves the layer better.
4. Define acceptance criteria and explicit non-goals.
5. Keep the patch limited to one command, model rule or pilot blocker.
6. Add or update focused tests for deterministic behavior.
7. Run the narrowest relevant checks while iterating.
8. Run `pnpm test:project-os` for Project OS CLI changes.
9. Run `pnpm verify` before claiming repository completion when a local checkout is available.
10. Review the final diff for stale source-of-truth claims and unintended product expansion.
11. Open a draft PR; do not self-merge or deploy.
12. Report checks that could not run without implying success.

## Product rules

- CycleWarden coordinates project-level intent, decisions, dependencies and status.
- Existing coding agents own implementation.
- Target repositories own tests, builds and repeatable quality gates.
- The human owner owns risky choices, task acceptance, merge and production actions.
- The MVP must not require a separate model provider or duplicate model calls.
- At most one project task is active by default.
- A task becomes ready only after dependencies and blocking decisions are resolved.
- A coding agent may propose a task or decision but may not silently replace the active task.
- Generate only enough roadmap detail to reach the next useful vertical slice.
- Integrate with feature-level SDD tools instead of rebuilding them.
- JSON validation proves structural consistency only; it does not prove the product or implementation is correct.

## Project-state contract

The pilot target-repository contract is:

```text
.cyclewarden/
├── README.md
├── project.json
├── roadmap.json
└── status.json
```

Rules:

- `project.json` stores grounded project context, foundation, invariants, sources and unknowns.
- `roadmap.json` stores immutable task IDs, statuses, dependencies, acceptance and evidence.
- `status.json` stores phase, active task, blockers, unresolved decisions and next explanation.
- Human-facing product and architecture documents stay in their existing repository locations and are referenced rather than copied.
- Never store secrets, tokens, real personal data or production credentials in project state.

## Research rules

- Write the decision question and evaluation criteria before searching.
- Prefer official documentation, source repositories, standards and primary sources.
- Record source date, access date, contradiction and uncertainty for changeable claims.
- Separate confirmed fact, owner statement, vendor claim, inference and unknown.
- Compare the simplest alternative, including plain `AGENTS.md` and issue tracking.
- Popularity, repository stars and generated-document volume are not product evidence.
- Research must end with an adopt, integrate, test, reject or unknown decision.

## Pilot rules

### Greenfield

- Start from the user problem, not the framework.
- Shape one first end-to-end flow.
- Record only decisions that block the first slice.
- Create three to seven vertical roadmap slices, not a complete feature backlog.
- Complete or explicitly block/drop the active task before selecting another.

### Brownfield

- Recover current behavior from code, tests, configuration, current docs and issues.
- Label evidence, owner statements, inference and unknowns.
- Preserve the existing stack during adoption unless the task explicitly evaluates replacement.
- Do not turn adoption into broad cleanup.
- Select the next task from core-flow value, correctness, security, readiness gates and dependencies.
- Represent human-only checks explicitly; never simulate them.

## Preserved runtime boundaries

When a pilot justifies touching existing experimental code:

| Area | Rule |
|---|---|
| App | Next.js App Router under `apps/web` |
| Auth | Use existing auth adapters and authorization boundaries |
| Vendor SDKs | Keep inside existing adapter boundaries |
| Validation | Validate writes with Zod |
| Database | Schema and SQL live under `packages/db` |
| Preserved core runtime | Prefer focused changes under `packages/evolution-core` |
| Pilot CLI | Keep dependency-free behavior in `scripts/cw.mjs` |
| Styling | Reuse existing Tailwind tokens |
| Skills | Reusable workflows live under `.agents/skills/**/SKILL.md` |

## Hard rules

- Do not replace the framework, auth architecture or monorepo tooling without explicit owner approval.
- Do not add a dependency before showing why Node built-ins or existing code cannot solve the problem.
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
pnpm cw -- --help
pnpm test:project-os
pnpm doctor
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:ai
pnpm verify
```

Use focused checks during iteration. `pnpm test:project-os` is required for CLI/state changes. `pnpm verify` is the final repository gate.

## Completion report

Include:

- problem and expected outcome;
- product layer affected;
- files changed;
- research or pilot evidence used;
- tests or checks run and exact outcomes;
- checks not run and why;
- assumptions, contradictions and remaining risks;
- what was intentionally not built;
- what the owner should review;
- whether the result changes a keep/integrate/manual/drop decision.
