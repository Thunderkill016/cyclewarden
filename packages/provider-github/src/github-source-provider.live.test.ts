import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  GitHubSourceProvider,
  type GitHubInstallationClient,
  type GitHubPullRequestRecord,
  type GitHubRepositoryRecord,
} from "./github-source-provider.js";

const LIVE_ENABLED = process.env.ATORYN_LIVE_GITHUB_CONTRACT === "1";
const describeLive = LIVE_ENABLED ? describe : describe.skip;
const API_VERSION = "2022-11-28";
const DISPOSABLE_NAME = /(?:^|[-_.])(disposable|fixture|sandbox|contract[-_.]?test|test[-_.]?repo)(?:$|[-_.])/i;

interface RepositoryResponse {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  default_branch: string;
  archived: boolean;
}

interface GitRefResponse {
  object: { sha: string };
}

interface GitCommitResponse {
  sha: string;
  tree: { sha: string };
}

interface GitObjectResponse {
  sha: string;
}

interface PullRequestResponse {
  id: number;
  number: number;
  html_url: string;
  draft: boolean;
  head: { sha: string };
}

class GitHubLiveApi {
  constructor(
    private readonly token: string,
    readonly owner: string,
    readonly repositoryName: string,
  ) {}

  async request<T>(input: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    path: string;
    body?: unknown;
    expected?: number | number[];
  }): Promise<T> {
    const method = input.method ?? "GET";
    const response = await fetch(`https://api.github.com${input.path}`, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "X-GitHub-Api-Version": API_VERSION,
        "User-Agent": "atoryn-forge-live-contract",
        ...(input.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
      },
      ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
    });
    const expected = Array.isArray(input.expected)
      ? input.expected
      : [input.expected ?? 200];
    if (!expected.includes(response.status)) {
      const requestId = response.headers.get("x-github-request-id") ?? "unknown";
      throw new Error(
        `GitHub ${method} ${input.path} returned ${response.status}; request ${requestId}`,
      );
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  repoPath(path = ""): string {
    return `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(
      this.repositoryName,
    )}${path}`;
  }
}

class LiveRepositoryClient implements GitHubInstallationClient {
  constructor(
    private readonly api: GitHubLiveApi,
    private readonly repository: GitHubRepositoryRecord,
  ) {}

  async listRepositories(_input: {
    cursor?: string;
    pageSize: number;
  }): Promise<{
    repositories: GitHubRepositoryRecord[];
    nextCursor: string | null;
  }> {
    return { repositories: [{ ...this.repository }], nextCursor: null };
  }

  async getRepositoryById(repositoryId: string): Promise<GitHubRepositoryRecord> {
    if (repositoryId !== this.repository.id) {
      throw new Error("Repository ID is outside the live contract scope");
    }
    const response = await this.api.request<RepositoryResponse>({
      path: `/repositories/${encodeURIComponent(repositoryId)}`,
    });
    return mapRepository(response);
  }

  async getCommit(input: {
    repositoryId: string;
    sha: string;
  }): Promise<{ sha: string }> {
    await this.getRepositoryById(input.repositoryId);
    const commit = await this.api.request<{ sha: string }>({
      path: this.api.repoPath(`/commits/${encodeURIComponent(input.sha)}`),
    });
    return { sha: commit.sha };
  }

  async getBranch(input: {
    repositoryId: string;
    branchName: string;
  }): Promise<{ sha: string } | null> {
    await this.getRepositoryById(input.repositoryId);
    const response = await fetch(
      `https://api.github.com${this.api.repoPath(
        `/git/ref/heads/${encodeURIComponent(input.branchName)}`,
      )}`,
      {
        headers: liveHeaders(requiredEnvironment("ATORYN_LIVE_GITHUB_TOKEN")),
      },
    );
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`GitHub branch lookup returned ${response.status}`);
    }
    const ref = (await response.json()) as GitRefResponse;
    return { sha: ref.object.sha };
  }

  async createBranch(input: {
    repositoryId: string;
    branchName: string;
    sha: string;
  }): Promise<{ sha: string }> {
    await this.getRepositoryById(input.repositoryId);
    const ref = await this.api.request<GitRefResponse>({
      method: "POST",
      path: this.api.repoPath("/git/refs"),
      body: { ref: `refs/heads/${input.branchName}`, sha: input.sha },
      expected: 201,
    });
    return { sha: ref.object.sha };
  }

  async findOpenPullRequest(input: {
    repositoryId: string;
    headBranch: string;
    baseBranch: string;
  }): Promise<GitHubPullRequestRecord | null> {
    await this.getRepositoryById(input.repositoryId);
    const query = new URLSearchParams({
      state: "open",
      head: `${this.repository.owner}:${input.headBranch}`,
      base: input.baseBranch,
      per_page: "10",
    });
    const pulls = await this.api.request<PullRequestResponse[]>({
      path: this.api.repoPath(`/pulls?${query.toString()}`),
    });
    const pull = pulls[0];
    return pull ? mapPullRequest(pull) : null;
  }

  async createDraftPullRequest(input: {
    repositoryId: string;
    headBranch: string;
    baseBranch: string;
    title: string;
    body: string;
  }): Promise<GitHubPullRequestRecord> {
    await this.getRepositoryById(input.repositoryId);
    const pull = await this.api.request<PullRequestResponse>({
      method: "POST",
      path: this.api.repoPath("/pulls"),
      body: {
        title: input.title,
        head: input.headBranch,
        base: input.baseBranch,
        body: input.body,
        draft: true,
      },
      expected: 201,
    });
    return mapPullRequest(pull);
  }
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the live GitHub contract`);
  return value;
}

function liveHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": API_VERSION,
    "User-Agent": "atoryn-forge-live-contract",
  };
}

function parseRepository(value: string): { owner: string; name: string } {
  const match = /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100})$/.exec(
    value,
  );
  if (!match) throw new Error("Live repository must use owner/name format");
  return { owner: match[1]!, name: match[2]! };
}

function assertDisposableRepository(repository: string): void {
  const confirmation = requiredEnvironment(
    "ATORYN_LIVE_GITHUB_CONFIRM_DISPOSABLE",
  );
  if (confirmation !== `DESTROY:${repository}`) {
    throw new Error(
      "Live GitHub contract requires exact DESTROY:owner/repo confirmation",
    );
  }
  const { name } = parseRepository(repository);
  if (!DISPOSABLE_NAME.test(name)) {
    throw new Error(
      "Live GitHub contract refuses repositories not explicitly named as disposable fixtures",
    );
  }
  if (repository.toLowerCase() === "thunderkill016/cyclewarden") {
    throw new Error("The production repository can never be a live contract target");
  }
}

function mapRepository(response: RepositoryResponse): GitHubRepositoryRecord {
  return {
    id: String(response.id),
    owner: response.owner.login,
    name: response.name,
    defaultBranch: response.default_branch,
    archived: response.archived,
  };
}

function mapPullRequest(response: PullRequestResponse): GitHubPullRequestRecord {
  return {
    id: String(response.id),
    number: response.number,
    url: response.html_url,
    draft: response.draft,
    headSha: response.head.sha,
  };
}

async function createUnreferencedCommit(input: {
  api: GitHubLiveApi;
  baseBranch: string;
  nonce: string;
}): Promise<{ baseSha: string; commitSha: string }> {
  const baseRef = await input.api.request<GitRefResponse>({
    path: input.api.repoPath(
      `/git/ref/heads/${encodeURIComponent(input.baseBranch)}`,
    ),
  });
  const baseCommit = await input.api.request<GitCommitResponse>({
    path: input.api.repoPath(`/git/commits/${baseRef.object.sha}`),
  });
  const blob = await input.api.request<GitObjectResponse>({
    method: "POST",
    path: input.api.repoPath("/git/blobs"),
    body: {
      content: `Atoryn Forge live GitHub contract ${input.nonce}\n`,
      encoding: "utf-8",
    },
    expected: 201,
  });
  const tree = await input.api.request<GitObjectResponse>({
    method: "POST",
    path: input.api.repoPath("/git/trees"),
    body: {
      base_tree: baseCommit.tree.sha,
      tree: [
        {
          path: `.atoryn-live-contract/${input.nonce}.txt`,
          mode: "100644",
          type: "blob",
          sha: blob.sha,
        },
      ],
    },
    expected: 201,
  });
  const commit = await input.api.request<GitObjectResponse>({
    method: "POST",
    path: input.api.repoPath("/git/commits"),
    body: {
      message: `test(forge): live GitHub contract ${input.nonce}`,
      tree: tree.sha,
      parents: [baseRef.object.sha],
    },
    expected: 201,
  });
  return { baseSha: baseRef.object.sha, commitSha: commit.sha };
}

describeLive("GitHubSourceProvider live contract", () => {
  it(
    "creates and replays an exact-head draft PR without moving the base branch",
    async () => {
      const token = requiredEnvironment("ATORYN_LIVE_GITHUB_TOKEN");
      const repositoryName = requiredEnvironment(
        "ATORYN_LIVE_GITHUB_REPOSITORY",
      );
      assertDisposableRepository(repositoryName);
      const target = parseRepository(repositoryName);
      const api = new GitHubLiveApi(token, target.owner, target.name);
      const repositoryResponse = await api.request<RepositoryResponse>({
        path: api.repoPath(),
      });
      if (repositoryResponse.full_name.toLowerCase() !== repositoryName.toLowerCase()) {
        throw new Error("GitHub returned a different repository identity");
      }
      const repository = mapRepository(repositoryResponse);
      if (repository.archived) throw new Error("Disposable repository is archived");
      const baseBranch =
        process.env.ATORYN_LIVE_GITHUB_BASE_BRANCH?.trim() ||
        repository.defaultBranch;
      const nonce = randomUUID().replaceAll("-", "");
      const branchName = `atoryn/live-contract-${nonce.slice(0, 16)}`;
      const created = await createUnreferencedCommit({ api, baseBranch, nonce });
      const client = new LiveRepositoryClient(api, repository);
      const provider = new GitHubSourceProvider({
        clients: {
          forConnection: async () => client,
          forRepository: async () => client,
        },
      });
      let pullRequestNumber: number | null = null;

      try {
        await expect(
          provider.listRepositories({ connectionId: "live-contract" }),
        ).resolves.toEqual({
          repositories: [
            {
              provider: "github",
              externalRepositoryId: repository.id,
              namespace: repository.owner,
              repositoryName: repository.name,
              defaultBranch: repository.defaultBranch,
              archived: false,
            },
          ],
          nextCursor: null,
        });
        await expect(
          provider.resolveRepository({
            connectionId: "live-contract",
            externalRepositoryId: repository.id,
          }),
        ).resolves.toMatchObject({
          provider: "github",
          externalRepositoryId: repository.id,
        });

        const request = {
          repository: {
            provider: "github",
            externalRepositoryId: repository.id,
            namespace: repository.owner,
            repositoryName: repository.name,
            defaultBranch: repository.defaultBranch,
            archived: false,
          },
          baseBranch,
          branchName,
          commitMessage: `Live GitHub contract ${nonce}`,
          title: `Atoryn Forge live contract ${nonce.slice(0, 8)}`,
          body: "Opt-in disposable-repository contract test. This PR will be closed automatically.",
          draft: true as const,
          expectedHeadSha: created.commitSha,
        };
        const first = await provider.createDraftChangeRequest(request);
        const replay = await provider.createDraftChangeRequest(request);
        expect(replay).toEqual(first);
        expect(first).toMatchObject({
          provider: "github",
          externalRepositoryId: repository.id,
          branchName,
          commitSha: created.commitSha,
          status: "pr_created",
          failureCode: null,
        });
        pullRequestNumber = Number(first.changeRequestId);
        expect(Number.isSafeInteger(pullRequestNumber)).toBe(true);

        const pull = await api.request<PullRequestResponse>({
          path: api.repoPath(`/pulls/${pullRequestNumber}`),
        });
        expect(pull.draft).toBe(true);
        expect(pull.head.sha).toBe(created.commitSha);
        const baseAfter = await api.request<GitRefResponse>({
          path: api.repoPath(
            `/git/ref/heads/${encodeURIComponent(baseBranch)}`,
          ),
        });
        expect(baseAfter.object.sha).toBe(created.baseSha);
      } finally {
        if (pullRequestNumber !== null) {
          await api.request({
            method: "PATCH",
            path: api.repoPath(`/pulls/${pullRequestNumber}`),
            body: { state: "closed" },
          });
        }
        await api.request({
          method: "DELETE",
          path: api.repoPath(
            `/git/refs/heads/${encodeURIComponent(branchName)}`,
          ),
          expected: [204, 404],
        });
      }
    },
    120_000,
  );
});
