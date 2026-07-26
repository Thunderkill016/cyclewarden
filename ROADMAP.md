# CycleWarden Project OS roadmap

> Product scope: [`PROJECT_OS_SCOPE.md`](PROJECT_OS_SCOPE.md)  
> Active pilot: [issue #59](https://github.com/Thunderkill016/cyclewarden/issues/59)  
> Research: [`docs/research/AI_PROJECT_OS_LANDSCAPE.md`](docs/research/AI_PROJECT_OS_LANDSCAPE.md)  
> Historical bounded-delivery experiment: [`PRACTICAL_SCOPE.md`](PRACTICAL_SCOPE.md) and issue #57

## Current objective

Prove whether a free, local and agent-neutral project operating layer helps a solo or non-expert builder maintain a coherent project across coding-agent sessions.

```text
shape or recover project truth
→ record minimum foundation decisions
→ create dependency-aware slices
→ keep one task active
→ delegate implementation
→ verify and update state
→ select next
```

CycleWarden owns intent, decisions, dependencies, status and acceptance structure. It delegates code to existing agents and repository checks.

## P0 — research and product boundary

- [x] identify the whole-project failure mode not solved by code generation alone;
- [x] compare Spec Kit, Kiro, Taskmaster, BMAD and OpenSpec;
- [x] incorporate bounded shaping, ADR, C4 and risk-based security practices;
- [x] define CycleWarden above feature-level implementation;
- [x] reject autonomous execution, multi-agent personas and hosted platform work;
- [x] open issue #59 with measurable pilot acceptance.

Exit: complete.

## P1 — minimal artifact contract

- [x] define repository-local project state;
- [x] choose a small JSON contract plus human README;
- [x] define immutable task IDs and allowed statuses;
- [x] define dependency and blocker semantics;
- [x] define one-active-task rule;
- [x] require acceptance and evidence for executable/completed tasks;
- [x] define greenfield and brownfield procedures.

Current contract:

```text
.cyclewarden/
├── README.md
├── project.json
├── roadmap.json
└── status.json
```

Exit: complete for the pilot. Expand only after repeated evidence.

## P2 — MoneyFlow brownfield adoption

Tracked in `Thunderkill016/moneyflow#85` on branch `chore/cyclewarden-brownfield-pilot`.

- [x] recover product purpose, user, core flow and explicit non-goals from repository evidence;
- [x] preserve the existing Next.js/Supabase architecture rather than redesigning it;
- [x] record financial, RLS, export and runtime invariants;
- [x] represent issue #27 as the single active human-gated readiness task;
- [x] make seven-day self-use depend on the manual readiness gates;
- [x] split issue #81 into later dependency-bound Calm Ledger slices;
- [x] show that `next` must remain on issue #27 rather than jumping to the newest broad issue;
- [ ] run the CLI against a checkout of the MoneyFlow branch;
- [ ] verify a fresh agent session recovers the same active task and project direction;
- [ ] move the active task to an honest final state after the owner performs the manual gates.

Observed value:

`AGENTS.md` explains how to work safely, but it does not by itself encode that a current readiness issue blocks a newer redesign issue. The task graph makes project sequencing explicit.

Exit: current-state map complete; real human-gate completion remains pending.

## P3 — smallest deterministic CLI

Implemented as `scripts/cw.mjs` using Node.js built-ins only.

- [x] scaffold greenfield project state with `cw init`;
- [x] scaffold brownfield mapping state with `cw adopt`;
- [x] parse repository-local project state;
- [x] validate schema versions, statuses and unique IDs;
- [x] reject missing, self and cyclic dependencies;
- [x] enforce at most one active task and status consistency;
- [x] reject ready/active/verify tasks with incomplete dependencies;
- [x] require acceptance and evidence fields;
- [x] print project status, blockers and unresolved decisions;
- [x] return the active task or first dependency-ready task;
- [x] provide `--json` output;
- [x] add focused Node tests;
- [x] include tests in `check:ai` and `verify`.

Constraints preserved:

- no model calls or provider keys;
- no autonomous implementation;
- no database or hosted service;
- no general workflow language;
- no web dashboard;
- no feature-level spec engine.

This is a pilot implementation, not proof that all five commands deserve a permanent product surface.

## P4 — greenfield pilot

Start from one real project idea supplied by the owner.

Required outcomes:

- [ ] target user, problem, constraints and non-goals are clear;
- [ ] first end-to-end flow is bounded;
- [ ] only decisions required by the first slice are selected;
- [ ] roadmap contains three to seven independently valuable slices;
- [ ] exactly one task is active;
- [ ] existing coding agent completes the first task without silently changing stack or scope;
- [ ] repository checks and owner review produce an honest result;
- [ ] `next` selects from completed dependencies.

Record setup time, owner input, number of decisions/tasks, task switching, scope changes, retries, check failures, review time and artifact maintenance.

Exit: one useful vertical slice reaches accepted, blocked, dropped or honestly inconclusive status.

## P5 — compare with simpler alternatives

Compare both pilots with:

- concise `AGENTS.md` and one issue;
- plain roadmap plus ADRs;
- Spec Kit or Kiro feature specs;
- Taskmaster-style dependency tracking;
- normal coding-agent planning.

Evaluate:

- [ ] project continuity across sessions;
- [ ] decision clarity and stability;
- [ ] dependency-aware next selection;
- [ ] prevention of unfinished-task jumping;
- [ ] owner understanding;
- [ ] duplicate or stale documentation;
- [ ] total setup and maintenance cost;
- [ ] value not already supplied by another tool.

Exit: identify the unique layer precisely or stop.

## P6 — command decisions

Current provisional decisions:

| Command | Pilot state | Decision gate |
| --- | --- | --- |
| `cw init` | implemented scaffold | keep only if greenfield shaping improves without excess ceremony |
| `cw adopt` | implemented scaffold | keep only if it materially reduces repeated brownfield mapping work |
| `cw status` | implemented | likely keep if fresh sessions recover state reliably |
| `cw next` | implemented | likely keep if dependency/human-gate logic prevents real task jumping |
| `cw validate` | implemented | keep if it catches state errors without pretending semantic correctness |

Final values must be **keep**, **integrate**, **manual** or **drop** after both pilots.

## P7 — optional agent integration

Consider only after the CLI is useful independently:

- generate a concise `AGENTS.md` entrypoint;
- provide installable wrappers for Codex or Claude Code;
- export a slice to Spec Kit/OpenSpec when feature-level SDD is useful;
- read target-repository verification commands;
- add optional deterministic validation hooks.

Do not make one IDE or model the source of truth.

## Frozen backlog

- autonomous implementation and publishing;
- multi-agent roles or debate;
- model routing and provider abstraction;
- hosted dashboards, accounts and multi-user SaaS;
- deployment, release and rollback;
- recursive learning;
- broad research providers;
- general workflow authoring;
- additional execution sandboxes;
- duplicated feature-level SDD;
- architecture refactors justified only by completeness.

## Re-entry rule

A frozen capability may return only when at least two real pilot/task records expose the same material problem and the proposed capability is the smallest credible solution.

## Kill criteria

Freeze CycleWarden when:

- the contract only reproduces existing tools;
- `AGENTS.md` plus ordinary issues provides equivalent continuity;
- artifacts become stale faster than they help;
- the owner still cannot explain the product, decisions, active task or next task;
- ceremony delays useful implementation without preventing real sequencing failures;
- a mature external product solves the target problem more simply.
