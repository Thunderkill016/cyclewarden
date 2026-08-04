# @cyclewarden/provider-codex

Governed Codex app-server provider for Atoryn Forge.

## Why app-server v2

Forge requires resumable threads, active-turn steering, explicit approvals, cancellation, streamed lifecycle events, background-terminal cleanup, and aggregate token usage. The provider therefore targets the Codex app-server v2 thread/turn protocol rather than the simpler TypeScript SDK turn wrapper.

The application-owned live client must initialize one app-server connection, then map this package's normalized boundary to:

- `thread/start` for a new persisted thread;
- `thread/resume` for reconnecting to the exact thread ID;
- `turn/start` for the initial or next idle turn;
- `turn/steer` for an additional instruction during an active turn;
- app-server notifications and server requests for the event stream;
- JSON-RPC responses to the original approval request ID;
- `turn/interrupt` for cancellation;
- `thread/backgroundTerminals/clean` after cancellation;
- token-usage notifications or thread state for `readUsage(...)`.

## Workspace and sandbox boundary

`CodexWorkspaceResolver` binds one Forge sandbox ID to one active absolute working directory. Resume fails closed if that directory changes. Threads use `workspace-write`, `on-request` approvals, and a client reviewer; Codex is never allowed to silently broaden the sandbox or bypass the Forge approval surface.

The provider does not create sandboxes and does not receive repository credentials. Those remain owned by the Vercel sandbox and GitHub credential adapters.

## Durable-state boundary

`CodexRunRegistry` stores the thread-to-run mapping, active turn ID, lifecycle status, and pending approval request IDs. This allows another process or device to resume the exact Codex thread, answer only current approvals, and reject stale request keys.

The thread ID is the provider-neutral `externalRunId`. The registry is injected so production can use PostgreSQL while tests remain deterministic.

## Events and usage

The live client normalizes app-server notifications into `CodexAppServerEvent`. The provider maps those into the existing `CodingAgentEvent` contract, validates cursor uniqueness, records approval requests before exposing them, rejects unexpected turn identities, and produces stable completion/failure codes.

`usageSummary(...)` returns input, cached input, output, reasoning, and total token counts after checking that all values are non-negative integers and internally consistent.

## Cancellation

Cancellation interrupts the active turn, explicitly cleans background terminals, and only then records the run as cancelled. This prevents an interrupted model turn from leaving shell processes running inside the remote workspace.
