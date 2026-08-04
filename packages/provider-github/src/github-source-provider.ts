import type {
  Publication,
  SourceChangeRequestInput,
  SourceProvider,
  SourceRepositoryRef,
} from "@cyclewarden/forge-domain";

const GIT_SHA = /^[0-9a-f]{40,64}$/i;

export interface GitHubRepositoryRecord {
  id: string;
  owner: string;
  name: string;
  defaultBranch: string;
  archived: boolean;
}

export interface GitHubPullRequestRecord {
  id: string;
  number: number;
  url: string;
  draft: boolean;
  headSha: string;
}

export interface GitHubInstallationClient {
  listRepositories(input: {
    cursor?: string;
    pageSize: number;
  }): Promise<{
    repositories: GitHubRepositoryRecord[];
    nextCursor: string | null;
  }>;

  getRepositoryById(repositoryId: string): Promise<GitHubRepositoryRecord>;

  getCommit(input: {
    repositoryId: string;
    sha: string;
  }): Promise<{ sha: string }>;

  getBranch(input: {
    repositoryId: string;
    branchName: string;
  }): Promise<{ sha: string } | null>;

  createBranch(input: {
    repositoryId: string;
    branchName: string;
    sha: string;
  }): Promise<{ sha: string }>;

  findOpenPullRequest(input: {
    repositoryId: string;
    headBranch: string;
    baseBranch: string;
  }): Promise<GitHubPullRequestRecord | null>;

  createDraftPullRequest(input: {
    repositoryId: string;
    headBranch: string;
    baseBranch: string;
    title: string;
    body: string;
  }): Promise<GitHubPullRequestRecord>;
}

export interface GitHubInstallationClientFactory {
  forConnection(connectionId: string): Promise<GitHubInstallationClient>;
  forRepository(repositoryId: string): Promise<GitHubInstallationClient>;
}

export interface GitHubPublicationContext {
  publicationId: string;
  runId: string;
}

export type GitHubPublicationContextResolver = (
  input: SourceChangeRequestInput,
) => GitHubPublicationContext;

export class GitHubSourceProviderError extends Error {
  constructor(
    readonly code:
      | "INVALID_INPUT"
      | "PROVIDER_CONFLICT"
      | "REPOSITORY_UNAVAILABLE"
      | "PUBLICATION_CONFLICT"
      | "PROVIDER_UNAVAILABLE",
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GitHubSourceProviderError";
  }
}

export interface GitHubSourceProviderDependencies {
  clients: GitHubInstallationClientFactory;
  publicationContext: GitHubPublicationContextResolver;
  now?: () => Date;
  pageSize?: number;
}

function mapRepository(repository: GitHubRepositoryRecord): SourceRepositoryRef {
  return {
    provider: "github",
    externalRepositoryId: repository.id,
    namespace: repository.owner,
    repositoryName: repository.name,
    defaultBranch: repository.defaultBranch,
    archived: repository.archived,
  };
}

function assertRepositoryIdentity(
  expected: SourceRepositoryRef,
  actual: GitHubRepositoryRecord,
): void {
  if (
    expected.externalRepositoryId !== actual.id ||
    expected.namespace !== actual.owner ||
    expected.repositoryName !== actual.name
  ) {
    throw new GitHubSourceProviderError(
      "REPOSITORY_UNAVAILABLE",
      "The repository identity changed or is no longer accessible to this installation.",
    );
  }
}

function assertPublicationInput(input: SourceChangeRequestInput): void {
  if (input.repository.provider !== "github") {
    throw new GitHubSourceProviderError(
      "PROVIDER_CONFLICT",
      `Expected a GitHub repository, received ${input.repository.provider}.`,
    );
  }
  if (input.repository.archived) {
    throw new GitHubSourceProviderError(
      "REPOSITORY_UNAVAILABLE",
      "Archived repositories cannot receive Atoryn publications.",
    );
  }
  if (input.branchName === input.baseBranch) {
    throw new GitHubSourceProviderError(
      "INVALID_INPUT",
      "Atoryn must publish to a working branch, never directly to the base branch.",
    );
  }
  if (!GIT_SHA.test(input.expectedHeadSha)) {
    throw new GitHubSourceProviderError(
      "INVALID_INPUT",
      "The approved head commit SHA is invalid.",
    );
  }
}

export class GitHubSourceProvider implements SourceProvider {
  readonly key = "github";
  private readonly now: () => Date;
  private readonly pageSize: number;

  constructor(private readonly dependencies: GitHubSourceProviderDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.pageSize = dependencies.pageSize ?? 50;
    if (!Number.isInteger(this.pageSize) || this.pageSize < 1 || this.pageSize > 100) {
      throw new GitHubSourceProviderError(
        "INVALID_INPUT",
        "GitHub repository page size must be an integer between 1 and 100.",
      );
    }
  }

  async listRepositories(input: {
    connectionId: string;
    cursor?: string;
  }): Promise<{
    repositories: SourceRepositoryRef[];
    nextCursor: string | null;
  }> {
    const client = await this.dependencies.clients.forConnection(input.connectionId);
    const request = input.cursor
      ? { cursor: input.cursor, pageSize: this.pageSize }
      : { pageSize: this.pageSize };
    const result = await client.listRepositories(request);
    return {
      repositories: result.repositories.map(mapRepository),
      nextCursor: result.nextCursor,
    };
  }

  async resolveRepository(input: {
    connectionId: string;
    externalRepositoryId: string;
  }): Promise<SourceRepositoryRef> {
    const client = await this.dependencies.clients.forConnection(input.connectionId);
    const repository = await client.getRepositoryById(input.externalRepositoryId);
    return mapRepository(repository);
  }

  async createDraftChangeRequest(
    input: SourceChangeRequestInput,
  ): Promise<Publication> {
    assertPublicationInput(input);
    const client = await this.dependencies.clients.forRepository(
      input.repository.externalRepositoryId,
    );
    const repository = await client.getRepositoryById(
      input.repository.externalRepositoryId,
    );
    assertRepositoryIdentity(input.repository, repository);
    if (repository.archived) {
      throw new GitHubSourceProviderError(
        "REPOSITORY_UNAVAILABLE",
        "The repository was archived after the run started.",
      );
    }

    const commit = await client.getCommit({
      repositoryId: repository.id,
      sha: input.expectedHeadSha,
    });
    if (commit.sha !== input.expectedHeadSha) {
      throw new GitHubSourceProviderError(
        "PUBLICATION_CONFLICT",
        "GitHub did not resolve the exact approved head commit.",
      );
    }

    const existingBranch = await client.getBranch({
      repositoryId: repository.id,
      branchName: input.branchName,
    });
    if (existingBranch && existingBranch.sha !== input.expectedHeadSha) {
      throw new GitHubSourceProviderError(
        "PUBLICATION_CONFLICT",
        "The working branch already exists at a different commit.",
      );
    }
    if (!existingBranch) {
      const createdBranch = await client.createBranch({
        repositoryId: repository.id,
        branchName: input.branchName,
        sha: input.expectedHeadSha,
      });
      if (createdBranch.sha !== input.expectedHeadSha) {
        throw new GitHubSourceProviderError(
          "PUBLICATION_CONFLICT",
          "GitHub created the working branch at an unexpected commit.",
        );
      }
    }

    let pullRequest = await client.findOpenPullRequest({
      repositoryId: repository.id,
      headBranch: input.branchName,
      baseBranch: input.baseBranch,
    });
    if (!pullRequest) {
      pullRequest = await client.createDraftPullRequest({
        repositoryId: repository.id,
        headBranch: input.branchName,
        baseBranch: input.baseBranch,
        title: input.title,
        body: input.body,
      });
    }
    if (!pullRequest.draft || pullRequest.headSha !== input.expectedHeadSha) {
      throw new GitHubSourceProviderError(
        "PUBLICATION_CONFLICT",
        "The change request is not a draft at the exact approved head commit.",
      );
    }

    const context = this.dependencies.publicationContext(input);
    const timestamp = this.now().toISOString();
    return {
      id: context.publicationId,
      runId: context.runId,
      provider: this.key,
      externalRepositoryId: repository.id,
      branchName: input.branchName,
      commitSha: input.expectedHeadSha,
      changeRequestId: String(pullRequest.number),
      changeRequestUrl: pullRequest.url,
      status: "pr_created",
      failureCode: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }
}
