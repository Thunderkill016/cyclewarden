# CycleWarden AI project workflow

CycleWarden uses repository files to preserve project intent, decisions, status and task order across coding-agent sessions.

The user's existing coding agent implements code. CycleWarden coordinates the project-level workflow and uses deterministic checks where model judgment is unnecessary.

## Project OS loop

```text
idea or existing repository
      ↓
shape target user, problem, constraints and non-goals
      ↓
choose the first useful vertical slice
      ↓
record only blocking product and architecture decisions
      ↓
create dependency-aware roadmap
      ↓
activate one ready task
      ↓
existing coding agent implements
      ↓
repository checks + owner review
      ↓
update accepted state
      ↓
select next dependency-ready task
```

Read:

- `PROJECT_OS_SCOPE.md` for the product boundary;
- `docs/project-os/PILOT_PROTOCOL.md` for the current manual experiment;
- `ROADMAP.md` for implementation gates;
- issue #59 for acceptance criteria.

## Shaping loop

Use before implementation when the project or feature direction is unclear.

```text
owner idea
→ target user and situation
→ core job and first end-to-end flow
→ constraints and explicit non-goals
→ riskiest assumptions
→ smallest useful vertical slice
```

Do not start with framework selection. Do not generate a complete backlog before the first flow is bounded.

Output belongs in project/product artifacts or the active task, not only in chat history.

## Decision loop

Use for choices that affect structure, data, security, major dependencies, external services or long-lived project constraints.

```text
decision question
→ current project constraints
→ internal repository evidence
→ current primary-source research when needed
→ alternatives and consequences
→ owner acceptance
→ concise decision record
```

Accepted decisions are superseded by a new record rather than silently rewritten.

Ordinary implementation details do not require decision-record ceremony.

## Active-task loop

```text
ready task with completed dependencies
→ owner activates task
→ agent reads task and referenced decisions
→ agent makes smallest coherent change
→ focused checks
→ final diff and evidence
→ owner accepts, continues, blocks or drops
```

Rules:

- exactly one task is active by default;
- the agent may propose work but cannot silently switch the active task;
- a task cannot become ready while dependencies or blocking decisions remain unresolved;
- implementation difficulty does not authorize changing product requirements;
- the coding agent does not mark its own output accepted;
- failed and unrun checks are reported honestly.

## Brownfield adoption loop

```text
inspect current code, tests, config and current docs
→ separate confirmed evidence, owner statement, inference and unknown
→ recover product, architecture and status without redesigning
→ identify core-flow, correctness, security and dependency problems
→ select one bounded next task
→ use the active-task loop
```

Do not turn adoption into broad cleanup. Preserve the current stack unless replacement is the explicit decision under evaluation.

## Research loop

Use when a decision depends on current APIs, products, standards, security guidance or unfamiliar technology.

```text
decision and evaluation criteria
→ internal evidence
→ official and primary external sources
→ supporting and contradicting evidence
→ applicability to project constraints
→ adopt / integrate / test / reject / unknown
```

Research does not authorize implementation. Popularity, stars and vendor claims are not sufficient evidence.

The current landscape decision is recorded in `docs/research/AI_PROJECT_OS_LANDSCAPE.md`.

## Deterministic validation

Prefer code for checks such as:

- artifact existence and links;
- valid task IDs and statuses;
- dependency cycles;
- tasks with incomplete dependencies;
- more than one active task;
- missing acceptance/evidence fields;
- repository check command outcomes.

Do not claim that deterministic structure proves semantic product correctness.

## Which document to read

| Need | Source |
|---|---|
| Current product direction | `PROJECT_OS_SCOPE.md` |
| Active pilot | issue #59 |
| Comparable products and methods | `docs/research/AI_PROJECT_OS_LANDSCAPE.md` |
| Greenfield/brownfield procedure | `docs/project-os/PILOT_PROTOCOL.md` |
| Current milestones | `ROADMAP.md` |
| Agent rules | `AGENTS.md` |
| Preserved runtime architecture | `ARCHITECTURE.md` |
| Preserved technical capability evidence | `docs/CAPABILITIES.json` |
| Historical broad vision | `IDEA.md` |
| Historical bounded-delivery scope | `PRACTICAL_SCOPE.md` and issue #57 |

Older `docs/ai/**`, evolution and delivery documents remain technical research unless the active scope explicitly references them.

## Repository commands

```bash
pnpm check:ai   # validate project workflow files
pnpm verify     # typecheck + lint + tests + build + workflow validation
```

Use focused checks while iterating. Runtime changes require the repository's final gate when a local checkout is available.

## Fast rule

- Small documentation correction: inspect → edit → validate links/source of truth → diff review.
- Pilot change: observed problem → smallest protocol/artifact change → use in a real pilot → record result.
- Runtime proposal: repeated pilot problem → prove deterministic automation is useful → implement one tested command.
- Open-ended request: shape the product and select one vertical slice; never convert uncertainty into unlimited platform work.