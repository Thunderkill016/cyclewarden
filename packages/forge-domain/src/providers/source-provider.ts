export interface SourceRepositoryRef {
  provider: string;
  externalRepositoryId: string;
  namespace: string;
  repositoryName: string;
  defaultBranch: string;
  archived: boolean;
}

export interface SourceChangeRequestInput {
  repository: SourceRepositoryRef;
  baseBranch: string;
  branchName: string;
  commitMessage: string;
  title: string;
  body: string;
  draft: true;
  expectedHeadSha: string;
}

export interface SourceChangeRequestResult {
  provider: string;
  externalRepositoryId: string;
  branchName: string;
  commitSha: string;
  changeRequestId: string | null;
  changeRequestUrl: string | null;
  status: "pushed" | "pr_created";
  failureCode: string | null;
}

export interface SourceProvider {
  readonly key: string;

  listRepositories(input: {
    connectionId: string;
    cursor?: string;
  }): Promise<{
    repositories: SourceRepositoryRef[];
    nextCursor: string | null;
  }>;

  resolveRepository(input: {
    connectionId: string;
    externalRepositoryId: string;
  }): Promise<SourceRepositoryRef>;

  createDraftChangeRequest(
    input: SourceChangeRequestInput,
  ): Promise<SourceChangeRequestResult>;
}
