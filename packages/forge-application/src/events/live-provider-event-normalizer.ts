import { createHash } from "node:crypto";

import {
  redactSecrets,
  type CodingAgentEvent,
} from "@cyclewarden/forge-domain";

export const ATORYN_LIVE_PROVIDER_EVENT_SCHEMA_VERSION = 1 as const;
export const ATORYN_PROVIDER_PAYLOAD_VERSION = 1 as const;

export type LiveSourceProviderEvent =
  | {
      kind: "installation.reconciled";
      installationId: string;
      status: "active" | "suspended" | "deleted";
      repositoryCount: number;
    }
  | {
      kind: "repository.resolved";
      repositoryId: string;
      namespace: string;
      repositoryName: string;
      defaultBranch: string;
      archived: boolean;
    }
  | {
      kind: "publication.created";
      repositoryId: string;
      branchName: string;
      commitSha: string;
      changeRequestId: string;
      changeRequestUrl: string;
    };

export type LiveSandboxProviderEvent =
  | {
      kind: "created";
      expiresAt: string;
    }
  | {
      kind: "command.completed";
      command: string;
      exitCode: number;
      durationMs: number;
    }
  | {
      kind: "exposed";
      port: number;
      url: string;
    }
  | {
      kind: "stopped";
      reason: string;
    }
  | {
      kind: "destroyed";
    };

export type LiveProviderEventInput =
  | {
      source: "source";
      providerKey: string;
      externalRunId: string;
      cursor: string;
      event: LiveSourceProviderEvent;
    }
  | {
      source: "sandbox";
      providerKey: string;
      externalRunId: string;
      cursor: string;
      event: LiveSandboxProviderEvent;
    }
  | {
      source: "agent";
      providerKey: string;
      externalRunId: string;
      cursor: string;
      event: CodingAgentEvent;
    };

export interface NormalizedLiveProviderRunEvent {
  type: string;
  actorType: "agent" | "provider";
  actorId: string;
  correlationId: string;
  payload: {
    provider: {
      source: LiveProviderEventInput["source"];
      key: string;
      externalRunId: string;
      cursor: string;
      payloadVersion: typeof ATORYN_PROVIDER_PAYLOAD_VERSION;
    };
    redactionCount: number;
    data: JsonValue;
  };
  schemaVersion: typeof ATORYN_LIVE_PROVIDER_EVENT_SCHEMA_VERSION;
}

export class LiveProviderEventNormalizationError extends Error {
  constructor(
    readonly code:
      | "INVALID_INPUT"
      | "INVALID_EVENT"
      | "NON_JSON_PAYLOAD"
      | "PAYLOAD_LIMIT_EXCEEDED",
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LiveProviderEventNormalizationError";
  }
}

type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const GIT_SHA_PATTERN = /^[0-9a-f]{40,64}$/i;
const MAX_IDENTIFIER_LENGTH = 512;
const MAX_TEXT_LENGTH = 100_000;
const MAX_JSON_DEPTH = 20;
const MAX_JSON_NODES = 10_000;

function normalizeText(
  value: string,
  name: string,
  maximumLength = MAX_TEXT_LENGTH,
): string {
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > maximumLength ||
    CONTROL_CHARACTER_PATTERN.test(normalized)
  ) {
    throw new LiveProviderEventNormalizationError(
      "INVALID_INPUT",
      `${name} must be non-empty, within ${maximumLength} characters, and free of control characters.`,
    );
  }
  return normalized;
}

function normalizeNonNegativeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new LiveProviderEventNormalizationError(
      "INVALID_EVENT",
      `${name} must be a non-negative safe integer.`,
    );
  }
  return value;
}

function normalizePositiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new LiveProviderEventNormalizationError(
      "INVALID_EVENT",
      `${name} must be a positive safe integer.`,
    );
  }
  return value;
}

function normalizeTimestamp(value: string, name: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new LiveProviderEventNormalizationError(
      "INVALID_EVENT",
      `${name} must be a valid timestamp.`,
    );
  }
  return new Date(timestamp).toISOString();
}

function normalizeHttpsUrl(value: string, name: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    throw new LiveProviderEventNormalizationError(
      "INVALID_EVENT",
      `${name} must be a valid URL.`,
      error,
    );
  }
  if (
    url.protocol !== "https:" ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.hostname.length === 0
  ) {
    throw new LiveProviderEventNormalizationError(
      "INVALID_EVENT",
      `${name} must be credential-free HTTPS.`,
    );
  }
  return url.toString();
}

function normalizeJsonValue(
  value: unknown,
  state: {
    depth: number;
    nodes: { value: number };
    ancestors: Set<object>;
  } = {
    depth: 0,
    nodes: { value: 0 },
    ancestors: new Set<object>(),
  },
): JsonValue {
  state.nodes.value += 1;
  if (state.nodes.value > MAX_JSON_NODES || state.depth > MAX_JSON_DEPTH) {
    throw new LiveProviderEventNormalizationError(
      "PAYLOAD_LIMIT_EXCEEDED",
      "Live provider event payload exceeds the JSON depth or node limit.",
    );
  }

  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new LiveProviderEventNormalizationError(
        "NON_JSON_PAYLOAD",
        "Live provider event payload numbers must be finite.",
      );
    }
    return value;
  }
  if (
    typeof value === "undefined" ||
    typeof value === "bigint" ||
    typeof value === "symbol" ||
    typeof value === "function"
  ) {
    throw new LiveProviderEventNormalizationError(
      "NON_JSON_PAYLOAD",
      `Live provider event payload contains unsupported ${typeof value} data.`,
    );
  }

  if (state.ancestors.has(value)) {
    throw new LiveProviderEventNormalizationError(
      "NON_JSON_PAYLOAD",
      "Live provider event payload contains a circular reference.",
    );
  }
  state.ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      return value.map((item) =>
        normalizeJsonValue(item, {
          depth: state.depth + 1,
          nodes: state.nodes,
          ancestors: state.ancestors,
        }),
      );
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new LiveProviderEventNormalizationError(
        "NON_JSON_PAYLOAD",
        "Live provider event payload objects must be plain JSON objects.",
      );
    }

    const normalized: Record<string, JsonValue> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const normalizedKey = normalizeText(key, "Payload key", 256);
      normalized[normalizedKey] = normalizeJsonValue(item, {
        depth: state.depth + 1,
        nodes: state.nodes,
        ancestors: state.ancestors,
      });
    }
    return normalized;
  } finally {
    state.ancestors.delete(value);
  }
}

function normalizeSourceEvent(event: LiveSourceProviderEvent): {
  type: string;
  data: JsonValue;
} {
  if (event.kind === "installation.reconciled") {
    return {
      type: "source.installation_reconciled",
      data: {
        installationId: normalizeText(
          event.installationId,
          "Installation ID",
          MAX_IDENTIFIER_LENGTH,
        ),
        status: event.status,
        repositoryCount: normalizeNonNegativeInteger(
          event.repositoryCount,
          "Repository count",
        ),
      },
    };
  }

  if (event.kind === "repository.resolved") {
    return {
      type: "source.repository_resolved",
      data: {
        repositoryId: normalizeText(
          event.repositoryId,
          "Repository ID",
          MAX_IDENTIFIER_LENGTH,
        ),
        namespace: normalizeText(event.namespace, "Repository namespace", 256),
        repositoryName: normalizeText(
          event.repositoryName,
          "Repository name",
          256,
        ),
        defaultBranch: normalizeText(event.defaultBranch, "Default branch", 256),
        archived: event.archived,
      },
    };
  }

  if (!GIT_SHA_PATTERN.test(event.commitSha)) {
    throw new LiveProviderEventNormalizationError(
      "INVALID_EVENT",
      "Publication commit SHA must contain 40 to 64 hexadecimal characters.",
    );
  }
  return {
    type: "source.publication_created",
    data: {
      repositoryId: normalizeText(
        event.repositoryId,
        "Repository ID",
        MAX_IDENTIFIER_LENGTH,
      ),
      branchName: normalizeText(event.branchName, "Branch name", 256),
      commitSha: event.commitSha.toLowerCase(),
      changeRequestId: normalizeText(
        event.changeRequestId,
        "Change request ID",
        MAX_IDENTIFIER_LENGTH,
      ),
      changeRequestUrl: normalizeHttpsUrl(
        event.changeRequestUrl,
        "Change request URL",
      ),
    },
  };
}

function normalizeSandboxEvent(event: LiveSandboxProviderEvent): {
  type: string;
  data: JsonValue;
} {
  if (event.kind === "created") {
    return {
      type: "sandbox.ready",
      data: { expiresAt: normalizeTimestamp(event.expiresAt, "Sandbox expiry") },
    };
  }
  if (event.kind === "command.completed") {
    return {
      type: "sandbox.command_completed",
      data: {
        command: normalizeText(event.command, "Sandbox command", 4_096),
        exitCode: normalizeNonNegativeInteger(event.exitCode, "Exit code"),
        durationMs: normalizeNonNegativeInteger(event.durationMs, "Command duration"),
      },
    };
  }
  if (event.kind === "exposed") {
    return {
      type: "sandbox.exposed",
      data: {
        port: normalizePositiveInteger(event.port, "Sandbox port"),
        url: normalizeHttpsUrl(event.url, "Sandbox exposure URL"),
      },
    };
  }
  if (event.kind === "stopped") {
    return {
      type: "sandbox.stopped",
      data: { reason: normalizeText(event.reason, "Sandbox stop reason", 2_000) },
    };
  }
  return { type: "sandbox.destroyed", data: {} };
}

function normalizeAgentEvent(event: CodingAgentEvent): {
  type: string;
  data: JsonValue;
} {
  if (event.type === "message") {
    return {
      type: "agent.message",
      data: { text: normalizeText(event.text, "Agent message") },
    };
  }
  if (event.type === "tool_requested") {
    return {
      type: "agent.tool_requested",
      data: {
        requestKey: normalizeText(
          event.requestKey,
          "Agent request key",
          MAX_IDENTIFIER_LENGTH,
        ),
        tool: normalizeText(event.tool, "Agent tool", 256),
        input: normalizeJsonValue(event.input),
      },
    };
  }
  if (event.type === "usage") {
    return {
      type: "agent.usage",
      data: {
        inputTokens: normalizeNonNegativeInteger(
          event.inputTokens,
          "Input tokens",
        ),
        outputTokens: normalizeNonNegativeInteger(
          event.outputTokens,
          "Output tokens",
        ),
      },
    };
  }
  if (event.type === "completed") {
    return {
      type: "agent.completed",
      data: { summary: normalizeText(event.summary, "Agent completion summary") },
    };
  }
  return {
    type: "agent.failed",
    data: {
      code: normalizeText(event.code, "Agent failure code", 256),
      summary: normalizeText(event.summary, "Agent failure summary"),
    },
  };
}

function correlationId(input: {
  source: LiveProviderEventInput["source"];
  providerKey: string;
  externalRunId: string;
  cursor: string;
}): string {
  const digest = createHash("sha256")
    .update(input.source)
    .update("\0")
    .update(input.providerKey)
    .update("\0")
    .update(input.externalRunId)
    .update("\0")
    .update(input.cursor)
    .digest("hex");
  return `${input.source}:${digest}`;
}

export function normalizeLiveProviderEvent(
  input: LiveProviderEventInput,
): NormalizedLiveProviderRunEvent {
  const providerKey = normalizeText(
    input.providerKey,
    "Provider key",
    MAX_IDENTIFIER_LENGTH,
  );
  const externalRunId = normalizeText(
    input.externalRunId,
    "External run ID",
    MAX_IDENTIFIER_LENGTH,
  );
  const cursor = normalizeText(
    input.cursor,
    "Provider cursor",
    MAX_IDENTIFIER_LENGTH,
  );

  const normalized =
    input.source === "source"
      ? normalizeSourceEvent(input.event)
      : input.source === "sandbox"
        ? normalizeSandboxEvent(input.event)
        : normalizeAgentEvent(input.event);
  const redacted = redactSecrets(normalized.data);
  const data = normalizeJsonValue(redacted.value);

  return {
    type: normalized.type,
    actorType: input.source === "agent" ? "agent" : "provider",
    actorId: providerKey,
    correlationId: correlationId({
      source: input.source,
      providerKey,
      externalRunId,
      cursor,
    }),
    payload: {
      provider: {
        source: input.source,
        key: providerKey,
        externalRunId,
        cursor,
        payloadVersion: ATORYN_PROVIDER_PAYLOAD_VERSION,
      },
      redactionCount: redacted.redactionCount,
      data,
    },
    schemaVersion: ATORYN_LIVE_PROVIDER_EVENT_SCHEMA_VERSION,
  };
}
