# @cyclewarden/provider-sandbox-vercel

Governed Vercel Sandbox adapter for Atoryn Forge.

## Lifecycle

- creates an ephemeral Node.js 24 sandbox with `persistent: false`;
- bootstraps the selected repository through an injected credential-aware boundary;
- executes commands within the approved lease;
- exposes only ports approved when the sandbox was created;
- stops a running sandbox without deleting its state immediately;
- permanently deletes the sandbox during cleanup.

## Vercel SDK boundary

This package does not import deployment credentials or assume a particular authentication mode. The application binds `VercelSandboxClientFactory` to the official `@vercel/sandbox` SDK. On Vercel, that binding may use automatic OIDC; local or external runtimes may provide explicitly scoped Vercel credentials.

The normalized live binding should map:

- `create(...)` to `Sandbox.create(...)`;
- `runCommand(...)` to the SDK command API;
- `domain(port)` to the SDK exposure-domain API;
- `stop()` to sandbox suspension;
- `delete()` to permanent sandbox deletion.

## Repository credential boundary

`repositoryCredentialHandle` is never included in the Vercel create request, command arguments, tags, or environment. It is passed only to `VercelSandboxRepositoryBootstrapper`, which must resolve and use the credential without writing it into the sandbox filesystem or durable provider state.

## Network and exposure policy

Network access is deny-by-default. An empty `allowedHosts` list creates a deny-all policy; otherwise only normalized public DNS host patterns are passed to the live client. URLs, paths, ports, localhost names, and private local suffixes are rejected.

Ports must be declared through `limits.exposedPorts` at creation time. Later calls to `expose(...)` fail closed for undeclared ports and accept only credential-free HTTPS domains returned by Vercel.

## Resource and secret policy

Timeout, CPU, memory, storage, port count, output size, and environment-entry ceilings are enforced before provider calls. Command timeouts may not exceed either the run policy or the remaining sandbox lifetime.

Environment variables whose names indicate tokens, secrets, passwords, private keys, API keys, access keys, credentials, or authentication data are rejected. Such values must be brokered outside the sandbox boundary.
