import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  GitHubInstallationReconciler,
  type GitHubInstallationAccount,
  type GitHubInstallationInventoryClient,
  type GitHubInstallationRepositoryStore,
} from "./github-installation-reconciler.js";
import {
  GitHubWebhookError,
  GitHubWebhookHandler,
  type GitHubWebhookDeliveryStore,
} from "./github-webhook-handler.js";
import type { GitHubRepositoryRecord } from "./github-source-provider.js";

const SECRET = "atoryn-test-webhook-secret";
const ACCOUNT: GitHubInstallationAccount = {
  id: "77",
  login: "atoryn",
  type: "Organization",
};
const REPOSITORY_ONE: GitHubRepositoryRecord = {
  id: "101",
  owner: "atoryn",
  name: "alpha",
  defaultBranch: "main",
  archived: false,
};
const REPOSITORY_TWO: GitHubRepositoryRecord = {
  id: "202",
  owner: "atoryn",
  name: "beta",
  defaultBranch: "trunk",
  archived: false,
};

class RecordingRepositoryStore implements GitHubInstallationRepositoryStore {
  readonly snapshots: Array<{
    installationId: string;
    account: GitHubInstallationAccount;
    status: "active";
    repositoryIds: string[];
    synchronizedAt: string;
  }> = [];
  readonly deactivations: Array<{
    installationId: string;
    account: GitHubInstallationAccount;
    status: "suspended" | "deleted";
    synchronizedAt: string;
  }> = [];

  async replaceInstallationSnapshot(input: Parameters<
    GitHubInstallationRepositoryStore["replaceInstallationSnapshot"]
  >[0]): Promise<void> {
    this.snapshots.push({
      installationId: input.installationId,
      account: input.account,
      status: input.status,
      repositoryIds: input.repositories.map(
        (repository) => repository.externalRepositoryId,
      ),
      synchronizedAt: input.synchronizedAt,
    });
  }

  async deactivateInstallation(input: Parameters<
    GitHubInstallationRepositoryStore["deactivateInstallation"]
  >[0]): Promise<void> {
    this.deactivations.push(input);
  }
}

class RecordingDeliveryStore implements GitHubWebhookDeliveryStore {
  readonly active = new Set<string>();
  readonly completed = new Set<string>();
  readonly released = new Set<string>();
  beginCalls = 0;

  async begin(input: Parameters<GitHubWebhookDeliveryStore["begin"]>[0]) {
    this.beginCalls += 1;
    if (this.active.has(input.deliveryId) || this.completed.has(input.deliveryId)) {
      return "duplicate" as const;
    }
    this.active.add(input.deliveryId);
    return "accepted" as const;
  }

  async complete(input: Parameters<GitHubWebhookDeliveryStore["complete"]>[0]) {
    this.active.delete(input.deliveryId);
    this.completed.add(input.deliveryId);
  }

  async release(input: Parameters<GitHubWebhookDeliveryStore["release"]>[0]) {
    this.active.delete(input.deliveryId);
    this.released.add(input.deliveryId);
  }
}

class PagedInventoryClient implements GitHubInstallationInventoryClient {
  fail = false;
  readonly calls: Array<{ cursor?: string; pageSize: number }> = [];

  async listRepositories(input: { cursor?: string; pageSize: number }) {
    this.calls.push(input);
    if (this.fail) throw new Error("GitHub inventory unavailable");
    if (input.cursor === undefined) {
      return {
        repositories: [REPOSITORY_TWO],
        nextCursor: "page-2",
      };
    }
    return {
      repositories: [REPOSITORY_ONE],
      nextCursor: null,
    };
  }
}

function payload(action: string) {
  return {
    action,
    installation: {
      id: 42,
      account: {
        id: Number(ACCOUNT.id),
        login: ACCOUNT.login,
        type: ACCOUNT.type,
      },
    },
  };
}

function signedRequest(input: {
  deliveryId: string;
  eventName: string;
  payload: unknown;
  secret?: string;
}) {
  const body = Buffer.from(JSON.stringify(input.payload), "utf8");
  const signature = `sha256=${createHmac("sha256", input.secret ?? SECRET)
    .update(body)
    .digest("hex")}`;
  return {
    headers: {
      "x-github-delivery": input.deliveryId,
      "x-github-event": input.eventName,
      "x-hub-signature-256": signature,
    },
    body,
  };
}

function fixture() {
  const inventory = new PagedInventoryClient();
  const repositories = new RecordingRepositoryStore();
  const deliveries = new RecordingDeliveryStore();
  const now = () => new Date("2026-08-05T00:00:00.000Z");
  const installations = new GitHubInstallationReconciler({
    clients: { forInstallation: async () => inventory },
    store: repositories,
    now,
    pageSize: 100,
  });
  const handler = new GitHubWebhookHandler({
    secrets: { getSecret: async () => SECRET },
    deliveries,
    installations,
    now,
  });
  return { handler, inventory, repositories, deliveries };
}

describe("GitHubWebhookHandler", () => {
  it("verifies a signed installation_repositories delivery and replaces the full snapshot", async () => {
    const { handler, inventory, repositories, deliveries } = fixture();

    await expect(
      handler.handle(
        signedRequest({
          deliveryId: "delivery-1",
          eventName: "installation_repositories",
          payload: payload("added"),
        }),
      ),
    ).resolves.toEqual({
      status: "processed",
      deliveryId: "delivery-1",
      eventName: "installation_repositories",
      action: "added",
    });

    expect(inventory.calls).toEqual([
      { pageSize: 100 },
      { cursor: "page-2", pageSize: 100 },
    ]);
    expect(repositories.snapshots).toEqual([
      {
        installationId: "42",
        account: ACCOUNT,
        status: "active",
        repositoryIds: ["101", "202"],
        synchronizedAt: "2026-08-05T00:00:00.000Z",
      },
    ]);
    expect(deliveries.completed.has("delivery-1")).toBe(true);
  });

  it("rejects an invalid signature before claiming the delivery", async () => {
    const { handler, deliveries, repositories } = fixture();

    await expect(
      handler.handle(
        signedRequest({
          deliveryId: "delivery-invalid",
          eventName: "installation",
          payload: payload("created"),
          secret: "wrong-secret",
        }),
      ),
    ).rejects.toMatchObject<Partial<GitHubWebhookError>>({
      code: "INVALID_SIGNATURE",
    });

    expect(deliveries.beginCalls).toBe(0);
    expect(repositories.snapshots).toHaveLength(0);
  });

  it("deduplicates a completed delivery without reconciling twice", async () => {
    const { handler, inventory, repositories } = fixture();
    const request = signedRequest({
      deliveryId: "delivery-duplicate",
      eventName: "installation",
      payload: payload("created"),
    });

    await handler.handle(request);
    await expect(handler.handle(request)).resolves.toEqual({
      status: "duplicate",
      deliveryId: "delivery-duplicate",
      eventName: "installation",
    });

    expect(inventory.calls).toHaveLength(2);
    expect(repositories.snapshots).toHaveLength(1);
  });

  it("releases a failed claim so GitHub can retry the same delivery", async () => {
    const { handler, inventory, repositories, deliveries } = fixture();
    const request = signedRequest({
      deliveryId: "delivery-retry",
      eventName: "installation_repositories",
      payload: payload("removed"),
    });
    inventory.fail = true;

    await expect(handler.handle(request)).rejects.toThrow(
      "GitHub inventory unavailable",
    );
    expect(deliveries.released.has("delivery-retry")).toBe(true);

    inventory.fail = false;
    await expect(handler.handle(request)).resolves.toMatchObject({
      status: "processed",
      action: "removed",
    });
    expect(repositories.snapshots).toHaveLength(1);
  });

  it("deactivates suspended installations without listing repositories", async () => {
    const { handler, inventory, repositories } = fixture();

    await handler.handle(
      signedRequest({
        deliveryId: "delivery-suspend",
        eventName: "installation",
        payload: payload("suspend"),
      }),
    );

    expect(inventory.calls).toHaveLength(0);
    expect(repositories.deactivations).toEqual([
      {
        installationId: "42",
        account: ACCOUNT,
        status: "suspended",
        synchronizedAt: "2026-08-05T00:00:00.000Z",
      },
    ]);
  });

  it("acknowledges unrelated signed events without mutating installation state", async () => {
    const { handler, inventory, repositories } = fixture();

    await expect(
      handler.handle(
        signedRequest({
          deliveryId: "delivery-ping",
          eventName: "ping",
          payload: { zen: "Design for failure." },
        }),
      ),
    ).resolves.toEqual({
      status: "ignored",
      deliveryId: "delivery-ping",
      eventName: "ping",
      action: null,
    });

    expect(inventory.calls).toHaveLength(0);
    expect(repositories.snapshots).toHaveLength(0);
    expect(repositories.deactivations).toHaveLength(0);
  });
});
