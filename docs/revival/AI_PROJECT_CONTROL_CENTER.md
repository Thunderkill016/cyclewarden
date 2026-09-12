# CycleWarden Revival — AI Project Control Center

Status: revival proposal on branch `revive/ai-project-control-center`.

## Product

A local-first control center for a solo builder who uses multiple AI coding agents across many repositories.

The product should answer four questions immediately:

1. What projects are active?
2. What is each agent doing right now?
3. What needs my decision?
4. What can safely ship?

It is not another chatbot. It supervises existing tools such as Codex, Claude Code, Gemini CLI, Cursor Agent and browser-based ChatGPT workspaces.

## Repositories being recombined

### `cyclewarden` — orchestration and verification core
Keep:
- bounded task contracts;
- isolated branch/worktree execution;
- independent verification;
- evidence-backed merge decisions;
- provider adapters and existing verification scripts.

Change:
- restore a narrow dashboard, but only as an operational control surface;
- remove the earlier ambition to own the full product lifecycle.

### `chatgpt-tabflow` — browser workspace and context capture
Reuse ideas/code where compatible:
- project workspace model;
- session stash/restore;
- project vault/context handoff;
- multi-chat workspace;
- tab sleeping/discarding;
- conversation status awareness.

Target integration:
- TabFlow becomes an optional browser companion that reports ChatGPT sessions into the same project/activity model.

### `atoryn-telegram` — remote control and notifications
Reuse:
- Cloudflare/Telegram command surface;
- durable reminders and state;
- voice input;
- URL research/read path;
- secure single-user lock.

Target integration:
- phone commands such as `status`, `what needs me?`, `pause agent X`, `show failed checks`, `remind me when task Y finishes`;
- push notifications only for blocked/failed/ready-to-ship states.

### `worktools` — local project/job/asset foundation
Reuse architectural components where generic enough:
- project manifest and multi-project workspace concepts;
- filesystem watcher;
- job lifecycle/recovery;
- capability-based access control;
- local desktop shell hardening;
- asset/project health patterns.

Do not import the media-specific product surface into this product.

### `agent-first-software-playbook` — repository contract
Reuse:
- `AGENTS.md` as canonical agent entrypoint;
- `agent-contract.json` pattern;
- context routing;
- risk-proportional verification;
- exact-head evidence;
- failure-to-guardrail loop.

This becomes the onboarding contract for every managed repository.

## External repositories used as references

Do not vendor code blindly. Confirm license and copy only when justified.

- `alamops/agetor` (MIT): local-first agent kanban, per-task worktrees, agent output streaming, approvals/questions surfaced outside terminal.
- `wannysim/pando`: staged SPEC → PLAN → TEST → IMPL ↔ REVIEW → PR pipeline with deterministic gate evidence.
- `troyshu/agent-overseer`: lightweight browser PTY supervision and waiting-for-input detection.
- `gitpcl/openorchestrator`: decision-first surface organized around NEEDS YOU / READY TO SHIP / IN FLIGHT and conflict detection.
- `xinnaider/orbit`: split-pane multi-agent sessions, remote/SSH sessions, persistent history and sub-agent monitoring.
- `stefan1294/agent-orchestrator`: framework detection, parallel tracks, retry/failure classification and browser verification.

## The new UX

Avoid a generic Kanban-first interface.

Home should be an operational decision surface:

```text
AI PROJECT CONTROL CENTER

NEEDS YOU (2)
- MoneyFlow / task #143 — agent asks for schema decision
- TabFlow / task #88 — visual verification failed

READY TO SHIP (1)
- AtoRyn / PR #31 — tests + review green, exact head verified

IN FLIGHT (4)
- WorkTools — Codex — implementing
- Nếp — Claude — testing
- TabFlow — ChatGPT — researching
- Cờ Tướng — Gemini — blocked on rate limit

PROJECTS
MoneyFlow   2 active   1 blocked
TabFlow     1 active   clean
WorkTools   1 active   3 checks running
...
```

Primary interaction is not chatting. It is making decisions and delegating work.

## Core domain model

```text
Project
  ├─ RepositoryContract
  ├─ Workspace
  ├─ Task
  │   ├─ Run
  │   ├─ AgentSession
  │   ├─ Worktree
  │   ├─ Evidence
  │   └─ Decision
  ├─ Event
  └─ Notification
```

### Task states

```text
BACKLOG
→ READY
→ RUNNING
→ NEEDS_INPUT | VERIFYING
→ READY_TO_SHIP | FAILED
→ MERGED | CLOSED
```

State transitions must come from observable events, not model narration.

## V1 scope

V1 is deliberately smaller than historical CycleWarden.

Must have:
- register multiple local Git repositories;
- detect/read each repository contract;
- create one isolated worktree per task;
- launch Codex and Claude Code first;
- stream output/status;
- detect waiting/blocked/completed sessions;
- run repository-defined verification commands;
- show exact diff, checks and evidence before merge;
- dashboard with NEEDS YOU / READY TO SHIP / IN FLIGHT;
- persistent SQLite state;
- Telegram notifications for meaningful state changes.

Nice later:
- Gemini/Cursor/OpenCode adapters;
- TabFlow browser companion;
- browser/E2E verification;
- SSH remote workers;
- cost/quota telemetry;
- automatic task decomposition;
- cross-project dependency graph.

Explicitly not V1:
- autonomous product management;
- automatic production deployment;
- recursive self-improvement;
- finance/learning/news features;
- broad SaaS/multi-user functionality.

## Migration order

1. Preserve existing CycleWarden verification/task-domain tests.
2. Introduce a small shared `ProjectRegistry` and SQLite operational store.
3. Add process/session abstraction for Codex + Claude CLI.
4. Add worktree lifecycle adapter.
5. Add event stream and decision-oriented web UI.
6. Add verifier evidence model and exact-head merge gate.
7. Port AtoRyn Telegram as a remote notification/control adapter.
8. Port generic project/job watcher primitives from WorkTools only where they reduce duplication.
9. Add TabFlow companion after the local control center is stable.
10. Run the product against the user's real repositories before adding more scope.

## Success criteria

This revival is successful only if it reduces manual coordination in real work.

Measure:
- number of simultaneously supervised agent tasks;
- time spent finding which agent needs attention;
- agent collisions / worktree conflicts;
- failures caught before merge;
- time from agent completion to human decision;
- manual terminal/tab switching avoided;
- false notifications.

The project should remain narrow if those metrics do not improve.
