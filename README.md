# ✦ CycleWarden

**Experimental local workflow for bounded AI-assisted software delivery**

CycleWarden helps a solo developer prepare a real repository task, hand implementation to a coding agent, verify the resulting change, and make a human merge decision.

> **Current direction:** CycleWarden is in practical validation mode. The previous full-platform roadmap is frozen. Active work is tracked in [issue #57](https://github.com/Thunderkill016/cyclewarden/issues/57) and defined in [`PRACTICAL_SCOPE.md`](PRACTICAL_SCOPE.md).

CycleWarden was formerly named Shipkit. Existing state and configuration compatibility are documented in [`docs/RENAMING_FROM_SHIPKIT.md`](docs/RENAMING_FROM_SHIPKIT.md).

## Current product hypothesis

For a solo developer using Codex or another coding agent on real repositories, bounded task preparation and independent verification can reduce:

- unclear task scope;
- accidental changes outside the request;
- repeated implementation attempts;
- uncertainty about whether a change is ready to merge.

The repository does **not** currently claim that CycleWarden is better than using a coding agent directly. That must be decided from six real project tasks.

## Practical workflow

```text
real task
→ repository context and bounded scope
→ coding agent implementation
→ test / lint / typecheck / build
→ changed-file and patch verification
→ human review and merge decision
```

The useful surface today is:

1. inspect and assess a repository;
2. prepare an evidence-backed execution handoff;
3. run one trusted local implementation in an isolated branch or worktree;
4. require a different verifier before accepting the change;
5. optionally publish the exact verified commit as a draft pull request.

## Hubcode development pilot

[Issue #68](https://github.com/Thunderkill016/cyclewarden/issues/68) tests Hubcode as the external control plane for developing CycleWarden with Codex or Claude Code. The repository-level [`hubcode.json`](hubcode.json) bootstraps isolated worktrees, while [`docs/practical/HUBCODE_PILOT.md`](docs/practical/HUBCODE_PILOT.md) defines the implementation, independent verification, evidence, and human-review workflow.

During this pilot, CycleWarden does not rebuild Hubcode's agent-session manager, worktree orchestration, or Kanban surface. Hubcode remains a development tool rather than an application runtime dependency.

## Practical validation

Issue #57 compares:

- three real tasks using the normal coding-agent workflow;
- three comparable real tasks using CycleWarden.

Fixtures and synthetic work do not count. Every task records preparation time, implementation retries, scope escapes, checks, review time, friction, and final outcome using [`docs/practical/TASK_RECORD_TEMPLATE.md`](docs/practical/TASK_RECORD_TEMPLATE.md).

After six tasks:

- keep task preparation only if it materially improves clarity or context recovery;
- keep execution orchestration only if it removes repeated work without comparable friction;
- keep verification if it catches meaningful errors or clarifies merge decisions;
- freeze CycleWarden as a research prototype if direct coding-agent use performs as well or better.

## Frozen during validation

The following are not active product goals:

- multi-project web dashboards;
- deployment and rollback automation;
- outcome analytics and recursive learning;
- MCP/A2A integration;
- multi-user SaaS;
- additional coding-agent adapters;
- additional sandbox backends;
- broad research-provider expansion;
- persistence hardening unrelated to a real task blocker.

Existing code for these areas is preserved as technical evidence. It is not deleted, but architecture completeness no longer justifies new work.

## Existing technical capabilities

The repository already contains:

- a deterministic lifecycle and evidence core;
- repository inspection and readiness assessment;
- bounded repository research and `ExecutionHandoff` records;
- trusted-local command and optional Codex CLI delivery profiles;
- clean-base and isolated worktree requirements;
- changed-file scope checks and external-symlink rejection;
- separate implementer and verifier identities;
- test, lint, typecheck and build verification commands;
- local commit creation only after an accepted verdict;
- explicit opt-in draft pull-request publication;
- CI, Docker hostile-check fixtures, and Node.js 20/22/24 package verification.

These mechanisms are implementation details supporting the practical workflow, not separate roadmap obligations.

## Important boundaries

- Trusted-local execution is **not a security sandbox**. Commands inherit the current operating-system user's accessible filesystem, credentials, tools, and network.
- The web workspace ends at the execution handoff. Execute, verify, and publish remain CLI operations.
- Draft pull-request publication requires an installed and authenticated GitHub CLI.
- CycleWarden never automatically merges, deploys, accesses production secrets, or spends money.
- CI success proves technical checks passed; it does not prove product value.

## Quickstart

### Prerequisites

- Node.js 20 or later
- pnpm 9 or later
- Git
- GitHub CLI only when publishing a draft pull request

### Install

```bash
git clone https://github.com/Thunderkill016/cyclewarden.git
cd cyclewarden
pnpm install
pnpm --filter @cyclewarden/evolution-core build
pnpm evolve -- init
```

### Inspect a trusted repository

```bash
pnpm evolve -- start \
  --id practical:task-001 \
  --objective "Prepare one bounded real project task" \
  --autonomy A2 \
  --risk R1

pnpm evolve -- inspect practical:task-001 \
  --project-root /absolute/path/to/trusted/repository

pnpm evolve -- assess practical:task-001 \
  --project-root /absolute/path/to/trusted/repository

pnpm evolve -- show practical:task-001
```

Repository research can then produce a reviewed `ExecutionHandoff`.

### Run trusted-local delivery

See [`docs/evolution/GOVERNED_DELIVERY.md`](docs/evolution/GOVERNED_DELIVERY.md) for the manifest contract and safety boundaries.

```bash
pnpm deliver -- execute <cycle-id> \
  --root /absolute/path/to/project/.cyclewarden \
  --project-root /absolute/path/to/trusted/repository \
  --manifest delivery.json \
  --actor owner-implementation-agent \
  --trusted-repository

pnpm deliver -- verify <cycle-id> \
  --root /absolute/path/to/project/.cyclewarden \
  --project-root /absolute/path/to/trusted/repository \
  --actor independent-verifier
```

Publishing is a separate explicit operation:

```bash
pnpm deliver -- publish <cycle-id> \
  --root /absolute/path/to/project/.cyclewarden \
  --project-root /absolute/path/to/trusted/repository \
  --actor owner-publisher \
  --draft-pr \
  --remote origin \
  --base main
```

## Documentation

| Document | Purpose |
| --- | --- |
| [`PRACTICAL_SCOPE.md`](PRACTICAL_SCOPE.md) | Active product direction and frozen boundaries |
| [`docs/practical/TASK_RECORD_TEMPLATE.md`](docs/practical/TASK_RECORD_TEMPLATE.md) | Evidence template for the six-task comparison |
| [`docs/practical/HUBCODE_PILOT.md`](docs/practical/HUBCODE_PILOT.md) | Hubcode setup, worker-verifier workflow, success criteria, and kill criteria |
| [`ROADMAP.md`](ROADMAP.md) | Current practical validation roadmap |
| [`docs/evolution/GOVERNED_DELIVERY.md`](docs/evolution/GOVERNED_DELIVERY.md) | Trusted-local execution and verification contract |
| [`docs/CAPABILITIES.json`](docs/CAPABILITIES.json) | Machine-readable technical capability evidence |
| [`IDEA.md`](IDEA.md) | Historical broad product vision retained for reference |

## License

Distributed under the MIT License. See [`LICENSE`](LICENSE).
