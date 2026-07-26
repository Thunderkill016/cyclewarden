# CycleWarden Project OS scope

Status: proposed active direction  
Tracking issue: #59  
Research basis: [`docs/research/AI_PROJECT_OS_LANDSCAPE.md`](docs/research/AI_PROJECT_OS_LANDSCAPE.md)

## Purpose

CycleWarden helps a solo or non-expert builder use an existing coding agent to build a coherent software project over many sessions.

Its job is not to write better code than Codex, Claude Code, Kiro or another agent. Its job is to preserve the product's direction, foundational decisions, task order and definition of done so those agents work on the right thing next.

## User problem

A coding agent can implement individual requests while the overall project still fails:

- code starts before the target user, core problem and first flow are clear;
- UI, framework, database, backend, authentication and security choices are made implicitly;
- choices change between sessions without a recorded reason;
- the agent begins new features while previous work remains incomplete;
- tasks ignore dependencies;
- repository structure and architecture drift;
- the owner cannot explain the active task, blocker or next task.

## Product promise

From a one-sentence idea or an existing repository, CycleWarden creates and maintains enough project truth that:

1. the owner understands what is being built and what is explicitly excluded;
2. important product and engineering choices have a reason and reconsideration condition;
3. the roadmap is a small set of useful vertical slices rather than an unbounded feature backlog;
4. exactly one implementation task is active by default;
5. the next task is chosen from completed dependencies and unresolved blockers;
6. a new coding-agent session can continue without reinventing the project;
7. work is marked done only when task-specific evidence exists.

## Responsibility boundary

```text
Project intent, decisions and order  → CycleWarden
Feature implementation              → existing coding agent
Feature-level SDD                    → Spec Kit, Kiro, OpenSpec or task documents
Tests and repeatable checks          → target repository
Risk and merge decision              → human owner
```

CycleWarden may prepare agent-readable context, but it does not need its own model provider in the MVP.

## Operating workflow

```text
one-sentence idea or existing repository
→ shape target user, problem, constraints, core flow and non-goals
→ choose the smallest useful vertical slice
→ record only the foundational decisions needed for that slice
→ create a dependency-aware roadmap
→ activate exactly one ready task
→ coding agent implements the task
→ repository checks and human review verify the task
→ update project state
→ select the next ready task
```

## Project artifacts

The candidate repository-local contract is:

```text
.cyclewarden/
├── project.md
├── product.md
├── design.md
├── architecture.md
├── roadmap.md
├── status.yaml
├── decisions/
└── tasks/
```

### `project.md`

Contains:

- project purpose;
- target user;
- observed or stated problem;
- owner constraints such as time, budget, skills and deployment environment;
- success and failure signals;
- current phase.

### `product.md`

Contains:

- core user job;
- first end-to-end flow;
- current scope;
- explicit non-goals;
- assumptions and unresolved product decisions;
- conditions that justify adding another feature.

### `design.md`

Created only when the project has a user interface. Contains:

- platform and input constraints;
- primary navigation and screen map;
- design principles;
- chosen component/design-system approach;
- loading, empty, error and recovery expectations;
- accessibility and responsive requirements.

It must not become a generated component catalogue before a real flow exists.

### `architecture.md`

Contains the smallest useful architecture map:

- system context;
- runtime containers such as web app, API, worker and data store;
- trust and data boundaries;
- important interfaces;
- repository ownership map;
- checks that protect major boundaries.

Component-level documentation is added only for a difficult or risky subsystem.

### `decisions/`

One concise record for each architecturally significant choice:

- status;
- context and constraints;
- considered alternatives;
- decision;
- consequences;
- evidence;
- when to reconsider;
- superseded decision when applicable.

Decisions are required for choices such as persistence, authentication, sensitive data, externally hosted services, major frameworks and cross-cutting architecture. They are not required for ordinary local implementation details.

### `roadmap.md`

Contains stable slice IDs, user value, dependencies, status and links to task/spec artifacts.

Roadmap entries are vertical slices that can be demonstrated independently. The first slice should be a walking product path, not infrastructure completeness.

### `tasks/`

Each task contains:

- immutable ID;
- parent roadmap slice;
- outcome;
- dependencies;
- allowed and forbidden scope;
- acceptance criteria;
- required checks and manual evidence;
- unresolved questions;
- current status.

### `status.yaml`

Contains machine-readable current state:

```yaml
phase: shaping
active_task: null
blockers: []
unresolved_decisions: []
last_accepted_task: null
updated_at: 2026-07-27
```

## Task state and sequencing

Allowed task lifecycle:

```text
proposed → ready → active → verify → done
                    ↘ blocked
proposed/ready/blocked → dropped
```

Rules:

- exactly one task may be `active` unless a later pilot proves safe parallelism is needed;
- a task becomes `ready` only when all dependencies are `done`;
- a blocked foundational decision prevents dependent tasks from becoming ready;
- an agent may propose a new task or decision but may not silently replace the active task;
- unfinished work is resumed, explicitly blocked or dropped before another task is activated;
- task IDs never change after another artifact references them.

## Candidate CLI surface

### `cw init`

Create the project operating files for a new repository and print the shaping questions the existing agent must answer with the owner.

### `cw adopt`

Inspect an existing repository and create a current-state draft. It must label evidence, inference and unknowns instead of inventing missing product decisions.

### `cw status`

Show:

- project phase;
- active task;
- blockers;
- unresolved foundational decisions;
- last accepted task;
- next dependency-ready candidates.

### `cw next`

Return the single next task when one is unambiguously ready. Otherwise explain which dependency, decision or owner choice prevents selection.

### `cw validate`

Deterministically check:

- required artifact structure;
- valid task statuses;
- missing or cyclic dependencies;
- more than one active task;
- active tasks with incomplete dependencies;
- broken artifact links;
- missing acceptance/evidence fields;
- whether the configured repository checks were recorded.

It does not pretend to semantically prove that a product is correct.

## Proportional depth

CycleWarden must not force the same process on every project.

### Tiny experiment

Required:

- project and product brief;
- first slice;
- one task;
- only decisions needed to run the experiment.

### Normal application

Add:

- design and architecture maps;
- dependency roadmap;
- data/auth/security decisions as applicable;
- repository checks.

### High-risk project

Add explicit human gates and appropriate standards for:

- authentication and authorization;
- financial, health, legal or regulated data;
- payments and billing;
- destructive operations;
- secrets and external infrastructure;
- privacy and retention;
- production migration or rollback.

## Agent integration

The MVP should work through plain repository files. An agent entrypoint can instruct the coding agent to:

1. read project status;
2. work only on the active task;
3. consult referenced decisions and source files;
4. stop when scope or requirements conflict;
5. run required checks;
6. update evidence without marking its own work accepted;
7. leave activation and final acceptance to the owner or deterministic state transition.

Later integrations may generate commands or skills for specific agents, but the project model must remain portable.

## What CycleWarden will not build now

- a coding model or coding-agent replacement;
- autonomous implementation and publication;
- multi-agent personas, debates or voting;
- a general workflow engine;
- a hosted dashboard or multi-user SaaS;
- model routing or provider abstraction;
- deployment and rollback;
- recursive learning;
- a design-system generator;
- a full security scanner;
- feature-level SDD already available in mature tools;
- a hundred-task backlog created from an unvalidated idea.

## Manual pilot before CLI work

Two pilots are required:

1. **Greenfield:** turn one short project idea into a coherent first vertical slice and complete it with an existing coding agent.
2. **Brownfield:** adopt an existing repository, recover trustworthy current state and complete the next dependency-valid task.

Use [`docs/project-os/PILOT_PROTOCOL.md`](docs/project-os/PILOT_PROTOCOL.md).

## Success signals

- the owner can state the target user, core flow, non-goals, stack rationale, active task and next task;
- a fresh agent session correctly recovers those facts from the repository;
- no unapproved stack or architecture switch occurs;
- only one task remains active during the pilot;
- the next task respects dependencies;
- at least one vertical slice reaches accepted completion;
- the artifact set is materially lighter than adopting a complete lifecycle framework;
- the project-level layer adds value beyond `AGENTS.md` and feature-level specs alone.

## Kill or integrate criteria

Stop building a standalone CycleWarden product when:

- the artifact set only reproduces Spec Kit, Kiro, Taskmaster, BMAD or OpenSpec;
- a concise `AGENTS.md` plus ordinary issue tracking produces the same result;
- users cannot maintain project truth without repeated manual repair;
- the process delays the first useful slice more than it prevents confusion;
- the owner remains unable to understand decisions and project status.

When another tool solves a layer better, integrate with it instead of duplicating it.

## Current phase

Research and an artifact-first manual protocol. Runtime development is frozen until a pilot exposes a repeated need that deterministic tooling can solve.