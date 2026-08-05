import { describe, expect, it } from "vitest";

import {
  GitHubCredentialBroker,
  GitHubCredentialBrokerError,
  type GitHubAppJwtSigner,
  type GitHubInstallationTokenClient,
  type GitHubRepositoryGrantResolver,
  type GitHubRepositoryPermissions,
} from "./github-credential-broker.js";

const NOW = new Date("2026-08-05T00:00:00.000Z");
const APP_ID = "9001";
const INSTALLATION_ID = "42";
const REPOSITORY_ID = "101";
const PERMISSIONS: GitHubRepositoryPermissions = {
  metadata: "read",
  contents: "write",
  pull_requests: "write",
};

class RecordingGrantResolver implements GitHubRepositoryGrantResolver {
  active = true;
  readonly calls: Array<{ installationId: string; repositoryId: string }> = [];

  async getRepositoryGrant(input: {
    installationId: string;
    repositoryId: string;
  }) {
    this.calls.push(input);
    return {
      installationId: input.installationId,
      repositoryId: input.repositoryId,
      active: this.active,
    };
  }
}

class RecordingSigner implements GitHubAppJwtSigner {
  readonly calls: Array<{
    appId: string;
    issuedAtEpochSeconds: number;
    expiresAtEpochSeconds: number;
  }> = [];

  async sign(input: {
    appId: string;
    issuedAtEpochSeconds: number;
    expiresAtEpochSeconds: number;
  }) {
    this.calls.push(input);
    return "signed-app-jwt";
  }
}

class RecordingTokenClient implements GitHubInstallationTokenClient {
  readonly calls: Array<{
    appJwt: string;
    installationId: string;
    repositoryIds: readonly [string];
    permissions: GitHubRepositoryPermissions;
  }> = [];
  repositoryIds = [REPOSITORY_ID];
  permissions: Partial<
    Record<keyof GitHubRepositoryPermissions, "read" | "write">
  > = { ...PERMISSIONS };
  expiresAt = new Date(NOW.getTime() + 60 * 60 * 1_000).toISOString();

  async createInstallationToken(input: {
    appJwt: string;
    installationId: string;
    repositoryIds: readonly [string];
    permissions: GitHubRepositoryPermissions;
  }) {
    this.calls.push(input);
    return {
      token: "ghs_repository_scoped_token",
      expiresAt: this.expiresAt,
      repositoryIds: [...this.repositoryIds],
      permissions: { ...this.permissions },
    };
  }
}

function fixture() {
  const grants = new RecordingGrantResolver();
  const signer = new RecordingSigner();
  const tokens = new RecordingTokenClient();
  const broker = new GitHubCredentialBroker({
    appId: APP_ID,
    grants,
    signer,
    tokens,
    now: () => NOW,
  });
  return { broker, grants, signer, tokens };
}

async function consume(
  broker: GitHubCredentialBroker,
  permissions = PERMISSIONS,
) {
  return broker.withRepositoryCredential({
    installationId: INSTALLATION_ID,
    repositoryId: REPOSITORY_ID,
    permissions,
    use: async (credential) => ({ ...credential }),
  });
}

describe("GitHubCredentialBroker", () => {
  it("checks the active repository grant before signing and requests one repository with exact permissions", async () => {
    const { broker, grants, signer, tokens } = fixture();

    await expect(consume(broker)).resolves.toEqual({
      token: "ghs_repository_scoped_token",
      repositoryId: REPOSITORY_ID,
      expiresAt: "2026-08-05T01:00:00.000Z",
      permissions: PERMISSIONS,
    });

    expect(grants.calls).toEqual([
      { installationId: INSTALLATION_ID, repositoryId: REPOSITORY_ID },
    ]);
    expect(signer.calls).toEqual([
      {
        appId: APP_ID,
        issuedAtEpochSeconds: Math.floor(NOW.getTime() / 1_000) - 60,
        expiresAtEpochSeconds: Math.floor(NOW.getTime() / 1_000) + 540,
      },
    ]);
    expect(tokens.calls).toEqual([
      {
        appJwt: "signed-app-jwt",
        installationId: INSTALLATION_ID,
        repositoryIds: [REPOSITORY_ID],
        permissions: PERMISSIONS,
      },
    ]);
  });

  it("rejects an inactive repository before touching the signer or token endpoint", async () => {
    const { broker, grants, signer, tokens } = fixture();
    grants.active = false;

    await expect(consume(broker)).rejects.toMatchObject({ code: "REPOSITORY_NOT_GRANTED" });

    expect(signer.calls).toHaveLength(0);
    expect(tokens.calls).toHaveLength(0);
  });

  it("rejects a token response containing more than the selected repository", async () => {
    const { broker, tokens } = fixture();
    tokens.repositoryIds = [REPOSITORY_ID, "202"];

    await expect(consume(broker)).rejects.toMatchObject({ code: "CREDENTIAL_SCOPE_CONFLICT" });
  });

  it("rejects a permission broader than requested", async () => {
    const { broker, tokens } = fixture();
    const requested: GitHubRepositoryPermissions = {
      metadata: "read",
      contents: "read",
      pull_requests: "read",
    };
    tokens.permissions = {
      metadata: "read",
      contents: "write",
      pull_requests: "read",
    };

    await expect(consume(broker, requested)).rejects.toMatchObject({ code: "CREDENTIAL_SCOPE_CONFLICT" });
  });

  it("rejects missing or unexpected permissions in the token response", async () => {
    const { broker, tokens } = fixture();
    tokens.permissions = {
      metadata: "read",
      contents: "write",
      admin: "read",
    } as typeof tokens.permissions;

    await expect(consume(broker)).rejects.toMatchObject({ code: "CREDENTIAL_SCOPE_CONFLICT" });
  });

  it("rejects expired and overlong installation token lifetimes", async () => {
    const expired = fixture();
    expired.tokens.expiresAt = new Date(NOW.getTime() - 1_000).toISOString();
    await expect(consume(expired.broker)).rejects.toMatchObject({ code: "INVALID_EXPIRY" });

    const overlong = fixture();
    overlong.tokens.expiresAt = new Date(
      NOW.getTime() + 60 * 60 * 1_000 + 1_000,
    ).toISOString();
    await expect(consume(overlong.broker)).rejects.toMatchObject({ code: "INVALID_EXPIRY" });
  });

  it("never accepts a private key dependency and exposes the token only to the scoped callback", async () => {
    const { broker } = fixture();
    let observed = false;

    const result = await broker.withRepositoryCredential({
      installationId: INSTALLATION_ID,
      repositoryId: REPOSITORY_ID,
      permissions: PERMISSIONS,
      use: async (credential) => {
        observed = true;
        expect(Object.isFrozen(credential)).toBe(true);
        expect(credential.token).toBe("ghs_repository_scoped_token");
        return "used";
      },
    });

    expect(result).toBe("used");
    expect(observed).toBe(true);
    expect("privateKey" in broker).toBe(false);
  });
});
