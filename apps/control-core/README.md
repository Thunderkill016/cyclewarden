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

The V0 runner asks Codex to commit intended changes. A task cannot become `READY_TO_SHIP` while its worktree is dirty.

## Verification discovery

For Node repositories the V0 core detects these root `package.json` scripts, when present, in this order:

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

If the core restarts while a task is `RUNNING` or `VERIFYING`, V0 reconciles that task to `FAILED / CORE_RESTARTED` instead of leaving a phantom active task.

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

The synchronized snapshot excludes local paths, task objectives, acceptance criteria, Codex output and file contents. Telegram can only request `run` or `cancel` for tasks that already exist in the local store.

Remote delivery is at-least-once. The core persists `remote.command_started` / `remote.command_completed` events so a redelivered command does not execute its side effect twice.

Bridge health is visible in:

```text
GET /health
GET /doctor
```

## Security boundary

The core deliberately stays local:

- the HTTP server binds only to `127.0.0.1`;
- non-loopback clients are rejected;
- browser mutation requests are restricted to configured local origins;
- no shell is used for Git, Codex or verification process spawning;
- repository paths must be absolute and are canonicalized with `realpath`;
- the optional AtoRyn bridge makes outbound HTTPS requests only;
- remote Telegram commands cannot register paths or submit arbitrary shell commands;
- automatic merge and deployment are not implemented.

Default browser origins:

```text
http://localhost:3000
http://127.0.0.1:3000
```

Override with a comma-separated list using `CYCLEWARDEN_CONTROL_ORIGINS`.

## Current V0 limit

The runner intentionally uses non-interactive `codex exec` for the first proven vertical slice. Full interactive approval/question routing requires the `codex app-server` transport; the domain already contains `NEEDS_INPUT`, but V0 does not pretend stdout heuristics are equivalent to the official approval RPC.
