# CycleWarden Project OS roadmap

> Product scope: [`PROJECT_OS_SCOPE.md`](PROJECT_OS_SCOPE.md)  
> Active pilot: [issue #59](https://github.com/Thunderkill016/cyclewarden/issues/59)  
> Research: [`docs/research/AI_PROJECT_OS_LANDSCAPE.md`](docs/research/AI_PROJECT_OS_LANDSCAPE.md)  
> Historical bounded-delivery experiment: [`PRACTICAL_SCOPE.md`](PRACTICAL_SCOPE.md) and issue #57

## Current objective

Determine whether a lightweight, agent-neutral project operating layer helps a solo or non-expert builder maintain a coherent software project across many coding-agent sessions.

The current roadmap does not resume the previous integrated-platform vision. It tests a narrower hypothesis:

```text
shape project
→ record foundation decisions
→ create dependency-aware vertical slices
→ keep one task active
→ delegate implementation
→ verify and update state
→ select next task
```

## Product boundary

CycleWarden owns:

- project intent and constraints;
- product scope and first useful flow;
- significant decisions and consequences;
- roadmap dependencies;
- current task, blockers and status;
- acceptance evidence structure.

CycleWarden delegates implementation to existing coding agents and should integrate with feature-level SDD tools rather than reproduce them.

## Milestone P0 — research and define the candidate product

- [x] identify the whole-project failure mode not solved by code generation alone;
- [x] compare Spec Kit, Kiro, Taskmaster, BMAD and OpenSpec;
- [x] incorporate bounded shaping, ADR, C4 and security-requirement practices;
- [x] define CycleWarden's layer above feature implementation;
- [x] reject autonomous execution, multi-agent personas and hosted platform work for the pilot;
- [x] open issue #59 with measurable pilot acceptance.

Exit: the product hypothesis and competitive boundary are explicit.

## Milestone P1 — artifact-first manual protocol

- [x] define repository-local project artifacts;
- [x] define project, product, design, architecture, roadmap, decision, task and status responsibilities;
- [x] define immutable roadmap/task IDs;
- [x] define dependency and blocker semantics;
- [x] define one-active-task rule;
- [x] define task lifecycle and completion evidence;
- [x] define greenfield and brownfield pilot procedures;
- [ ] review the protocol against one real project idea before creating runtime code.

Exit: an existing coding agent can follow the manual protocol using repository files only.

## Milestone P2 — greenfield pilot

Start from one real, short project idea supplied by the owner.

Required outcomes:

- [ ] target user, problem, constraints and non-goals are clear;
- [ ] the first end-to-end user flow is bounded;
- [ ] only decisions needed for the first slice are recorded;
- [ ] the roadmap contains three to seven independently valuable slices;
- [ ] exactly one task is active;
- [ ] an existing coding agent completes the task without changing stack or scope silently;
- [ ] repository checks and owner review produce an honest acceptance result;
- [ ] the next task is selected from completed dependencies.

Record:

- time and owner input needed to reach the first ready task;
- number of decisions and tasks created before implementation;
- task switches, scope changes and dependency violations;
- implementation retries and check failures;
- review time and owner understanding;
- artifact maintenance and unnecessary ceremony.

Exit: one useful vertical slice is accepted, blocked, dropped or honestly classified as inconclusive.

## Milestone P3 — brownfield adoption pilot

Use one existing repository with real history and unfinished work.

Required outcomes:

- [ ] current product, core flow, stack and boundaries are recovered from evidence;
- [ ] confirmed facts, owner statements, inference and unknowns are separated;
- [ ] accepted architecture is preserved rather than redesigned during adoption;
- [ ] contradictory source-of-truth claims are recorded;
- [ ] one valuable dependency-valid task is selected;
- [ ] exactly one task is active;
- [ ] a fresh agent session can recover the active task and project direction;
- [ ] the task reaches an honest final state.

Exit: the model helps continue an existing project without a broad cleanup or rewrite.

## Milestone P4 — compare with simpler alternatives

For each pilot compare CycleWarden with:

- concise `AGENTS.md` and one issue;
- plain Markdown roadmap and ADRs;
- Spec Kit or Kiro feature specs where available;
- Taskmaster-style dependency tracking;
- the coding agent's normal planning behavior.

Evaluate:

- [ ] project continuity across sessions;
- [ ] decision clarity and stability;
- [ ] dependency-aware next-task selection;
- [ ] task-switch prevention;
- [ ] owner understanding;
- [ ] duplicate/stale documentation;
- [ ] total setup and maintenance cost;
- [ ] value not already supplied by another tool.

Exit: the project can state precisely which layer is unique and which layers should be integrated or dropped.

## Milestone P5 — choose command scope

For each candidate command choose **keep**, **integrate**, **manual** or **drop**.

### `cw init`

Keep only if scaffolding and validation repeatedly improve greenfield shaping.

### `cw adopt`

Keep only if deterministic repository discovery and evidence labeling remove repeated brownfield work.

### `cw status`

Keep if one machine-readable summary reliably improves continuity across sessions.

### `cw next`

Keep if dependency/blocker logic makes better next-task decisions than a plain checklist.

### `cw validate`

Keep for deterministic rules such as dependency cycles, broken links, missing fields and multiple active tasks. Do not use it to pretend semantic product correctness is deterministic.

Exit: only demonstrated commands enter implementation.

## Milestone P6 — smallest deterministic CLI

This milestone remains blocked until P2–P5 evidence exists.

Allowed implementation:

- [ ] scaffold accepted artifact templates;
- [ ] parse project status and task metadata;
- [ ] validate task IDs, statuses, dependencies and one-active-task rule;
- [ ] print blockers and next ready task;
- [ ] provide machine-readable output for coding agents;
- [ ] add focused tests for state transitions and dependency errors.

Constraints:

- no model call inside the CLI;
- no provider API keys;
- no autonomous code implementation;
- no database or hosted service;
- no general workflow language;
- no web dashboard;
- no feature-level spec engine.

Exit: the CLI automates only repeated deterministic work observed in pilots.

## Milestone P7 — agent integration

Consider only after the CLI is useful independently.

Possible work:

- generate a concise repository `AGENTS.md` entrypoint;
- provide installable skill/command wrappers for Codex or Claude Code;
- export a roadmap slice into Spec Kit or OpenSpec-compatible feature work;
- read repository-owned verification commands;
- add optional hooks that run deterministic validation.

Do not make one IDE or model the source of truth.

## Frozen backlog

- autonomous implementation and publishing;
- multi-agent roles, debate or voting;
- model routing and provider abstraction;
- hosted dashboards, accounts and multi-user SaaS;
- deployment, release and rollback;
- recursive learning and skill promotion;
- broad research providers;
- general workflow authoring;
- additional execution sandboxes;
- feature-level SDD duplicated from mature tools;
- architecture refactors justified only by completeness.

## Re-entry rule

A frozen capability may return only when at least two real pilot/task records expose the same material problem and the proposed capability is the smallest credible solution.

## Kill criteria

Freeze CycleWarden as a research artifact when:

- the protocol only reproduces existing tools;
- `AGENTS.md` plus ordinary issues provides equivalent continuity;
- the artifacts become stale faster than they help;
- the owner still cannot explain the product, decisions, active task or next task;
- ceremony delays useful implementation without preventing scope or sequencing failures;
- a mature external product solves the full target problem more simply.