# @cyclewarden/provider-github

GitHub App source-provider adapter for Atoryn Forge.

## Responsibilities

- list and resolve repositories visible to one GitHub App installation;
- verify repository identity before publication;
- bind a working branch to the exact approved commit SHA;
- create or replay a draft pull request without writing to the base branch;
- return provider-only change-request metadata.

## Durable-state boundary

The provider returns `SourceChangeRequestResult`, which contains only GitHub-owned publication data. The application layer creates the durable `Publication` record and owns its `id`, `runId`, and timestamps. Neither the fake provider nor the GitHub adapter fabricates application identifiers.

## Security boundary

This package never receives a GitHub App private key and never stores installation tokens. It depends on installation-scoped clients supplied by the application boundary. T073 will implement short-lived, repository-scoped token brokerage and must keep private-key material outside this package.

## Required GitHub App permissions

The live client implementation should request only the repository permissions needed for metadata, contents/refs, and pull requests, and should mint installation tokens restricted to the selected repository whenever possible.
