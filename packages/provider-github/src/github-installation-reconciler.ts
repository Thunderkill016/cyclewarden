import type { SourceRepositoryRef } from "@cyclewarden/forge-domain";

import type { GitHubRepositoryRecord } from "./github-source-provider.js";

export type GitHubInstallationStatus = "active" | "suspended" | "deleted";

export interface GitHubInstallationAccount {
  id: string;
  login: string;
  type: "User" | "Organization" | "Enterprise" | "Unknown";
}

export interface GitHubInstallationInventoryClient {
  listRepositories(input: {
    cursor?: string;
    pageSize: number;
  }): Promise<{
    repositories: GitHubRepositoryRecord[];
    nextCursor: string | null;
  }>;
}

export interface GitHubInstallationInventoryClientFactory {
  forInstallation(
    installationId: string,
  ): Promise<GitHubInstallationInventoryClient>;
}

export interface GitHubInstallationRepositoryStore {
  replaceInstallationSnapshot(input: {
    installationId: string;
    account: GitHubInstallationAccount;
    status: "active";
    repositories: SourceRepositoryRef[];
    synchronizedAt: string;
  }): Promise<void>;

  deactivateInstallation(input: {
    installationId: string;
    account: GitHubInstallationAccount;
    status: "suspended" | "deleted";
    synchronizedAt: string;
  }): Promise<void>;
}

export class GitHubInstallationReconciliationError extends Error {
  constructor(
    readonly code:
      | "INVALID_INPUT"
      | "PAGINATION_CONFLICT"
      | "REPOSITORY_CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "GitHubInstallationReconciliationError";
  }
}

export interface GitHubInstallationReconcilerDependencies {
  clients: GitHubInstallationInventoryClientFactory;
  store: GitHubInstallationRepositoryStore;
  now?: () => Date;
  pageSize?: number;
  maxPages?: number;
}

function assertInstallationId(installationId: string): void {
  if (!/^[1-9][0-9]*$/.test(installationId)) {
    throw new GitHubInstallationReconciliationError(
      "INVALID_INPUT",
      "GitHub installation ID must be a positive integer string.",
    );
  }
}

function assertAccount(account: GitHubInstallationAccount): void {
  if (!/^[1-9][0-9]*$/.test(account.id) || account.login.trim().length === 0) {
    throw new GitHubInstallationReconciliationError(
      "INVALID_INPUT",
      "GitHub installation account identity is incomplete.",
    );
  }
}

function mapRepository(repository: GitHubRepositoryRecord): SourceRepositoryRef {
  if (
    !/^[1-9][0-9]*$/.test(repository.id) ||
    repository.owner.trim().length === 0 ||
    repository.name.trim().length === 0 ||
    repository.defaultBranch.trim().length === 0
  ) {
    throw new GitHubInstallationReconciliationError(
      "INVALID_INPUT",
      "GitHub returned an invalid repository record during reconciliation.",
    );
  }

  return {
    provider: "github",
    externalRepositoryId: repository.id,
    namespace: repository.owner,
    repositoryName: repository.name,
    defaultBranch: repository.defaultBranch,
    archived: repository.archived,
  };
}

export class GitHubInstallationReconciler {
  private readonly now: () => Date;
  private readonly pageSize: number;
  private readonly maxPages: number;

  constructor(
    private readonly dependencies: GitHubInstallationReconcilerDependencies,
  ) {
    this.now = dependencies.now ?? (() => new Date());
    this.pageSize = dependencies.pageSize ?? 100;
    this.maxPages = dependencies.maxPages ?? 1_000;

    if (!Number.isInteger(this.pageSize) || this.pageSize < 1 || this.pageSize > 100) {
      throw new GitHubInstallationReconciliationError(
        "INVALID_INPUT",
        "GitHub reconciliation page size must be an integer between 1 and 100.",
      );
    }
    if (!Number.isInteger(this.maxPages) || this.maxPages < 1) {
      throw new GitHubInstallationReconciliationError(
        "INVALID_INPUT",
        "GitHub reconciliation maxPages must be a positive integer.",
      );
    }
  }

  async reconcile(input: {
    installationId: string;
    account: GitHubInstallationAccount;
  }): Promise<{ repositoryCount: number; synchronizedAt: string }> {
    assertInstallationId(input.installationId);
    assertAccount(input.account);

    const client = await this.dependencies.clients.forInstallation(
      input.installationId,
    );
    const repositories = new Map<string, SourceRepositoryRef>();
    const visitedCursors = new Set<string>();
    let cursor: string | undefined;
    let page = 0;

    while (true) {
      page += 1;
      if (page > this.maxPages) {
        throw new GitHubInstallationReconciliationError(
          "PAGINATION_CONFLICT",
          "GitHub installation repository pagination exceeded the configured limit.",
        );
      }

      const request = cursor
        ? { cursor, pageSize: this.pageSize }
        : { pageSize: this.pageSize };
      const result = await client.listRepositories(request);

      for (const repository of result.repositories) {
        const mapped = mapRepository(repository);
        if (repositories.has(mapped.externalRepositoryId)) {
          throw new GitHubInstallationReconciliationError(
            "REPOSITORY_CONFLICT",
            `GitHub returned repository ${mapped.externalRepositoryId} more than once.`,
          );
        }
        repositories.set(mapped.externalRepositoryId, mapped);
      }

      if (result.nextCursor === null) break;
      if (
        result.nextCursor.length === 0 ||
        result.nextCursor === cursor ||
        visitedCursors.has(result.nextCursor)
      ) {
        throw new GitHubInstallationReconciliationError(
          "PAGINATION_CONFLICT",
          "GitHub returned a repeated or empty repository cursor.",
        );
      }
      visitedCursors.add(result.nextCursor);
      cursor = result.nextCursor;
    }

    const synchronizedAt = this.now().toISOString();
    const snapshot = [...repositories.values()].sort((left, right) =>
      `${left.namespace}/${left.repositoryName}/${left.externalRepositoryId}`.localeCompare(
        `${right.namespace}/${right.repositoryName}/${right.externalRepositoryId}`,
      ),
    );

    await this.dependencies.store.replaceInstallationSnapshot({
      installationId: input.installationId,
      account: input.account,
      status: "active",
      repositories: snapshot,
      synchronizedAt,
    });

    return { repositoryCount: snapshot.length, synchronizedAt };
  }

  async deactivate(input: {
    installationId: string;
    account: GitHubInstallationAccount;
    status: "suspended" | "deleted";
  }): Promise<{ synchronizedAt: string }> {
    assertInstallationId(input.installationId);
    assertAccount(input.account);
    const synchronizedAt = this.now().toISOString();

    await this.dependencies.store.deactivateInstallation({
      installationId: input.installationId,
      account: input.account,
      status: input.status,
      synchronizedAt,
    });

    return { synchronizedAt };
  }
}
