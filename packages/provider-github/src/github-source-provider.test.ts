import { describe, expect, it } from "vitest";

import type { SourceChangeRequestInput } from "@cyclewarden/forge-domain";

import {
  GitHubSourceProvider,
  GitHubSourceProviderError,
  type GitHubInstallationClient,
  type GitHubPullRequestRecord,
  type GitHubRepositoryRecord,
} from "./github-source-provider.js";

const HEAD_SHA = "a".repeat(40);
const REPOSITORY: GitHubRepositoryRecord = {
  id: "123",
  owner: "atoryn",
  name: "forge-fixture",
  defaultBranch: "main",
  archived: false,
};

class RecordingClient implements GitHubInstallationClient {
  branch: { sha: string } | null = null;
  pullRequest: GitHubPullRequestRecord | null = null;
  readonly createBranchCalls: Array<{
    repositoryId: string;
    branchName: string;
    sha: string;
  }> = [];
  readonly createPullRequestCalls: Array<{
    repositoryId: string;
    headBranch: string;
    baseBranch: string;
    title: string;
    body: string;
  }> = [];

  async listRepositories(_input: {
    cursor?: string;
    pageSize: number;
  }): Promise<{
    repositories: GitHubRepositoryRecord[];
    nextCursor: string | null;
  }> {
    return { repositories: [REPOSITORY], nextCursor: "next-page" };
  }

  async getRepositoryById(repositoryId: string): Promise<GitHubRepositoryRecord> {
    if (repositoryId !== REPOSITORY.id) throw new Error("repository not found");
    return REPOSITORY;
  }

  async getCommit(input: {
    repositoryId: string;
    sha: string;
  }): Promise<{ sha: string }> {
    if (input.repositoryId !== REPOSITORY.id) throw new Error("repository mismatch");
    return { sha: input.sha };
  }

  async getBranch(_input: {
    repositoryId: string;
    branchName: string;
  }): Promise<{ sha: string } | null> {
    return this.branch;
  }

  async createBranch(input: {
    repositoryId: string;
    branchName: string;
    sha: string;
  }): Promise<{ sha: string }> {
    this.createBranchCalls.push(input);
    this.branch = { sha: input.sha };
    return this.branch;
  }

  async findOpenPullRequest(_input: {
    repositoryId: string;
    headBranch: string;
    baseBranch: string;
  }): Promise<GitHubPullRequestRecord | null> {
    return this.pullRequest;
  }

  async createDraftPullRequest(input: {
    repositoryId: string;
    headBranch: string;
    baseBranch: string;
    title: string;
    body: string;
  }): Promise<GitHubPullRequestRecord> {
    this.createPullRequestCalls.push(input);
    this.pullRequest = {
      id: "PR_kwDOExample",
      number: 7,
      url: "https://github.com/atoryn/forge-fixture/pull/7",
      draft: true,
      headSha: HEAD_SHA,
    };
    return this.pullRequest;
  }
}

function changeRequestInput(): SourceChangeRequestInput {
  return {
    repository: {
      provider: "github",
      externalRepositoryId: REPOSITORY.id,
      namespace: REPOSITORY.owner,
      repositoryName: REPOSITORY.name,
      defaultBranch: REPOSITORY.defaultBranch,
      archived: false,
    },
    baseBranch: "main",
    branchName: "atoryn/run-42",
    commitMessage: "Implement the approved change",
    title: "Implement the approved change",
    body: "Evidence-reviewed Atoryn Forge publication.",
    draft: true,
    expectedHeadSha: HEAD_SHA,
  };
}

function provider(client: RecordingClient): GitHubSourceProvider {
  return new GitHubSourceProvider({
    clients: {
      forConnection: async () => client,
      forRepository: async () => client,
    },
  });
}

describe("GitHubSourceProvider", () => {
  it("maps installation repositories into the provider-neutral contract", async () => {
    const source = provider(new RecordingClient());

    await expect(
      source.listRepositories({ connectionId: "installation-1" }),
    ).resolves.toEqual({
      repositories: [
        {
          provider: "github",
          externalRepositoryId: "123",
          namespace: "atoryn",
          repositoryName: "forge-fixture",
          defaultBranch: "main",
          archived: false,
        },
      ],
      nextCursor: "next-page",
    });

    await expect(
      source.resolveRepository({
        connectionId: "installation-1",
        externalRepositoryId: "123",
      }),
    ).resolves.toMatchObject({ provider: "github", repositoryName: "forge-fixture" });
  });

  it("creates a working branch and draft pull request at the exact approved head", async () => {
    const client = new RecordingClient();
    const source = provider(client);

    await expect(source.createDraftChangeRequest(changeRequestInput())).resolves.toEqual({
      provider: "github",
      externalRepositoryId: "123",
      branchName: "atoryn/run-42",
      commitSha: HEAD_SHA,
      changeRequestId: "7",
      changeRequestUrl: "https://github.com/atoryn/forge-fixture/pull/7",
      status: "pr_created",
      failureCode: null,
    });
    expect(client.createBranchCalls).toHaveLength(1);
    expect(client.createPullRequestCalls).toHaveLength(1);
  });

  it("replays an existing exact branch and draft pull request without duplicates", async () => {
    const client = new RecordingClient();
    client.branch = { sha: HEAD_SHA };
    client.pullRequest = {
      id: "PR_kwDOExample",
      number: 7,
      url: "https://github.com/atoryn/forge-fixture/pull/7",
      draft: true,
      headSha: HEAD_SHA,
    };
    const source = provider(client);

    await source.createDraftChangeRequest(changeRequestInput());

    expect(client.createBranchCalls).toHaveLength(0);
    expect(client.createPullRequestCalls).toHaveLength(0);
  });

  it("fails closed when asked to publish directly to the base branch", async () => {
    const source = provider(new RecordingClient());
    const input = changeRequestInput();
    input.branchName = input.baseBranch;

    await expect(source.createDraftChangeRequest(input)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
