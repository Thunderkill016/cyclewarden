import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { TextDecoder } from "node:util";

import {
  GitHubInstallationReconciler,
  type GitHubInstallationAccount,
} from "./github-installation-reconciler.js";

export interface GitHubWebhookSecretProvider {
  getSecret(): Promise<string>;
}

export interface GitHubWebhookDeliveryStore {
  begin(input: {
    deliveryId: string;
    eventName: string;
    payloadSha256: string;
    receivedAt: string;
  }): Promise<"accepted" | "duplicate">;

  complete(input: {
    deliveryId: string;
    completedAt: string;
  }): Promise<void>;

  release(input: {
    deliveryId: string;
    failedAt: string;
  }): Promise<void>;
}

export interface GitHubWebhookRequest {
  headers: Readonly<
    Record<string, string | readonly string[] | undefined>
  >;
  body: Uint8Array;
}

export type GitHubWebhookHandlingResult =
  | {
      status: "processed";
      deliveryId: string;
      eventName: string;
      action: string;
    }
  | {
      status: "ignored";
      deliveryId: string;
      eventName: string;
      action: string | null;
    }
  | {
      status: "duplicate";
      deliveryId: string;
      eventName: string;
    };

export class GitHubWebhookError extends Error {
  constructor(
    readonly code:
      | "INVALID_REQUEST"
      | "INVALID_SIGNATURE"
      | "INVALID_PAYLOAD"
      | "PAYLOAD_TOO_LARGE",
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GitHubWebhookError";
  }
}

export interface GitHubWebhookHandlerDependencies {
  secrets: GitHubWebhookSecretProvider;
  deliveries: GitHubWebhookDeliveryStore;
  installations: GitHubInstallationReconciler;
  now?: () => Date;
  maxBodyBytes?: number;
}

function getHeader(
  headers: GitHubWebhookRequest["headers"],
  name: string,
): string | null {
  const normalizedName = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== normalizedName || value === undefined) continue;
    if (typeof value === "string") return value.trim() || null;
    const first = value[0];
    return typeof first === "string" && first.trim().length > 0
      ? first.trim()
      : null;
  }
  return null;
}

function verifySignature(input: {
  body: Uint8Array;
  secret: string;
  signature: string;
}): boolean {
  if (!/^sha256=[0-9a-f]{64}$/i.test(input.signature)) return false;
  const expected = createHmac("sha256", input.secret)
    .update(input.body)
    .digest();
  const actual = Buffer.from(input.signature.slice("sha256=".length), "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function parsePayload(body: Uint8Array): Record<string, unknown> {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(body);
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Webhook payload must be a JSON object.");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new GitHubWebhookError(
      "INVALID_PAYLOAD",
      "GitHub webhook payload is not valid UTF-8 JSON.",
      error,
    );
  }
}

function readAction(payload: Record<string, unknown>): string | null {
  return typeof payload.action === "string" && payload.action.length > 0
    ? payload.action
    : null;
}

function readInstallation(payload: Record<string, unknown>): {
  installationId: string;
  account: GitHubInstallationAccount;
} {
  const installation = payload.installation;
  if (
    installation === null ||
    typeof installation !== "object" ||
    Array.isArray(installation)
  ) {
    throw new GitHubWebhookError(
      "INVALID_PAYLOAD",
      "GitHub webhook payload is missing installation data.",
    );
  }

  const record = installation as Record<string, unknown>;
  const account = record.account;
  if (account === null || typeof account !== "object" || Array.isArray(account)) {
    throw new GitHubWebhookError(
      "INVALID_PAYLOAD",
      "GitHub webhook payload is missing installation account data.",
    );
  }

  const accountRecord = account as Record<string, unknown>;
  const installationId =
    typeof record.id === "number" && Number.isSafeInteger(record.id)
      ? String(record.id)
      : typeof record.id === "string"
        ? record.id
        : null;
  const accountId =
    typeof accountRecord.id === "number" && Number.isSafeInteger(accountRecord.id)
      ? String(accountRecord.id)
      : typeof accountRecord.id === "string"
        ? accountRecord.id
        : null;
  const login =
    typeof accountRecord.login === "string"
      ? accountRecord.login
      : typeof accountRecord.slug === "string"
        ? accountRecord.slug
        : null;
  const rawType =
    typeof accountRecord.type === "string" ? accountRecord.type : "Unknown";
  const type: GitHubInstallationAccount["type"] =
    rawType === "User" ||
    rawType === "Organization" ||
    rawType === "Enterprise"
      ? rawType
      : "Unknown";

  if (installationId === null || accountId === null || login === null) {
    throw new GitHubWebhookError(
      "INVALID_PAYLOAD",
      "GitHub webhook installation identity is incomplete.",
    );
  }

  return {
    installationId,
    account: { id: accountId, login, type },
  };
}

export class GitHubWebhookHandler {
  private readonly now: () => Date;
  private readonly maxBodyBytes: number;

  constructor(private readonly dependencies: GitHubWebhookHandlerDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.maxBodyBytes = dependencies.maxBodyBytes ?? 1_048_576;
    if (!Number.isInteger(this.maxBodyBytes) || this.maxBodyBytes < 1) {
      throw new GitHubWebhookError(
        "INVALID_REQUEST",
        "GitHub webhook maxBodyBytes must be a positive integer.",
      );
    }
  }

  async handle(
    request: GitHubWebhookRequest,
  ): Promise<GitHubWebhookHandlingResult> {
    if (request.body.byteLength === 0) {
      throw new GitHubWebhookError(
        "INVALID_REQUEST",
        "GitHub webhook body is empty.",
      );
    }
    if (request.body.byteLength > this.maxBodyBytes) {
      throw new GitHubWebhookError(
        "PAYLOAD_TOO_LARGE",
        "GitHub webhook body exceeds the configured size limit.",
      );
    }

    const deliveryId = getHeader(request.headers, "x-github-delivery");
    const eventName = getHeader(request.headers, "x-github-event");
    const signature = getHeader(request.headers, "x-hub-signature-256");
    if (deliveryId === null || eventName === null || signature === null) {
      throw new GitHubWebhookError(
        "INVALID_REQUEST",
        "GitHub webhook delivery, event, and signature headers are required.",
      );
    }

    const secret = await this.dependencies.secrets.getSecret();
    if (secret.length === 0 || !verifySignature({ body: request.body, secret, signature })) {
      throw new GitHubWebhookError(
        "INVALID_SIGNATURE",
        "GitHub webhook signature verification failed.",
      );
    }

    const payload = parsePayload(request.body);
    const receivedAt = this.now().toISOString();
    const payloadSha256 = createHash("sha256").update(request.body).digest("hex");
    const claim = await this.dependencies.deliveries.begin({
      deliveryId,
      eventName,
      payloadSha256,
      receivedAt,
    });
    if (claim === "duplicate") {
      return { status: "duplicate", deliveryId, eventName };
    }

    try {
      const result = await this.process({ deliveryId, eventName, payload });
      await this.dependencies.deliveries.complete({
        deliveryId,
        completedAt: this.now().toISOString(),
      });
      return result;
    } catch (error) {
      await this.dependencies.deliveries.release({
        deliveryId,
        failedAt: this.now().toISOString(),
      });
      throw error;
    }
  }

  private async process(input: {
    deliveryId: string;
    eventName: string;
    payload: Record<string, unknown>;
  }): Promise<GitHubWebhookHandlingResult> {
    const action = readAction(input.payload);

    if (input.eventName === "installation") {
      if (action === null) {
        throw new GitHubWebhookError(
          "INVALID_PAYLOAD",
          "GitHub installation webhook is missing an action.",
        );
      }
      const installation = readInstallation(input.payload);

      if (action === "deleted" || action === "suspend") {
        await this.dependencies.installations.deactivate({
          ...installation,
          status: action === "deleted" ? "deleted" : "suspended",
        });
        return {
          status: "processed",
          deliveryId: input.deliveryId,
          eventName: input.eventName,
          action,
        };
      }

      if (
        action === "created" ||
        action === "unsuspend" ||
        action === "new_permissions_accepted"
      ) {
        await this.dependencies.installations.reconcile(installation);
        return {
          status: "processed",
          deliveryId: input.deliveryId,
          eventName: input.eventName,
          action,
        };
      }
    }

    if (input.eventName === "installation_repositories") {
      if (action !== "added" && action !== "removed") {
        throw new GitHubWebhookError(
          "INVALID_PAYLOAD",
          "GitHub installation_repositories webhook has an unsupported action.",
        );
      }
      const installation = readInstallation(input.payload);
      await this.dependencies.installations.reconcile(installation);
      return {
        status: "processed",
        deliveryId: input.deliveryId,
        eventName: input.eventName,
        action,
      };
    }

    return {
      status: "ignored",
      deliveryId: input.deliveryId,
      eventName: input.eventName,
      action,
    };
  }
}
