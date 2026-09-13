# CycleWarden Control Core

Local runtime for the AI Project Control Center.

The browser is only a control surface. Git, local repository access, worktrees, Codex processes and verification commands stay in this daemon on the developer machine.

## Run

From the repository root:

```bash
pnpm dev:control-center
```

This starts:

- the local core on `http://127.0.0.1:4318`;
- the existing Next.js web app on `http://localhost:3000`.

Open:

```text
http://localhost:3000/app/control-center
```

The page should show `Git online`, `Codex online` and `Core live` when the local prerequisites are available.

To run only the daemon:

```bash
pnpm control:start
```

To run its tests:

```bash
pnpm control:test
```

## Runtime flow

Default compatibility mode:

```text
register local Git repository
  -> create bounded task
  -> create isolated branch + worktree
  -> run `codex exec --json --sandbox workspace-write`
  -> stream JSONL activity into the local event store
  -> run repository verification scripts
  -> collect exact-head Git evidence
  -> READY_TO_SHIP or FAILED
```

The runner asks Codex to commit intended changes. A task cannot become `READY_TO_SHIP` while its worktree is dirty.

### Interactive Codex app-server mode

Interactive approvals remain opt-in while the live path is being dogfooded:

```bash
export CYCLEWARDEN_CODEX_MODE="app-server"
pnpm dev:control-center
```

The local core then starts `codex app-server --stdio`, performs the initialize/thread/turn handshake, explicitly requests `approvalPolicy: on-request`, `approvalsReviewer: user`, and `sandbox: workspace-write`, and routes command/file-change approval RPCs into `NEEDS_INPUT`.

The Control Center exposes only bounded decisions:

- `accept` — allow this request once;
- `acceptForSession` — allow the matching request for the current Codex session;
- `decline` — deny the request but keep the turn alive when Codex supports that path;
- `cancel` — cancel the requested operation/turn path.

There is no arbitrary approval payload or remote shell input. Decisions are correlated to the exact server request ID; stale or duplicate decisions are rejected.

Optional safety tuning:

```bash
export CYCLEWARDEN_CODEX_RPC_TIMEOUT_MS="15000"
export CYCLEWARDEN_CODEX_APPROVAL_TIMEOUT_MS="900000"
```

RPC timeout defaults to 15 seconds. Approval timeout defaults to 15 minutes. An expired approval is answered `cancel` and the task fails closed; it is never auto-approved.

The local decision endpoint used by the web UI is:

```text
POST /tasks/:taskId/decision
{"decision":"accept"}
```

## Verification discovery

For Node repositories the core detects these root `package.json` scripts, when present, in this order:

1. `typecheck`
2. `lint`
3. `test`
4. `build`

When `agent-contract.json` provides safe `alwaysChecks`, the core includes those repository-defined checks too. Unsupported shell-like commands are rejected instead of executed through a shell.

A failing check stops the task in `FAILED`. This is intentionally conservative.

## Local state

Default state directory:

```text
~/.cyclewarden/control-center/
├── state.json
└── worktrees/
```

Override it with:

```bash
CYCLEWARDEN_CONTROL_DATA_DIR=/absolute/path pnpm control:start
```

If the core restarts while a task is `RUNNING` or `VERIFYING`, it reconciles the task to `INTERRUPTED`, records bounded recovery evidence, and requires an explicit manual Resume. It does not silently restart agent work.

## Live UI

The UI receives committed snapshots over Server-Sent Events:

```text
GET /events
```

The normal JSON snapshot remains available at:

```text
GET /snapshot
```

## Optional AtoRyn Telegram bridge

The core can connect outward to AtoRyn so Telegram becomes a remote control surface without exposing this local HTTP server.

```text
Telegram -> Cloudflare Worker / Durable Object <- HTTPS polling from Control Core
                                                -> local Codex/Git
```

Configure the local machine:

```bash
export CYCLEWARDEN_ATORYN_URL="https://<your-atoryn-worker-host>"
export CYCLEWARDEN_ATORYN_TOKEN="<same secret stored as CONTROL_BRIDGE_TOKEN in AtoRyn>"
pnpm dev:control-center
```

Optional:

```bash
export CYCLEWARDEN_CORE_ID="my-linux-workstation"
export CYCLEWARDEN_ATORYN_POLL_MS="5000"
```

The bridge is disabled when URL/token are absent. It is intentionally outbound-only and production URLs must use HTTPS.

The synchronized snapshot excludes local paths, task objectives, acceptance criteria, Codex output and file contents. V0.3 supports `run`, `cancel`, and bounded approval `decision` commands for tasks that already exist in the local store. Approval callbacks are request-bound, stale-safe, and still validated by the local runner before Codex receives any decision.

The local core polls for commands at the configured cadence (5 seconds by default). Snapshot changes sync immediately; when nothing changes, snapshot sync falls back to a 15-second heartbeat instead of retransmitting on every poll.

Remote delivery is at-least-once. The core persists `remote.command_started` / `remote.command_completed` events so a redelivered command does not execute its side effect twice.

Bridge health and the active Codex runtime mode are visible in:

```text
GET /health
GET /doctor
```

### Live Codex × AtoRyn approval dogfood

V0.4 adds an explicit opt-in canary for the real topology. It does **not** start another core. It talks to the already-running loopback Control Core, verifies that the live AtoRyn Worker advertises approval decisions, creates an isolated Git fixture under the Control Center data directory, and starts a real app-server task.

Start the real core first with app-server mode and a configured AtoRyn bridge:

```bash
export CYCLEWARDEN_CODEX_MODE="app-server"
export CYCLEWARDEN_ATORYN_URL="https://<your-live-atoryn-worker>"
export CYCLEWARDEN_ATORYN_TOKEN="<bridge-secret>"
pnpm dev:control-center
```

Then, in another terminal:

```bash
export CYCLEWARDEN_LIVE_APPROVAL_DOGFOOD_CONFIRM="RUN:LIVE-ATORYN-APPROVAL"
pnpm control:dogfood
```

The canary refuses to run unless all of these are true:

- `/doctor` reports the running core is healthy and actually using `app-server`;
- the AtoRyn bridge is enabled and recently connected;
- the live Worker's `/check` reports `decision` support and all four bounded approval choices;
- Codex reaches `NEEDS_INPUT` for the canary's harmless outside-worktree marker write.

When the terminal prints that Codex is waiting, open the private AtoRyn Telegram chat and press **Allow once** on that task. Do not use the local web approval buttons for this canary.

A passing run requires all of the following evidence:

- `agent.approval_requested` and `agent.approval_decided`;
- `remote.command_started` and successful `remote.command_completed` with `kind=decision`;
- the exact marker content outside the worktree;
- only `src/sum.mjs` changed inside the Git task;
- repository verification passed;
- the task reached `READY_TO_SHIP` with a clean worktree and exact Git head evidence.

The canary is intentionally not executed in CI because it requires the user's authenticated Codex CLI, live AtoRyn Worker, Telegram interaction, and local repository access. CI only syntax-checks the harness.

## Security boundary

The core deliberately stays local:

- the HTTP server binds only to `127.0.0.1`;
- non-loopback clients are rejected;
- browser mutation requests are restricted to configured local origins;
- no shell is used for Git, Codex or verification process spawning;
- repository paths must be absolute and are canonicalized with `realpath`;
- app-server approvals are bounded, request-ID-correlated and fail closed on timeout/disconnect;
- the optional AtoRyn bridge makes outbound HTTPS requests only;
- remote Telegram commands cannot register paths or submit arbitrary shell commands;
- automatic merge and deployment are not implemented.

Default browser origins:

```text
http://localhost:3000
http://127.0.0.1:3000
```

Override with a comma-separated list using `CYCLEWARDEN_CONTROL_ORIGINS`.

## Current V0.4 boundary

`codex exec` remains the default compatibility path. `CYCLEWARDEN_CODEX_MODE=app-server` enables the interactive path. V0.3 carries bounded approvals through AtoRyn Telegram; V0.4 adds a reproducible live dogfood harness before app-server is considered for promotion to the default runtime.
