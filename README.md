# ✦ CycleWarden

**A free local project operating layer for software built with AI coding agents**

CycleWarden helps a solo or non-expert builder turn an idea into a coherent software project, preserve important decisions, work on one dependency-valid task at a time, and continue across agent sessions without losing direction.

It does not try to write code better than Codex, Claude Code, Kiro, Cursor or another coding agent. It gives those agents stable project intent, accepted decisions, an active task, blockers and a definition of done.

> **Current direction:** deterministic Project OS pilot, tracked in [issue #59](https://github.com/Thunderkill016/cyclewarden/issues/59) and defined in [`PROJECT_OS_SCOPE.md`](PROJECT_OS_SCOPE.md).

CycleWarden was formerly named Shipkit. Existing state and compatibility notes are retained in [`docs/RENAMING_FROM_SHIPKIT.md`](docs/RENAMING_FROM_SHIPKIT.md).

## Problem

Coding agents can complete individual requests while the project as a whole becomes incoherent:

- implementation starts before the target user and first useful flow are clear;
- framework, UI library, backend, database, authentication and security choices are made implicitly;
- choices change between sessions without a recorded reason;
- unfinished tasks multiply while the agent starts new work;
- dependencies and human-only gates are ignored;
- the owner cannot explain the active task or what should happen next.

## Product hypothesis

CycleWarden owns project-level continuity:

1. shape or recover product truth and explicit non-goals;
2. record significant foundation decisions and invariants;
3. create a small dependency-aware roadmap of vertical slices;
4. allow at most one active task;
5. select the next ready task deterministically;
6. preserve state for a fresh coding-agent session;
7. require task-specific evidence before acceptance.

## Responsibility boundary

```text
Project intent, decisions and order  → CycleWarden
Feature implementation              → existing coding agent
Feature-level specs                 → existing spec/task tools when useful
Tests and repeatable checks          → target repository
Risk, acceptance and merge           → human owner
```

The pilot uses only local files and Node.js built-ins. It requires no hosted service, database, API key, model provider or duplicate token spend.

## Repository contract

```text
.cyclewarden/
├── README.md
├── project.json
├── roadmap.json
└── status.json
```

- `project.json` stores mission, target user, phase, core flow, non-goals, foundation choices, invariants, sources and unknowns.
- `roadmap.json` stores immutable task IDs, dependencies, status, scope, acceptance and required evidence.
- `status.json` stores the active task, blockers, unresolved decisions and current next-task explanation.
- `README.md` explains the local contract and safety rules.

Detailed product, design and architecture documents remain in the target repository and are referenced rather than copied.

## Implemented pilot CLI

```bash
pnpm cw -- init [root] --name "Project name"
pnpm cw -- adopt [root] --name "Project name"
pnpm cw -- validate [root]
pnpm cw -- status [root] [--json]
pnpm cw -- next [root] [--json]
```

### `init`

Creates a greenfield scaffold with one active shaping task. It does not choose a stack or invent a product.

### `adopt`

Creates a brownfield scaffold with one active repository-mapping task. The existing coding agent fills it from repository evidence.

### `validate`

Checks JSON structure, schema versions, task IDs, statuses, dependencies, cycles, one-active-task rules, active-task consistency, and required acceptance/evidence fields.

### `status`

Shows the project phase, active task, blockers, unresolved decisions and next result.

### `next`

Returns the current active task. When none is active, it chooses the first ready task whose dependencies are done. Otherwise it explains the blockers.

Run the deterministic tests with:

```bash
pnpm test:project-os
```

They are also included in `pnpm check:ai` and therefore in `pnpm verify`.

## Task lifecycle

```text
proposed → ready → active → verify → done
                    ↘ blocked
proposed / ready / blocked → dropped
```

Rules:

- at most one task may be active;
- ready, active and verify tasks require every dependency to be done;
- dependency cycles and missing IDs are invalid;
- acceptance and required evidence are mandatory for ready, active, verify and done tasks;
- a coding agent may propose work but may not silently replace the active task;
- AI must not simulate human-only evidence.

## First brownfield pilot: MoneyFlow

The first real adoption is tracked in `Thunderkill016/moneyflow#85`.

MoneyFlow contains:

- issue #27: final manual readiness gates, explicitly blocking new product features;
- issue #81: a later broad Calm Ledger redesign.

A coding agent following the newest or largest issue could jump into redesign work. The CycleWarden task graph keeps issue #27 active, makes seven-day self-use the next dependency, and blocks redesign slices until those gates complete.

This tests a responsibility not covered by `AGENTS.md` alone: `AGENTS.md` explains **how** to work, while CycleWarden state records **which project work is valid now and why later work is blocked**.

## Remaining pilot

Before expanding the CLI:

1. verify the MoneyFlow project state and deterministic `next` result;
2. run one greenfield project from a short idea through an accepted vertical slice;
3. compare the process with ordinary `AGENTS.md` plus issue tracking;
4. decide keep, integrate, manual or drop for each command.

Use [`docs/project-os/PILOT_PROTOCOL.md`](docs/project-os/PILOT_PROTOCOL.md).

## Research basis

The product direction was compared with:

- GitHub Spec Kit;
- Kiro Specs, Steering and Hooks;
- Taskmaster;
- BMAD Method;
- OpenSpec;
- Shape Up;
- Architectural Decision Records;
- C4 architecture maps;
- OWASP ASVS.

The comparison and adoption/rejection decisions are in [`docs/research/AI_PROJECT_OS_LANDSCAPE.md`](docs/research/AI_PROJECT_OS_LANDSCAPE.md).

The conclusion is that CycleWarden should sit **above feature-level implementation tools**, not recreate them.

## Frozen until evidence

- autonomous coding-agent execution;
- multi-agent personas or debates;
- hosted dashboards and multi-user SaaS;
- model routing and provider expansion;
- deployment and rollback;
- recursive learning;
- a general workflow language;
- feature-level SDD already available in mature tools.

## Preserved experimental runtime

The repository already contains substantial research code for inspection, evidence, trusted-local execution, independent verification, worktrees, draft PR publication and web workflows.

That code is preserved as technical evidence. It is not the active product surface and does not justify further work unless the Project OS pilot exposes a concrete repeated need.

Historical bounded-delivery validation remains in [`PRACTICAL_SCOPE.md`](PRACTICAL_SCOPE.md), [`docs/practical/TASK_RECORD_TEMPLATE.md`](docs/practical/TASK_RECORD_TEMPLATE.md) and issue #57.

## Important boundaries

- CycleWarden does not automatically code, merge, deploy, access production secrets or spend money.
- Valid project files do not prove that a product is useful or correct.
- A green build does not prove product security or user value.
- Existing tools should be integrated when they solve a layer better.

## Documentation

| Document | Purpose |
| --- | --- |
| [`PROJECT_OS_SCOPE.md`](PROJECT_OS_SCOPE.md) | Active Project OS responsibility and deterministic contract |
| [`docs/research/AI_PROJECT_OS_LANDSCAPE.md`](docs/research/AI_PROJECT_OS_LANDSCAPE.md) | Comparable products and product decisions |
| [`docs/project-os/PILOT_PROTOCOL.md`](docs/project-os/PILOT_PROTOCOL.md) | Greenfield and brownfield experiment |
| [`ROADMAP.md`](ROADMAP.md) | Evidence-driven roadmap |
| [`PRACTICAL_SCOPE.md`](PRACTICAL_SCOPE.md) | Superseded bounded-delivery direction |
| [`IDEA.md`](IDEA.md) | Historical broad platform vision |

## License

Distributed under the MIT License. See [`LICENSE`](LICENSE).
