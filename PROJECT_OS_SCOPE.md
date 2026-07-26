# CycleWarden Project OS scope

Status: active pilot direction  
Tracking issue: #59  
Research basis: [`docs/research/AI_PROJECT_OS_LANDSCAPE.md`](docs/research/AI_PROJECT_OS_LANDSCAPE.md)  
Pilot procedure: [`docs/project-os/PILOT_PROTOCOL.md`](docs/project-os/PILOT_PROTOCOL.md)

## Purpose

CycleWarden helps a solo or non-expert builder use an existing coding agent to build a coherent software project over many sessions.

It does not try to write code better than Codex, Claude Code, Kiro or another agent. It preserves project intent, foundational decisions, task order, blockers and definition of done so the existing agent works on the right thing next.

## User problem

A coding agent can complete individual requests while the project as a whole still fails:

- implementation begins before the target user, core problem and first useful flow are clear;
- UI, framework, database, backend, authentication and security choices are made implicitly;
- choices change between sessions without a recorded reason;
- unfinished tasks accumulate while new work starts;
- dependencies and human gates are ignored;
- architecture and repository conventions drift;
- the owner cannot explain the active task, blocker or next task.

## Product promise

From a short idea or an existing repository, CycleWarden maintains enough project truth that:

1. the owner understands what is being built and what is excluded;
2. important product and engineering choices have a reason and reconsideration condition;
3. the roadmap is a small set of useful vertical slices rather than an unbounded feature list;
4. at most one task is active by default;
5. the next task respects completed dependencies and unresolved blockers;
6. a fresh coding-agent session can continue without reinventing the project;
7. work is accepted only when task-specific evidence exists.

## Responsibility boundary

```text
Project intent, decisions and order  → CycleWarden
Feature implementation              → existing coding agent
Feature-level SDD                    → Spec Kit, Kiro, OpenSpec or task documents
Tests and repeatable checks          → target repository
Risk, acceptance and merge           → human owner
```

The pilot requires no separate model provider, hosted service or additional token spend.

## Operating workflow

```text
idea or existing repository
→ shape or recover project truth
→ record only required foundation decisions
→ create dependency-aware vertical slices
→ activate one task
→ existing coding agent implements it
→ repository checks and human review verify it
→ update project state
→ select the next ready task
```

## Repository contract

The deterministic pilot uses a deliberately small contract:

```text
.cyclewarden/
├── README.md
├── project.json
├── roadmap.json
└── status.json
```

Human-facing product, design, architecture and decision documents remain in the target repository. CycleWarden references them instead of copying the entire documentation tree.

### `project.json`

Stores:

- schema version and greenfield/brownfield mode;
- project ID, name, mission, target user and current phase;
- first critical flow, priorities and explicit non-goals;
- foundation choices for UI, data, auth, validation, tests and deployment;
- non-negotiable invariants;
- source-of-truth paths or issue references;
- known unknowns that must not be guessed.

### `roadmap.json`

Stores ordered tasks with:

- immutable task ID;
- title and status;
- dependency IDs;
- source issue or decision;
- allowed and forbidden scope when needed;
- acceptance criteria;
- required evidence;
- optional `humanOnly` marker.

The array order is the deterministic tie-breaker when multiple tasks are ready.

### `status.json`

Stores:

- current project phase;
- active and last-completed task IDs;
- blocked task IDs;
- blockers and unresolved decisions;
- current `next` explanation;
- a short owner summary of what is being built, why this task is active, what must not start and what follows.

### `README.md`

Explains the local contract, source-of-truth boundary and safety rules to humans and coding agents.

## Task lifecycle

Allowed states:

```text
proposed → ready → active → verify → done
                    ↘ blocked
proposed / ready / blocked → dropped
```

Rules:

- at most one task may be `active`;
- a `ready`, `active` or `verify` task requires every dependency to be `done`;
- task IDs are unique and immutable after use;
- dependency cycles and missing IDs are invalid;
- `ready`, `active`, `verify` and `done` tasks require acceptance and evidence fields;
- an agent may propose work but may not silently replace the active task;
- human-only work stays visible and must not be simulated by AI.

## Implemented pilot CLI

The CLI is intentionally deterministic and uses only Node.js built-ins. Source: [`scripts/cw.mjs`](scripts/cw.mjs).

```bash
pnpm cw -- init [root] --name "Project name"
pnpm cw -- adopt [root] --name "Project name"
pnpm cw -- validate [root]
pnpm cw -- status [root] [--json]
pnpm cw -- next [root] [--json]
```

### `init`

Creates a greenfield scaffold with one active shaping task. It does not choose a framework, database or product scope.

### `adopt`

Creates a brownfield scaffold with one active repository-mapping task. It does not pretend to inspect or understand the repository automatically; the existing coding agent fills the artifacts from evidence.

### `validate`

Checks:

- required JSON files and schema version;
- valid task statuses;
- unique IDs;
- missing, self and cyclic dependencies;
- more than one active task;
- mismatch between roadmap and `status.activeTaskId`;
- active/ready/verify tasks with incomplete dependencies;
- missing acceptance and evidence fields;
- broken task references in status.

It does not claim semantic product correctness or test execution.

### `status`

Shows project, mode, phase, active task, blockers, unresolved decisions and the next result.

### `next`

Returns the current active task first. When no task is active, it selects the first `ready` task whose dependencies are `done`. Otherwise it explains that no task is ready and lists dependency blockers.

## Proportional depth

CycleWarden must not force the same process on every project.

### Tiny experiment

Record mission, target user, first slice, non-goals, one task and only decisions needed to run it.

### Normal application

Add foundation choices, design/architecture references, dependency slices and repository checks.

### High-risk project

Add explicit human gates and appropriate standards for authentication, financial or regulated data, payments, destructive operations, secrets, privacy and production migrations.

## Agent integration

A repository instruction entrypoint should tell the coding agent to:

1. read `.cyclewarden/status.json` and the active roadmap task;
2. consult the referenced repository sources;
3. work only within the task scope;
4. stop when requirements or boundaries conflict;
5. run target-repository checks;
6. record evidence without accepting its own work;
7. leave task activation, acceptance, merge and production action to the owner.

CycleWarden remains portable across coding agents because the source of truth is plain repository data.

## Brownfield pilot evidence

The first adoption pilot is MoneyFlow, tracked in `Thunderkill016/moneyflow#85`.

Repository evidence showed:

- issue #27 is the active manual readiness contract;
- it explicitly forbids feature expansion while real email, spreadsheet and physical-phone checks remain incomplete;
- issue #81 is a broad redesign request created later;
- choosing work by recency or size would incorrectly jump to the redesign;
- representing readiness, seven-day self-use and redesign slices as dependencies makes `next` remain on issue #27.

This is distinct from `AGENTS.md`: agent instructions explain how to work, while Project OS state explains which project work is valid now and why later work is blocked.

## What CycleWarden will not build now

- a coding model or coding-agent replacement;
- autonomous implementation, merge, deployment or publication;
- multi-agent personas, debates or voting;
- a hosted dashboard or multi-user SaaS;
- model routing or provider abstraction;
- a general workflow language;
- recursive learning;
- a design-system generator;
- a full security scanner;
- feature-level SDD already available in mature tools;
- a large backlog generated from an unvalidated idea.

## Remaining pilot gates

1. Run the deterministic CLI and artifacts through CI.
2. Complete the MoneyFlow brownfield mapping and verify its `next` result.
3. Run one greenfield project from a short idea through one accepted vertical slice.
4. Decide keep, integrate, manual or drop for each command.
5. Simplify or stop if the artifacts add no value beyond `AGENTS.md` and ordinary issues.

## Success signals

- a fresh session recovers target user, core flow, non-goals, foundation, active task and blocker;
- no unapproved stack or architecture switch occurs;
- only one task is active;
- `next` respects dependencies and human gates;
- at least one vertical slice reaches accepted completion;
- the owner understands why the active task is current;
- the artifact set stays lighter than a complete lifecycle framework.

## Kill or integrate criteria

Stop building a standalone product when:

- the contract merely reproduces Spec Kit, Kiro, Taskmaster, BMAD or OpenSpec;
- concise `AGENTS.md` plus issues gives the same sequencing and continuity;
- project truth requires constant manual repair;
- the process delays the first useful slice more than it prevents confusion;
- the owner still cannot understand project status and decisions.

When another tool solves a layer better, integrate with it instead of duplicating it.
