# Hubcode pilot for CycleWarden development

Issue: [#68](https://github.com/Thunderkill016/cyclewarden/issues/68)

## Decision being tested

CycleWarden should not rebuild a control plane that already exists for Codex and
Claude Code. This pilot uses Hubcode for agent sessions, isolated Git worktrees,
task visibility, and review state while CycleWarden keeps only the product layer
that Hubcode does not provide.

This is an external development workflow. Hubcode is not added as an application
runtime dependency and is not required by CycleWarden users.

## Responsibility split

| Layer | Responsibility |
| --- | --- |
| Hubcode | Launch Codex or Claude Code, create isolated worktrees, show task state, retain sessions, and expose diffs for review |
| GitHub | Issues, branches, pull requests, durable change history, and the final merge boundary |
| CycleWarden repository | Product context, business intent, acceptance criteria, verification evidence, and owner-facing decisions |
| Human owner | Approve scope, accept risks, request corrections, merge, deploy, or stop |

CycleWarden must not duplicate Hubcode's worktree manager, agent session manager,
Kanban board, or remote-control surface during this pilot.

## Prerequisites

- Node.js 20 or later
- pnpm 9 or later
- Git
- a working Codex or Claude Code CLI authenticated with the owner's account
- Hubcode desktop app or CLI

Install and start the CLI path:

```bash
npm install -g @hubcode/cli
hubcode
```

Hubcode manages an already-installed agent CLI. Run `codex login status` or the
provider's equivalent and verify a direct agent command works before launching
the first task.

## Repository bootstrap

The root [`hubcode.json`](../../hubcode.json) configures every new Hubcode
worktree to:

1. install the pinned pnpm workspace dependencies with the lockfile;
2. copy `apps/web/.env.local` from the source checkout when that local file
   exists.

Secrets remain local and untracked. Do not add `.env.local` to Git.

## First validation run

Use this pull request itself as the first low-risk verification run after the
branch is available locally:

```bash
hubcode run \
  --provider codex \
  --worktree verify-hubcode-pilot \
  --base agent/hubcode-pilot \
  "Read AGENTS.md and GitHub issue #68. Review the Hubcode pilot changes as an independent verifier. Inspect hubcode.json, docs/practical/HUBCODE_PILOT.md, AGENTS.md, and README.md. Run the narrow checks needed for documentation/configuration changes, then run pnpm verify if the environment supports it. Do not merge, deploy, or make unrelated changes. Report evidence, blind spots, and a clear accept or reject recommendation."
```

Claude Code can be used by replacing `--provider codex` with the provider name
configured by Hubcode.

The verifier must not be the implementation session. A failed check is evidence,
not permission to weaken the check.

## Headless smoke result — 2026-07-27

The pilot was executed on a clean GitHub Actions Ubuntu 24.04 runner to test the
control-plane mechanics without using a developer machine.

Observed versions:

- Node.js `22.23.1`;
- pnpm `9.15.0`;
- Hubcode CLI and daemon `2.8.4`;
- Codex CLI `0.145.0`.

Observed behavior:

1. Hubcode installed and started its local daemon successfully.
2. The daemon detected the installed Codex CLI.
3. Hubcode created an isolated `hubcode-ci-smoke` Git worktree from
   `agent/hubcode-pilot`.
4. Hubcode created a persistent Codex agent record tied to that worktree.
5. The agent failed before reading the repository because the disposable runner
   had no Codex OAuth session or API key. The provider returned HTTP `401` with
   `Missing bearer or basic authentication in header`.
6. `hubcode run` returned process exit code `0` even though the recorded agent
   status was `error`. Automation must therefore inspect the agent status or
   timeline instead of treating the command exit code as sufficient proof.

Verdict: **blocked by provider authentication, not rejected**. The smoke run
validated daemon startup, provider discovery, branch resolution, worktree
creation, and agent-state persistence. It did not validate prompt execution,
repository understanding, implementation, or independent verification. Those
must be tested on an owner-controlled machine where Codex or Claude Code is
already authenticated.

The temporary CI workflows used to collect this evidence were removed after the
run. They are not part of the proposed integration.

## Workflow for the next real CycleWarden task

### 1. Prepare one bounded GitHub issue

The issue must contain:

- current behavior and evidence;
- the user or product outcome;
- explicit in-scope and out-of-scope boundaries;
- acceptance criteria;
- required checks;
- risk gates and owner decisions.

Do not put an entire roadmap into one issue.

### 2. Create an isolated Hubcode worktree

Create the worktree from `main`, attach the issue in the Hubcode UI, and choose
Codex or Claude Code as the implementation agent. One worktree represents one
reviewable change.

Suggested implementation prompt:

```text
Read AGENTS.md, the attached GitHub issue, and only the linked project documents
needed for this task. Inspect current behavior before editing. Restate evidence,
blind spots, scope, and acceptance criteria. Save a plan when AGENTS.md requires
one. Implement the smallest reviewable slice. Run focused checks while working
and pnpm verify before reporting completion. Do not merge, deploy, touch
production, or broaden the task.
```

### 3. Run an independent verifier

After implementation stops, launch a fresh agent session in the same worktree.
The verifier reads the issue, plan, final diff, and test evidence. It must check:

- acceptance criteria coverage;
- changed-file scope;
- regressions and security boundaries;
- whether `pnpm verify` actually passed;
- unresolved assumptions and manual review items.

The verifier returns `accept`, `reject`, or `blocked`. It does not merge.

### 4. Human review

The owner reviews the business outcome, visible behavior, remaining risks, and
GitHub diff. Only the owner decides whether to open or merge a pull request.
CycleWarden and Hubcode must never auto-merge or deploy.

### 5. Record pilot evidence

Copy [`TASK_RECORD_TEMPLATE.md`](TASK_RECORD_TEMPLATE.md) and record:

- Hubcode setup time;
- context preparation time;
- agent retries;
- scope escapes;
- verifier findings;
- owner review time;
- friction caused or removed;
- final outcome.

## Success criteria

Keep Hubcode as the development control plane only if a real task demonstrates:

- fresh worktrees bootstrap without repeated manual setup;
- the linked issue and `AGENTS.md` reliably constrain the coding agent;
- implementer and verifier sessions remain visibly separate;
- task, branch, session, diff, and review state are easier to understand;
- CycleWarden can delete or freeze equivalent orchestration ambitions.

## Kill criteria

Stop the Hubcode integration experiment if:

- worktree setup is less reliable than direct Git worktrees;
- agents repeatedly miss repository instructions or linked issue boundaries;
- task state is duplicated across Hubcode, GitHub, and CycleWarden without a
  clear source of truth;
- the workflow adds more owner effort than direct Codex or Claude Code usage;
- the useful parts require a paid service rather than the free self-hosted
  app, daemon, and CLI.

## Security boundary

Hubcode launches native coding-agent processes on the owner's machine. Those
processes inherit the files, credentials, tools, and network available to the
local user. An isolated Git worktree prevents ordinary branch interference; it
is not a security sandbox.
