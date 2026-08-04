import type {
  SourceChangeRequestInput,
  SourceChangeRequestResult,
  SourceProvider,
  SourceRepositoryRef,
} from "@cyclewarden/forge-domain";

export class FakeSourceProvider implements SourceProvider {
  readonly key = "fake-source";
  readonly publicationCalls: SourceChangeRequestInput[] = [];

  constructor(
    private readonly repositories: SourceRepositoryRef[] = [
      {
        provider: "fake-source",
        externalRepositoryId: "repo-1",
        namespace: "fixture",
        repositoryName: "app",
        defaultBranch: "main",
        archived: false,
      },
    ],
  ) {}

  async listRepositories(_input: {
    connectionId: string;
    cursor?: string;
  }): Promise<{
    repositories: SourceRepositoryRef[];
    nextCursor: string | null;
  }> {
    return { repositories: [...this.repositories], nextCursor: null };
  }

  async resolveRepository(input: {
    connectionId: string;
    externalRepositoryId: string;
  }): Promise<SourceRepositoryRef> {
    const repository = this.repositories.find(
      (item) => item.externalRepositoryId === input.externalRepositoryId,
    );
    if (!repository) throw new Error("Repository not found");
    return repository;
  }

  async createDraftChangeRequest(
    input: SourceChangeRequestInput,
  ): Promise<SourceChangeRequestResult> {
    this.publicationCalls.push(input);
    return {
      provider: this.key,
      externalRepositoryId: input.repository.externalRepositoryId,
      branchName: input.branchName,
      commitSha: input.expectedHeadSha,
      changeRequestId: `pr-${this.publicationCalls.length}`,
      changeRequestUrl: `https://example.test/pull/${this.publicationCalls.length}`,
      status: "pr_created",
      failureCode: null,
    };
  }
}
