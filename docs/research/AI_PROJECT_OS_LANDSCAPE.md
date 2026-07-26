# AI project operating systems: product and methodology landscape

Status: decision research  
Date: 2026-07-27  
Decision owner: project owner  
Tracking issue: #59

## Decision question

What should CycleWarden own if coding agents already implement code well, but a solo or non-expert builder still struggles to turn an idea into a coherent project and keep work moving in the right order across many sessions?

## Working conclusion

CycleWarden should not compete with coding agents, agent IDEs, or feature-level specification tools.

The credible product gap is a lightweight, agent-neutral **project operating layer** that owns project-level intent and sequencing:

1. shape the product before code starts;
2. make important stack, architecture, data, design, authentication and security decisions explicit;
3. build a dependency-aware roadmap from small vertical slices;
4. allow exactly one active task by default;
5. select the next ready task from accepted dependencies;
6. preserve project state and decision rationale across agent sessions;
7. require task-specific evidence before marking work complete.

Feature implementation remains with Codex, Claude Code, Kiro, Cursor, Qwen or another existing coding agent. Feature-level specification may be delegated to Spec Kit, OpenSpec, Kiro Specs or plain repository documents.

## Evaluation criteria

Products and methods were compared on these questions:

- Does it guide a one-sentence idea into product scope and a first useful flow?
- Does it help choose and preserve stack, architecture, data, auth and security decisions?
- Does it maintain persistent project knowledge across sessions?
- Does it represent dependencies and identify the next valid task?
- Does it prevent unfinished work from multiplying?
- Is it independent of one model or IDE?
- Does it adapt rigor to risk and project size?
- Does it use deterministic checks where AI judgment is unnecessary?
- Can a non-expert owner understand why decisions were made?
- How much ceremony, context and token cost does it add?

## Comparable products

### GitHub Spec Kit

What it does well:

- agent-neutral Spec → Plan → Tasks → Implement workflow;
- project constitution and structured Markdown artifacts;
- clarification, checklist, cross-artifact analysis and convergence commands;
- workflow state, pause/resume, human gates and integrations with many coding agents;
- explicit guidance to decompose oversized features into smaller specs and choose the next dependency-ready roadmap entry.

Limit for the CycleWarden problem:

- the strongest core is feature-level specification and execution;
- it assumes the project constitution and major product direction can already be expressed;
- its growing workflow, extension and preset system is broader than CycleWarden's first useful product needs to be.

Decision:

- integrate with or emit compatible feature artifacts later;
- do not rebuild Spec Kit's feature SDD engine, workflow engine or extension marketplace.

Sources:

- https://github.github.io/spec-kit/
- https://github.github.io/spec-kit/reference/overview.html
- https://github.github.io/spec-kit/concepts/complex-features.html
- https://github.github.io/spec-kit/concepts/spec-of-specs.html
- https://github.github.io/spec-kit/reference/workflows.html

### Kiro

What it does well:

- persistent steering files for product, technology and project structure;
- feature specs with requirements, design and tasks;
- quick and full planning tracks depending on ambiguity and risk;
- agent hooks that can run deterministic shell checks without another model call;
- implementation task tracking in an integrated agent environment.

Limit for the CycleWarden problem:

- Kiro is an integrated product and runtime rather than a neutral project state layer;
- steering and specs help one workspace, but do not define a portable project-level roadmap and next-task contract across arbitrary agents;
- the owner still needs a reliable method for deciding what the product, first vertical slice and foundational choices should be.

Decision:

- adopt the separation between product, technology and structure knowledge;
- adopt risk-proportional spec depth and deterministic hooks;
- remain agent- and IDE-neutral instead of copying the IDE.

Sources:

- https://kiro.dev/docs/steering/
- https://kiro.dev/docs/specs/
- https://kiro.dev/docs/specs/quick-spec/
- https://kiro.dev/docs/hooks/
- https://kiro.dev/docs/hooks/actions/

### Taskmaster

What it does well:

- parses a PRD into tasks and subtasks;
- models dependencies and can return the next task;
- supports task status, complexity analysis, research and multiple agent integrations;
- carries implementation guidance, relevant files, scope boundaries and acceptance criteria.

Limit for the CycleWarden problem:

- it largely begins after a usable PRD exists;
- it does not own product shaping or justify the foundational stack and architecture;
- many AI-powered commands may require additional model configuration and cost;
- its Commons Clause license restricts offering a competing hosted product based on its code.

Decision:

- learn from dependency validation, immutable task identity and `next` selection;
- implement the minimum state logic independently; do not copy code.

Sources:

- https://github.com/eyaltoledano/claude-task-master
- https://github.com/eyaltoledano/claude-task-master/blob/main/docs/command-reference.md

### BMAD Method

What it does well:

- covers analysis, planning, solutioning and implementation;
- adapts planning depth to project complexity;
- provides guidance about what to do next;
- separates product, architecture, UX, development and test concerns;
- supports multiple AI coding environments.

Limit for the CycleWarden problem:

- the full method contains many agents, workflows and optional modules;
- role simulation and lifecycle breadth can create high ceremony and context cost for a solo builder;
- CycleWarden does not need a persona system or a universal workflow framework to prove value.

Decision:

- adopt adaptive depth and explicit phase guidance;
- reject multi-agent personas, party/debate modes and dozens of workflows in the MVP.

Sources:

- https://docs.bmad-method.org/
- https://docs.bmad-method.org/reference/workflow-map/
- https://github.com/bmad-code-org/BMAD-METHOD

### OpenSpec

What it does well:

- lightweight agreement on what to build before code;
- change proposals, short specs and task lists;
- useful for brownfield evolution and keeping a change's intent visible;
- smaller conceptual surface than a complete lifecycle framework.

Limit for the CycleWarden problem:

- primarily change/feature oriented;
- does not decide the whole product, foundational stack, architecture or project-wide task order.

Decision:

- learn from lightweight change artifacts and brownfield adoption;
- do not duplicate its proposal/spec workflow.

Source:

- https://openspec.dev/docs

## Established software-engineering methods to retain

### Shape Up: bounded shaping before implementation

Useful principles:

- shape work so it is rough but solved and bounded;
- set an appetite instead of pretending estimates are exact;
- divide work into meaningful scopes and avoid an endless backlog.

CycleWarden implication:

- the first output is a bounded product/vertical-slice decision, not a hundred generated tasks;
- roadmap entries should be independently valuable slices with explicit non-goals.

Source: https://basecamp.com/shapeup/0.3-chapter-01

### Architectural Decision Records

AWS guidance identifies repeated decision failure modes: no decision, an unexplained decision, or a forgotten decision. ADRs record context, the decision and consequences; accepted records are superseded rather than silently rewritten.

CycleWarden implication:

- significant choices such as framework, database, authentication, persistence, external services and architecture boundaries receive concise decision records;
- normal implementation details do not require ADR ceremony.

Sources:

- https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/introduction.html
- https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/adr-process.html

### C4 architecture maps

C4 provides a small hierarchy of system, container, component and code views without forcing one notation.

CycleWarden implication:

- require only the system context and container view for most new products;
- add component detail only when a boundary is difficult or risky.

Source: https://c4model.com/

### OWASP ASVS

ASVS provides a selectable, testable catalogue of web security requirements rather than vague instructions to “make it secure.”

CycleWarden implication:

- classify project data and risk first;
- select relevant security requirements for authentication, authorization, validation, sessions, secrets and data protection;
- do not copy the entire standard into every project.

Source: https://owasp.org/www-project-application-security-verification-standard/

## Product-layer model

The ecosystem suggests a useful separation:

```text
Project intent and constraints       ← CycleWarden owns
Product shaping and first flow       ← CycleWarden owns
Foundation decisions and ADRs        ← CycleWarden owns
Roadmap, dependencies and next task  ← CycleWarden owns
Feature specification                ← delegate or use lightweight CW task contract
Implementation                       ← coding agent owns
Tests and deterministic checks       ← repository/tooling owns
Human acceptance                     ← project owner owns
```

CycleWarden's moat cannot be “generate a PRD” or “generate tasks”; mature products already do that. Its hypothesis is **continuity and control across the whole project**, especially for an owner who does not know which product and engineering questions must be answered or which task should happen next.

## Proposed minimum product

### Repository-local artifacts

```text
.cyclewarden/
├── project.md          # target user, problem, constraints and success
├── product.md          # core flow, scope and non-goals
├── design.md           # UX principles and screen/interaction map when relevant
├── architecture.md     # system context, containers and boundaries
├── roadmap.md          # vertical slices, dependencies and status
├── status.yaml         # phase, active task, blockers and unresolved decisions
├── decisions/          # concise accepted/superseded ADRs
└── tasks/              # one bounded contract per task
```

### Deterministic CLI candidate

```text
cw init      scaffold a new project operating model
cw adopt     inspect and model an existing repository
cw status    show phase, active task, blockers and unresolved decisions
cw next      return the next dependency-ready task
cw validate  validate artifact links, dependencies, one-active-task and evidence fields
```

The CLI should not call a model in the MVP. The user's existing agent reads and writes the artifacts. This avoids additional provider configuration, duplicate token spend and vendor lock-in.

### Task statuses

```text
proposed → ready → active → verify → done
                    ↘ blocked
proposed/ready/blocked → dropped
```

Exactly one task may be `active` by default. A task can become `ready` only when its dependencies are `done` and unresolved foundational decisions do not block it.

## Differentiation tests

CycleWarden must prove all of the following before substantial runtime work:

1. A non-expert owner reaches a coherent first vertical slice without choosing technology randomly.
2. A new agent session can state the product, accepted decisions, active task and next task from repository artifacts.
3. The system prevents or exposes task jumping and silent stack/architecture changes.
4. `cw next` adds value beyond a plain checklist by respecting dependencies and blockers.
5. Artifact overhead remains lower than adopting a complete lifecycle framework.
6. Feature-level SDD can be delegated rather than duplicated.

## Rejected MVP directions

- coding-agent implementation runtime;
- multi-agent personas or debates;
- hosted dashboards and multi-user collaboration;
- model routing and provider abstraction;
- recursive self-improvement;
- deployment and rollback;
- a general workflow language;
- a complete design-system generator;
- automatically selecting a fashionable stack without project constraints;
- generating a large backlog before validating the first flow.

## Research limitations

- Product documentation describes intended behavior; it does not prove user outcomes.
- Popularity and repository stars do not prove CycleWarden's hypothesis.
- The comparison did not run controlled usability tests.
- The proposed differentiation remains a hypothesis until one greenfield and one brownfield pilot are completed.

## Decision

Proceed with an artifact-first manual pilot tracked by issue #59. Build deterministic CLI state management only after the manual protocol demonstrates repeated value. Integrate with mature feature-level tools where useful rather than recreating them.