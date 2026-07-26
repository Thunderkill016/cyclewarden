# ✦ CycleWarden

**A project operating layer for software built with AI coding agents**

CycleWarden helps a solo or non-expert builder turn an idea into a coherent software project, preserve important decisions, work on one dependency-valid task at a time, and continue across agent sessions without losing direction.

It does not try to write code better than Codex, Claude Code, Kiro, Cursor or another coding agent. It gives those agents stable project intent, accepted decisions, an active task and a definition of done.

> **Current direction:** artifact-first Project OS validation, tracked in [issue #59](https://github.com/Thunderkill016/cyclewarden/issues/59) and defined in [`PROJECT_OS_SCOPE.md`](PROJECT_OS_SCOPE.md).

CycleWarden was formerly named Shipkit. Existing state and configuration compatibility are documented in [`docs/RENAMING_FROM_SHIPKIT.md`](docs/RENAMING_FROM_SHIPKIT.md).

## Problem

Coding agents can complete individual requests while the project as a whole becomes incoherent:

- implementation starts before the target user and first useful flow are clear;
- framework, UI library, backend, database, authentication and security choices are made implicitly;
- choices change between sessions without a recorded reason;
- unfinished tasks multiply while the agent starts new work;
- dependencies and blockers are ignored;
- architecture and repository conventions drift;
- the owner cannot explain the active task or what should happen next.

## Product hypothesis

CycleWarden can add value above existing agents by owning project-level continuity:

1. shape a one-sentence idea into product truth and explicit non-goals;
2. record significant product, design, stack, architecture, data and security decisions;
3. create a small dependency-aware roadmap of useful vertical slices;
4. allow exactly one active implementation task by default;
5. select the next ready task from completed dependencies and unresolved blockers;
6. preserve project state for a fresh agent session;
7. require task-specific evidence before work is accepted.

## Operating workflow

```text
idea or existing repository
→ target user, problem, constraints, core flow and non-goals
→ minimum foundation decisions
→ dependency-aware vertical-slice roadmap
→ one active task
→ existing coding agent implementation
→ repository checks and human review
→ accepted project state
→ next ready task
```

## What CycleWarden owns

- project and product truth;
- accepted decisions and their rationale;
- a small architecture and trust-boundary map;
- roadmap slices and dependencies;
- the single active task and blockers;
- task acceptance and evidence fields;
- durable status across sessions.

## What CycleWarden delegates

- code implementation to the user's existing coding agent;
- feature-level SDD to Spec Kit, Kiro, OpenSpec or focused task documents when useful;
- tests, builds, linting and security checks to the target repository and established tools;
- final product, risk and merge decisions to the human owner.

The MVP should not require a separate model provider or duplicate token spend.

## Candidate repository contract

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

See [`PROJECT_OS_SCOPE.md`](PROJECT_OS_SCOPE.md) for the responsibility of each artifact.

## Candidate CLI

```text
cw init      scaffold project operating artifacts for a new project
cw adopt     recover trustworthy current state from an existing repository
cw status    show phase, active task, blockers and unresolved decisions
cw next      select the next dependency-ready task
cw validate  check artifact structure, dependencies and one-active-task rules
```

These commands are hypotheses. They will be implemented only when the manual pilots show that deterministic automation removes repeated, valuable work.

## Current pilot

Before new runtime development, issue #59 requires:

1. one greenfield pilot from a one-sentence idea to an accepted vertical slice;
2. one brownfield pilot that recovers current state and completes the next valid task;
3. comparison with a concise `AGENTS.md`, ordinary issue tracking and existing spec/task tools;
4. a keep, integrate, manual or drop decision for each proposed command.

Use [`docs/project-os/PILOT_PROTOCOL.md`](docs/project-os/PILOT_PROTOCOL.md).

## Research basis

The product direction is based on comparison with:

- GitHub Spec Kit;
- Kiro Specs, Steering and Hooks;
- Taskmaster;
- BMAD Method;
- OpenSpec;
- Shape Up;
- Architectural Decision Records;
- C4 architecture maps;
- OWASP ASVS.

The full comparison and adoption/rejection decisions are in [`docs/research/AI_PROJECT_OS_LANDSCAPE.md`](docs/research/AI_PROJECT_OS_LANDSCAPE.md).

The central conclusion is that CycleWarden should sit **above feature-level implementation tools**, not recreate them.

## Frozen until pilot evidence

- autonomous coding-agent execution;
- multi-agent personas, debates or voting;
- hosted dashboards and multi-user SaaS;
- model routing and provider expansion;
- deployment and rollback;
- recursive learning;
- a general workflow language;
- feature-level SDD already available in mature tools;
- architecture work justified only by completeness.

## Preserved experimental runtime

The repository already contains substantial research code for repository inspection, evidence records, trusted-local execution, independent verification, worktrees, draft PR publication and web workflows.

That code is preserved as technical evidence. It is not the active product surface and does not justify new work unless a Project OS pilot exposes a concrete reusable need.

Historical practical validation is retained in [`PRACTICAL_SCOPE.md`](PRACTICAL_SCOPE.md), [`docs/practical/TASK_RECORD_TEMPLATE.md`](docs/practical/TASK_RECORD_TEMPLATE.md) and issue #57.

## Important boundaries

- CycleWarden does not automatically merge, deploy, access production secrets or spend money.
- Project files cannot replace owner judgment about an unclear or unsafe product.
- A valid task graph does not prove the product is useful.
- A green build does not prove product correctness, security or user value.
- Existing tools should be integrated when they solve a layer better than CycleWarden.

## Documentation

| Document | Purpose |
| --- | --- |
| [`PROJECT_OS_SCOPE.md`](PROJECT_OS_SCOPE.md) | Candidate active product direction |
| [`docs/research/AI_PROJECT_OS_LANDSCAPE.md`](docs/research/AI_PROJECT_OS_LANDSCAPE.md) | Comparable products, methods and product decision |
| [`docs/project-os/PILOT_PROTOCOL.md`](docs/project-os/PILOT_PROTOCOL.md) | Manual greenfield and brownfield experiment |
| [`ROADMAP.md`](ROADMAP.md) | Evidence-driven implementation roadmap |
| [`PRACTICAL_SCOPE.md`](PRACTICAL_SCOPE.md) | Superseded bounded-delivery validation retained as history |
| [`IDEA.md`](IDEA.md) | Historical broad platform vision |

## License

Distributed under the MIT License. See [`LICENSE`](LICENSE).