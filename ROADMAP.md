# CycleWarden practical validation roadmap

> Active scope: [`PRACTICAL_SCOPE.md`](PRACTICAL_SCOPE.md)  
> Active experiment: [issue #57](https://github.com/Thunderkill016/cyclewarden/issues/57)  
> Historical platform vision: [`IDEA.md`](IDEA.md) and closed issue #9

## Current objective

Determine whether CycleWarden helps a solo developer complete real software tasks better than using a coding agent directly.

The current roadmap contains one milestone only: six real project tasks with comparable evidence.

## Product surface under evaluation

```text
prepare bounded task
→ implement in isolated Git context
→ verify scope and checks independently
→ report evidence
→ human merge decision
```

The experiment evaluates three possible useful capabilities:

1. `prepare` — repository context, scope and acceptance criteria;
2. execution handoff — isolated implementation through an existing coding agent;
3. `verify` — changed-file, patch and project-check validation.

No capability is retained merely because it is technically complete.

## Milestone P0 — align the repository

- [x] close the unmerged multi-project web registry PR as archived work;
- [x] supersede the full integrated-platform roadmap issue;
- [x] create the six-task practical validation issue;
- [x] define the active practical scope and frozen areas;
- [x] add a repeatable task evidence template;
- [x] reframe the README and roadmap around observed project value.

Exit: contributors can distinguish active practical work from preserved platform research.

## Milestone P1 — select real tasks

Select six tasks across at least two real repositories:

- [ ] direct-agent task 1;
- [ ] direct-agent task 2;
- [ ] direct-agent task 3;
- [ ] CycleWarden-assisted task 1;
- [ ] CycleWarden-assisted task 2;
- [ ] CycleWarden-assisted task 3.

Preferred distribution:

- two AtoEnglish tasks;
- two tasks from a second real project;
- two tasks from a third project when available.

A task must be independently valuable to its target project. Fixtures, demos and work invented to exercise CycleWarden do not count.

Exit: all six tasks have a clear goal, bounded scope and task record.

## Milestone P2 — complete direct-agent baseline

For three tasks, use the normal coding-agent workflow:

```text
AGENTS.md and repository context
→ coding agent
→ Git diff
→ project checks
→ human review
```

Record:

- [ ] preparation time;
- [ ] implementation retries;
- [ ] scope escapes;
- [ ] failures caught before review;
- [ ] human review time;
- [ ] final outcome and friction.

Exit: three honest baseline records exist.

## Milestone P3 — complete CycleWarden-assisted tasks

For three comparable tasks, use existing CycleWarden capabilities without adding optional platform features:

```text
inspect / assess / handoff
→ trusted-local implementation
→ independent verification
→ optional draft PR
→ human review
```

Runtime changes are permitted only when a concrete defect blocks a real task. Every such change must link to the task record that exposed it.

Record the same baseline metrics plus CycleWarden-specific setup and ceremony.

Exit: three honest CycleWarden-assisted task records exist.

## Milestone P4 — compare outcomes

Summarize all six tasks:

- [ ] median preparation time;
- [ ] total implementation retries;
- [ ] meaningful scope escapes;
- [ ] failures caught before human review;
- [ ] human review time;
- [ ] abandoned or inconclusive tasks;
- [ ] repeated CycleWarden friction;
- [ ] repeated value not provided by direct agent usage.

Do not treat code volume, CI complexity, number of records, or number of automated steps as product success.

Exit: a clear comparison exists with limitations and no unsupported causal claim.

## Milestone P5 — choose the smallest future

Choose exactly one primary direction:

### A. Task preparation tool

Use when context and bounded acceptance criteria create most of the value. Retain `prepare`; freeze delivery orchestration.

### B. Verification quality gate

Use when independent scope and check verification create most of the value. Retain `verify`; rely on external agents for implementation.

### C. Thin prepare + verify workflow

Use only when both capabilities repeatedly help and execution orchestration remains low-friction.

### D. Research prototype

Use when direct coding-agent work performs as well or better. Preserve the repository, stop active product development, and reuse individual components only when another project needs them.

Exit: README, package surface and active issues reflect the selected smallest direction.

## Frozen backlog

The following work has no active milestone:

- multi-project web dashboards;
- hosted or multi-user product operation;
- deployment, release and rollback automation;
- product outcome dashboards;
- recursive learning and skill promotion;
- MCP and A2A integration;
- additional coding-agent adapters;
- additional sandbox backends;
- broad public research adapters;
- provenance and persistence hardening beyond a real task blocker;
- architecture refactors justified only by completeness.

## Re-entry rule

A frozen capability may return only when at least two real task records show the same material problem and the proposed capability is the smallest credible experiment for solving it.
