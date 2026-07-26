# Historical bounded-delivery validation scope

Status: superseded by [`PROJECT_OS_SCOPE.md`](PROJECT_OS_SCOPE.md)  
Historical tracking issue: #57  
Superseded by Project OS pilot: #59

## Why this scope existed

CycleWarden previously tested whether a solo developer benefited from a bounded delivery workflow:

```text
real project task
→ bounded context and acceptance criteria
→ coding agent implementation
→ test / lint / typecheck / build
→ scope and patch verification
→ human merge decision
```

Its intended outcomes were:

1. prepare a bounded task with relevant repository context;
2. run or hand off implementation in an isolated Git branch or worktree;
3. verify scope, tests and changed files independently from the implementer;
4. produce enough evidence for a human to decide whether to merge.

The experiment compared direct coding-agent tasks with CycleWarden-assisted tasks and recorded preparation time, retries, scope escapes, failures, review time, friction and final result.

## What was learned

The research and practical preflight established useful engineering principles:

- task scope and acceptance criteria matter;
- build success does not prove scope correctness;
- a neighboring behavior check can expose shared-code regressions;
- implementation should remain in an isolated branch or worktree;
- the human owner must retain merge and production decisions;
- deterministic checks should run before adding another model call.

It also exposed a product problem:

- modern coding agents already implement, test, review and manage Git effectively;
- CycleWarden's execution lifecycle added setup and ceremony before demonstrating unique value;
- the stronger unmet problem appeared one level above individual tasks: shaping an entire project, preserving foundation decisions and maintaining task order across sessions.

## Historical decision rules

The old scope would have retained:

- task preparation if it materially improved clarity;
- execution orchestration if it reduced repeated manual effort without comparable friction;
- verification if it caught meaningful errors or clarified merge decisions;
- no active product if direct coding-agent use performed as well or better.

That evaluation is not being represented as a completed controlled experiment. Issue #57 and its task records remain historical evidence.

## Preserved implementation

The repository still contains research code for:

- repository inspection and assessment;
- evidence and lifecycle records;
- trusted-local execution;
- isolated worktrees;
- scope and patch verification;
- separate implementer and verifier identities;
- draft pull-request publication;
- CI and sandbox proofs.

This code is preserved, not deleted. It is not the active product surface and does not create a maintenance obligation.

## Reuse rule

A component from the bounded-delivery system may be reused only when a Project OS pilot exposes a concrete need and reuse is smaller than building or integrating another solution.

The active direction, boundaries and experiments now live in:

- [`PROJECT_OS_SCOPE.md`](PROJECT_OS_SCOPE.md);
- [`docs/research/AI_PROJECT_OS_LANDSCAPE.md`](docs/research/AI_PROJECT_OS_LANDSCAPE.md);
- [`docs/project-os/PILOT_PROTOCOL.md`](docs/project-os/PILOT_PROTOCOL.md);
- [`ROADMAP.md`](ROADMAP.md);
- issue #59.