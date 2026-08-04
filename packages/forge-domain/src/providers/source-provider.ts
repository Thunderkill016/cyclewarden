import type { Publication } from "../contracts/index.js";

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
  ): Promise<Publication>;
}
