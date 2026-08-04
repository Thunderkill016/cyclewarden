export type GitHubRepositoryPermissionLevel = "read" | "write";

export interface GitHubRepositoryPermissions {
  metadata: "read";
  contents: GitHubRepositoryPermissionLevel;
  pull_requests: GitHubRepositoryPermissionLevel;
}

export interface GitHubRepositoryGrant {
  installationId: string;
  repositoryId: string;
  active: boolean;
}

export interface GitHubRepositoryGrantResolver {
  getRepositoryGrant(input: {
    installationId: string;
    repositoryId: string;
  }): Promise<GitHubRepositoryGrant | null>;
}

export interface GitHubAppJwtSigner {
  sign(input: {
    appId: string;
    issuedAtEpochSeconds: number;
    expiresAtEpochSeconds: number;
  }): Promise<string>;
}

export interface GitHubInstallationTokenClient {
  createInstallationToken(input: {
    appJwt: string;
    installationId: string;
    repositoryIds: readonly [string];
    permissions: GitHubRepositoryPermissions;
  }): Promise<{
    token: string;
    expiresAt: string;
    repositoryIds: string[];
    permissions: Partial<Record<keyof GitHubRepositoryPermissions, GitHubRepositoryPermissionLevel>>;
  }>;
}

export interface GitHubRepositoryCredential {
  token: string;
  repositoryId: string;
  expiresAt: string;
  permissions: GitHubRepositoryPermissions;
}

export class GitHubCredentialBrokerError extends Error {
  constructor(
    readonly code:
      | "INVALID_INPUT"
      | "REPOSITORY_NOT_GRANTED"
      | "CREDENTIAL_SCOPE_CONFLICT"
      | "INVALID_EXPIRY"
      | "BROKER_UNAVAILABLE",
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GitHubCredentialBrokerError";
  }
}

export interface GitHubCredentialBrokerDependencies {
  appId: string;
  grants: GitHubRepositoryGrantResolver;
  signer: GitHubAppJwtSigner;
  tokens: GitHubInstallationTokenClient;
  now?: () => Date;
  jwtBackdateSeconds?: number;
  jwtLifetimeSeconds?: number;
  minimumTokenLifetimeSeconds?: number;
  maximumTokenLifetimeSeconds?: number;
}

const ID_PATTERN = /^[1-9][0-9]*$/;
const TOKEN_PATTERN = /\S/;
const PERMISSION_RANK: Record<GitHubRepositoryPermissionLevel, number> = {
  read: 1,
  write: 2,
};

function assertPositiveIntegerString(value: string, name: string): void {
  if (!ID_PATTERN.test(value)) {
    throw new GitHubCredentialBrokerError(
      "INVALID_INPUT",
      `${name} must be a positive integer string.`,
    );
  }
}

function normalizePermissions(
  permissions: GitHubRepositoryPermissions,
): GitHubRepositoryPermissions {
  if (permissions.metadata !== "read") {
    throw new GitHubCredentialBrokerError(
      "INVALID_INPUT",
      "GitHub metadata permission must remain read-only.",
    );
  }
  if (
    (permissions.contents !== "read" && permissions.contents !== "write") ||
    (permissions.pull_requests !== "read" &&
      permissions.pull_requests !== "write")
  ) {
    throw new GitHubCredentialBrokerError(
      "INVALID_INPUT",
      "GitHub repository permissions are invalid.",
    );
  }

  return Object.freeze({
    metadata: "read" as const,
    contents: permissions.contents,
    pull_requests: permissions.pull_requests,
  });
}

function assertReturnedScope(input: {
  repositoryId: string;
  requestedPermissions: GitHubRepositoryPermissions;
  repositoryIds: string[];
  permissions: Partial<
    Record<keyof GitHubRepositoryPermissions, GitHubRepositoryPermissionLevel>
  >;
}): void {
  if (
    input.repositoryIds.length !== 1 ||
    input.repositoryIds[0] !== input.repositoryId
  ) {
    throw new GitHubCredentialBrokerError(
      "CREDENTIAL_SCOPE_CONFLICT",
      "GitHub returned a credential that is not restricted to the selected repository.",
    );
  }

  for (const permission of [
    "metadata",
    "contents",
    "pull_requests",
  ] as const) {
    const returned = input.permissions[permission];
    const requested = input.requestedPermissions[permission];
    if (
      returned === undefined ||
      PERMISSION_RANK[returned] > PERMISSION_RANK[requested]
    ) {
      throw new GitHubCredentialBrokerError(
        "CREDENTIAL_SCOPE_CONFLICT",
        `GitHub returned an invalid or broader ${permission} permission.`,
      );
    }
  }

  for (const permission of Object.keys(input.permissions)) {
    if (
      permission !== "metadata" &&
      permission !== "contents" &&
      permission !== "pull_requests"
    ) {
      throw new GitHubCredentialBrokerError(
        "CREDENTIAL_SCOPE_CONFLICT",
        `GitHub returned unexpected permission ${permission}.`,
      );
    }
  }
}

export class GitHubCredentialBroker {
  private readonly now: () => Date;
  private readonly jwtBackdateSeconds: number;
  private readonly jwtLifetimeSeconds: number;
  private readonly minimumTokenLifetimeSeconds: number;
  private readonly maximumTokenLifetimeSeconds: number;

  constructor(private readonly dependencies: GitHubCredentialBrokerDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.jwtBackdateSeconds = dependencies.jwtBackdateSeconds ?? 60;
    this.jwtLifetimeSeconds = dependencies.jwtLifetimeSeconds ?? 540;
    this.minimumTokenLifetimeSeconds =
      dependencies.minimumTokenLifetimeSeconds ?? 60;
    this.maximumTokenLifetimeSeconds =
      dependencies.maximumTokenLifetimeSeconds ?? 3_600;

    assertPositiveIntegerString(dependencies.appId, "GitHub App ID");
    if (
      !Number.isInteger(this.jwtBackdateSeconds) ||
      this.jwtBackdateSeconds < 0 ||
      this.jwtBackdateSeconds > 60
    ) {
      throw new GitHubCredentialBrokerError(
        "INVALID_INPUT",
        "GitHub App JWT backdate must be an integer between 0 and 60 seconds.",
      );
    }
    if (
      !Number.isInteger(this.jwtLifetimeSeconds) ||
      this.jwtLifetimeSeconds < 60 ||
      this.jwtLifetimeSeconds > 600 - this.jwtBackdateSeconds
    ) {
      throw new GitHubCredentialBrokerError(
        "INVALID_INPUT",
        "GitHub App JWT lifetime exceeds the ten-minute signing window.",
      );
    }
    if (
      !Number.isInteger(this.minimumTokenLifetimeSeconds) ||
      !Number.isInteger(this.maximumTokenLifetimeSeconds) ||
      this.minimumTokenLifetimeSeconds < 1 ||
      this.maximumTokenLifetimeSeconds < this.minimumTokenLifetimeSeconds ||
      this.maximumTokenLifetimeSeconds > 3_600
    ) {
      throw new GitHubCredentialBrokerError(
        "INVALID_INPUT",
        "GitHub installation token lifetime bounds are invalid.",
      );
    }
  }

  async withRepositoryCredential<T>(input: {
    installationId: string;
    repositoryId: string;
    permissions: GitHubRepositoryPermissions;
    use: (credential: Readonly<GitHubRepositoryCredential>) => Promise<T>;
  }): Promise<T> {
    assertPositiveIntegerString(input.installationId, "GitHub installation ID");
    assertPositiveIntegerString(input.repositoryId, "GitHub repository ID");
    if (typeof input.use !== "function") {
      throw new GitHubCredentialBrokerError(
        "INVALID_INPUT",
        "GitHub credential consumer callback is required.",
      );
    }
    const permissions = normalizePermissions(input.permissions);

    const grant = await this.dependencies.grants.getRepositoryGrant({
      installationId: input.installationId,
      repositoryId: input.repositoryId,
    });
    if (
      grant === null ||
      !grant.active ||
      grant.installationId !== input.installationId ||
      grant.repositoryId !== input.repositoryId
    ) {
      throw new GitHubCredentialBrokerError(
        "REPOSITORY_NOT_GRANTED",
        "The selected repository is not active for this GitHub App installation.",
      );
    }

    const now = this.now();
    const nowEpochSeconds = Math.floor(now.getTime() / 1_000);
    const issuedAtEpochSeconds = nowEpochSeconds - this.jwtBackdateSeconds;
    const expiresAtEpochSeconds =
      issuedAtEpochSeconds + this.jwtBackdateSeconds + this.jwtLifetimeSeconds;

    let appJwt: string;
    try {
      appJwt = await this.dependencies.signer.sign({
        appId: this.dependencies.appId,
        issuedAtEpochSeconds,
        expiresAtEpochSeconds,
      });
    } catch (error) {
      throw new GitHubCredentialBrokerError(
        "BROKER_UNAVAILABLE",
        "GitHub App JWT signing failed.",
        error,
      );
    }
    if (!TOKEN_PATTERN.test(appJwt)) {
      throw new GitHubCredentialBrokerError(
        "BROKER_UNAVAILABLE",
        "GitHub App JWT signer returned an empty credential.",
      );
    }

    let issued: Awaited<
      ReturnType<GitHubInstallationTokenClient["createInstallationToken"]>
    >;
    try {
      issued = await this.dependencies.tokens.createInstallationToken({
        appJwt,
        installationId: input.installationId,
        repositoryIds: [input.repositoryId],
        permissions,
      });
    } catch (error) {
      throw new GitHubCredentialBrokerError(
        "BROKER_UNAVAILABLE",
        "GitHub installation token creation failed.",
        error,
      );
    }

    if (!TOKEN_PATTERN.test(issued.token)) {
      throw new GitHubCredentialBrokerError(
        "BROKER_UNAVAILABLE",
        "GitHub returned an empty installation token.",
      );
    }
    assertReturnedScope({
      repositoryId: input.repositoryId,
      requestedPermissions: permissions,
      repositoryIds: issued.repositoryIds,
      permissions: issued.permissions,
    });

    const expiresAtMs = Date.parse(issued.expiresAt);
    if (!Number.isFinite(expiresAtMs)) {
      throw new GitHubCredentialBrokerError(
        "INVALID_EXPIRY",
        "GitHub returned an invalid installation token expiry.",
      );
    }
    const lifetimeSeconds = Math.floor((expiresAtMs - now.getTime()) / 1_000);
    if (
      lifetimeSeconds < this.minimumTokenLifetimeSeconds ||
      lifetimeSeconds > this.maximumTokenLifetimeSeconds
    ) {
      throw new GitHubCredentialBrokerError(
        "INVALID_EXPIRY",
        "GitHub installation token lifetime is outside the accepted short-lived window.",
      );
    }

    const credential = Object.freeze({
      token: issued.token,
      repositoryId: input.repositoryId,
      expiresAt: new Date(expiresAtMs).toISOString(),
      permissions,
    });

    return input.use(credential);
  }
}
