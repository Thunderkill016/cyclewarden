# Project model — CycleWarden practical validation

Status: active practical snapshot  
Last verified: 2026-07-26  
Active issue: #57  
Current safe autonomy ceiling: A2 for arbitrary repositories; A3 remains experimental and trusted-local only

## Product identity

CycleWarden is currently an experimental local workflow for a solo developer using coding agents on real repositories.

Its active product loop is:

```text
real task
→ bounded repository context and acceptance criteria
→ coding-agent implementation
→ independent scope and project-check verification
→ human merge decision
```

The previous integrated platform identity is preserved in Git history, [`../../IDEA.md`](../../IDEA.md), and closed issue #9. It is not the active roadmap.

## Current user

The validation user is the repository owner operating CycleWarden on their own trusted projects.

No current claim is made for:

- teams or organizations;
- hosted multi-user use;
- public demand;
- product-market fit;
- safe untrusted execution;
- deployment governance;
- measured recursive improvement.

## Repository areas

| Area | Current role | Development status |
| --- | --- | --- |
| `packages/evolution-core` | Internal technical foundation for inspection, evidence and lifecycle state | Use as-is unless a real task is blocked |
| trusted-local delivery packages | Isolated worktree implementation, scope checks and independent verification | Under practical evaluation |
| `apps/web` | Experimental inspection and research workspace | Frozen beyond task-blocking defects |
| research intelligence | Existing bounded repository and public-source evidence machinery | Frozen as a product workstream |
| shared auth/data/mail/storage/payment packages | Historical application-foundation work | Not part of the active product hypothesis |
| persistence, recovery and control records | Existing internal reliability mechanisms | Frozen beyond concrete defects |
| deployment, measurement and learning plans | Historical platform scope | Not planned during validation |
| `docs/practical` | Real-task records and comparison evidence | Active |

## Capabilities under evaluation

### Prepare

Candidate value:

- recover relevant repository context;
- define a clear goal;
- bound allowed and forbidden scope;
- define acceptance criteria and verification commands.

### Execute

Candidate value:

- isolate changes in Git;
- hand implementation to an existing coding agent;
- reduce repeated manual setup;
- capture changed files and command outcomes.

Execution orchestration is retained only if its saved work exceeds its setup and ceremony.

### Verify

Candidate value:

- enforce changed-file scope;
- run project-defined test, lint, typecheck and build commands;
- reject patch drift;
- keep verifier identity separate from the implementer;
- make the human merge decision clearer.

## Existing technical boundaries

- Trusted-local execution is not a security sandbox.
- Commands may access resources available to the current operating-system user.
- The web workspace does not execute, verify or publish changes.
- Draft pull-request publication requires explicit operator confirmation and an authenticated GitHub CLI.
- CycleWarden does not merge, deploy, access production secrets or authorize spending.
- Passing CI establishes technical compatibility only.

## Practical validation protocol

Complete six real tasks:

- three through direct coding-agent usage;
- three through CycleWarden assistance.

Each task must use [`../practical/TASK_RECORD_TEMPLATE.md`](../practical/TASK_RECORD_TEMPLATE.md) and record preparation time, retries, scope escapes, verification findings, review time, friction and final outcome.

Fixtures and CycleWarden-only demonstration work do not count.

## Decision states after validation

1. **Preparation tool** — keep context and task-contract generation only.
2. **Verification gate** — keep independent verification only.
3. **Thin prepare + verify workflow** — keep both if each repeatedly provides value.
4. **Research prototype** — freeze active development if direct coding-agent use performs as well or better.

## Frozen capabilities

Do not expand:

- multi-project web operation;
- hosted or multi-user state;
- release, deployment and rollback;
- product analytics or outcome dashboards;
- memory promotion or recursive learning;
- MCP/A2A;
- additional agent adapters;
- additional sandbox backends;
- broad research sources;
- persistence hardening unrelated to a real task blocker.

## Re-entry rule

A frozen capability may return only when at least two real task records show the same material problem and a bounded implementation is the smallest credible experiment.
