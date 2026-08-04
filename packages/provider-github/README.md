# @cyclewarden/provider-github

GitHub App source-provider adapter for Atoryn Forge.

## Responsibilities

- list and resolve repositories visible to one GitHub App installation;
- verify repository identity before publication;
- bind a working branch to the exact approved commit SHA;
- create or replay a draft pull request without writing to the base branch;
- return provider-only change-request metadata;
- verify GitHub App webhook deliveries against the raw request body;
- deduplicate delivery IDs without making failed deliveries unretryable;
- reconcile the complete repository snapshot after installation access changes;
- deactivate suspended or deleted installations;
- broker short-lived installation credentials restricted to one active repository and an explicit permission set.

## Durable-state boundary

The provider returns `SourceChangeRequestResult`, which contains only GitHub-owned publication data. The application layer creates the durable `Publication` record and owns its `id`, `runId`, and timestamps. Neither the fake provider nor the GitHub adapter fabricates application identifiers.

Webhook delivery and installation repository persistence are also injected boundaries. This package defines the rules, but the application owns durable delivery claims, installation status, and atomic repository-snapshot replacement.

## Webhook security boundary

`GitHubWebhookHandler` requires the original request bytes and verifies `X-Hub-Signature-256` with HMAC-SHA256 before JSON parsing or delivery claiming. It also requires `X-GitHub-Delivery` and `X-GitHub-Event`, enforces a body-size limit, and releases a claimed delivery when reconciliation fails so GitHub can retry it.

For `installation_repositories` changes, the handler asks `GitHubInstallationReconciler` to fetch and atomically replace the full installation inventory instead of trusting an event delta as durable truth. `installation` events reconcile on create, unsuspend, and accepted permission changes; suspend and delete events deactivate the installation.

## Credential boundary

`GitHubCredentialBroker` receives no private key. It depends on a sign-only `GitHubAppJwtSigner`, so private-key material can remain inside a key vault or other isolated signing boundary. The broker validates an active installation-to-repository grant before requesting any signature or token.

Each installation-token request contains exactly one repository ID and explicit `metadata`, `contents`, and `pull_requests` permissions. The response is rejected when GitHub returns another repository, a missing or broader permission, an empty credential, or a lifetime outside the configured short-lived window.

The token is exposed only inside `withRepositoryCredential(...)`. The broker does not cache, persist, log, or return it as durable application state.

## Required GitHub App permissions

The live client implementation should request only the repository permissions needed for metadata, contents/refs, and pull requests. The default publication path needs read-only metadata plus the minimum contents and pull-request access required by the requested operation.
