# @cyclewarden/provider-github

GitHub App source-provider adapter for Atoryn Forge.

## Responsibilities

- list and resolve repositories visible to one GitHub App installation;
- verify repository identity before publication;
- bind a working branch to the exact approved commit SHA;
- create or replay a draft pull request without writing to the base branch;
- return provider-neutral publication metadata.

## Security boundary

This package never receives a GitHub App private key and never stores installation tokens. It depends on installation-scoped clients supplied by the application boundary. T073 will implement short-lived, repository-scoped token brokerage and must keep private-key material outside this package.

## Publication context

The current domain contract does not include `runId` or `publicationId` in `SourceChangeRequestInput`, although the provider must return both in `Publication`. Until that contract is made explicit, the application supplies a `publicationContext` resolver. The adapter does not fabricate durable identifiers.

## Required GitHub App permissions

The live client implementation should request only the repository permissions needed for metadata, contents/refs, and pull requests, and should mint installation tokens restricted to the selected repository whenever possible.
