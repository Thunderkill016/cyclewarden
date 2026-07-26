# CycleWarden Project OS manual pilot

Status: active experiment protocol  
Tracking issue: #59

## Purpose

Test the Project OS hypothesis before building another runtime.

The pilot uses the owner's existing coding agent and repository files. CycleWarden is represented by a small operating protocol and artifact set. No separate model API, hosted service, multi-agent workflow or execution engine is required.

## Core rule

At every moment the project must answer five questions:

1. What user problem are we solving now?
2. What decisions have already been accepted and why?
3. What is the single active task?
4. What evidence will prove that task is done?
5. What dependency-valid task comes next?

If the repository cannot answer one of these, the pilot records the gap instead of letting the agent invent an answer.

## Pilot A — greenfield project

### Step 1: shape the idea

Start from the owner's actual one-sentence idea. Do not start by choosing a framework.

Record:

- target user;
- painful or valuable situation;
- core job the product helps complete;
- existing alternatives;
- owner constraints: budget, time, skills, devices, hosting and privacy;
- success signal;
- explicit non-goals.

Reject a vague target such as “everyone.” Mark unsupported market claims as assumptions.

### Step 2: choose the first vertical slice

Describe the shortest end-to-end flow that produces observable user value.

A valid first slice normally includes only the minimum UI, domain behavior and persistence needed to demonstrate one job. It should not be “set up every possible infrastructure layer.”

Record:

- trigger;
- user action;
- system response;
- stored or changed state;
- visible result;
- failure and recovery behavior;
- what remains deliberately fake, local or deferred.

### Step 3: make only blocking decisions

Create a decision record only when the first slice cannot proceed responsibly without it.

Common decisions:

- web, mobile, desktop or CLI surface;
- local-only versus persistent/server data;
- database choice;
- authentication need and timing;
- sensitive-data classification;
- framework and deployment target;
- component library or design-system strategy;
- test and verification entrypoint.

For each decision record:

```markdown
# D-001 — <decision title>

Status: proposed | accepted | rejected | superseded
Date: YYYY-MM-DD
Owner: <name or role>

## Context and constraints

## Alternatives considered

## Decision

## Consequences and trade-offs

## Evidence

## Reconsider when

## Supersedes / superseded by
```

Do not select technology because it is popular. Choose the simplest option that satisfies the stated constraints, and record what would make that choice invalid later.

### Step 4: create a small roadmap

Create three to seven vertical slices. Avoid generating a complete product backlog.

Use stable IDs:

```markdown
| ID | User-visible outcome | Depends on | Status | Task/spec |
|---|---|---|---|---|
| R1 | User completes the first useful flow | — | ready | tasks/T001.md |
| R2 | User can recover or continue saved work | R1 | proposed | — |
| R3 | User can review the core result | R1 | proposed | — |
```

Statuses: `proposed`, `ready`, `active`, `verify`, `done`, `blocked`, `dropped`.

Only R1 should normally be implementation-ready at the beginning.

### Step 5: create and activate one task

Task template:

```markdown
# T001 — <bounded outcome>

Status: active
Parent slice: R1
Depends on: none

## Outcome

## Current evidence

## Allowed scope

## Forbidden scope

## Acceptance criteria

- [ ] criterion with observable evidence

## Required checks

## Manual evidence

## Risks and unresolved questions

## Completion record

- changed files:
- checks and exact results:
- manual verification:
- remaining uncertainty:
- owner decision:
```

The active task must be small enough for one reviewable branch or pull request.

### Step 6: hand off to the coding agent

The agent receives:

- project and product truth;
- referenced decisions;
- current repository evidence;
- the active task only;
- existing repository instructions and checks.

Agent rules:

- do not activate another task;
- do not change an accepted decision silently;
- propose a new decision or task when new information changes scope;
- stop when a blocker prevents the acceptance criteria;
- report failed or unrun checks honestly;
- do not mark its own result accepted.

### Step 7: verify and accept

Verification uses the target repository's existing tools first.

Check:

- every acceptance criterion has evidence;
- changed files fit the allowed scope;
- required checks ran successfully or are explicitly unavailable;
- no accepted decision was violated;
- the vertical slice works end to end;
- unfinished work is recorded instead of hidden.

The owner chooses:

- `done` — accepted;
- `active` — more implementation required;
- `blocked` — external or decision blocker;
- `dropped` — no longer worth completing.

### Step 8: choose the next task

A task is eligible only when:

- all dependencies are `done`;
- no unresolved decision blocks it;
- no other task is `active`;
- its outcome remains inside current product scope.

When more than one task is ready, the owner chooses using:

1. core-flow completion;
2. correctness, security and data safety;
3. removal of a blocker;
4. evidence from real use;
5. smallest coherent slice;
6. feature breadth last.

## Pilot B — brownfield adoption

The brownfield pilot must separate repository evidence from inference.

### Step 1: inspect current truth

Read only the sources needed to establish:

- what the product currently does;
- primary user and core flows;
- runtime and deployment shape;
- data stores, authentication and trust boundaries;
- current checks;
- open work and recent decisions;
- known broken or incomplete flows.

Label findings:

- `confirmed` — directly supported by code, tests, configuration or current documentation;
- `owner statement` — stated by the owner but not independently verified;
- `inference` — likely but not proven;
- `unknown` — evidence is missing or contradictory.

### Step 2: recover rather than rewrite

Create draft Project OS artifacts from current evidence. Do not redesign the project or replace the stack during adoption.

When sources conflict:

- preserve the conflict;
- identify which behavior runs today;
- ask the owner only when the decision materially affects the next task;
- create a cleanup task only when the conflict causes real implementation risk.

### Step 3: identify one next valuable task

Rank candidates by:

- broken core flow;
- data/security correctness;
- current user friction;
- dependency unblock;
- evidence from production or self-use;
- smallest bounded improvement.

Do not choose architecture cleanup merely because the repository looks untidy.

Then follow the same one-active-task implementation and verification loop used by the greenfield pilot.

## Minimal artifact skeleton

```text
.cyclewarden/
├── project.md
├── product.md
├── design.md               # only for UI projects
├── architecture.md
├── roadmap.md
├── status.yaml
├── decisions/
│   └── D-001-*.md
└── tasks/
    └── T001-*.md
```

Suggested `status.yaml`:

```yaml
schema_version: 0.1
phase: shaping
active_task: null
blockers: []
unresolved_decisions: []
last_accepted_task: null
updated_at: YYYY-MM-DD
```

## Metrics to record

For both pilots:

- starting input and repository state;
- time spent before the first task became ready;
- number of owner questions required;
- number of foundational decisions recorded;
- number of tasks generated before first implementation;
- task switches before acceptance;
- unapproved scope or stack changes;
- dependency violations;
- implementation retries;
- checks and failures;
- owner review time;
- whether a fresh agent session recovered product, decisions, active task and next task correctly;
- duplicate or stale artifact maintenance;
- total ceremony that did not change a decision or prevent an error.

## Comparison baseline

For each pilot, explicitly compare against the simplest credible alternative:

- concise `AGENTS.md` plus one issue;
- Spec Kit or Kiro feature specs;
- Taskmaster task dependencies;
- plain Markdown roadmap and ADRs.

The pilot succeeds only when the combined Project OS layer adds project-level continuity that these alternatives do not already provide more simply.

## Stop conditions

Stop the pilot and record the result when:

- shaping cannot produce a coherent core flow;
- the owner does not actually want the proposed project;
- a missing product decision blocks responsible implementation;
- the active task expands beyond one reviewable slice;
- the artifacts contradict current code and cannot be reconciled;
- the process adds documents without changing decisions, sequencing or quality;
- the coding agent works equally well from a short task and `AGENTS.md` alone.

An abandoned or negative pilot is valid evidence. Do not add runtime features to hide a weak product hypothesis.

## Decision after two pilots

For each candidate command — `init`, `adopt`, `status`, `next`, `validate` — choose one:

- **keep:** repeated manual work is deterministic and valuable;
- **integrate:** an existing product solves it better;
- **manual:** useful but not worth automating;
- **drop:** no demonstrated value.

Only kept commands enter CLI implementation.