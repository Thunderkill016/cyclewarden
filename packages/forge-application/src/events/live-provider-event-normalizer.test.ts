import { describe, expect, it } from "vitest";

import {
  ATORYN_LIVE_PROVIDER_EVENT_SCHEMA_VERSION,
  ATORYN_PROVIDER_PAYLOAD_VERSION,
  LiveProviderEventNormalizationError,
  normalizeLiveProviderEvent,
} from "./live-provider-event-normalizer.js";

const HEAD_SHA = "a".repeat(40);

describe("normalizeLiveProviderEvent", () => {
  it("normalizes a GitHub publication into a versioned provider event without assigning sequence", () => {
    const event = normalizeLiveProviderEvent({
      source: "source",
      providerKey: "github",
      externalRunId: "installation-42",
      cursor: "delivery-123",
      event: {
        kind: "publication.created",
        repositoryId: "101",
        branchName: "atoryn/run-42",
        commitSha: HEAD_SHA.toUpperCase(),
        changeRequestId: "7",
        changeRequestUrl: "https://github.com/atoryn/fixture/pull/7",
      },
    });

    expect(event).toEqual({
      type: "source.publication_created",
      actorType: "provider",
      actorId: "github",
      correlationId: expect.stringMatching(/^source:[0-9a-f]{64}$/),
      payload: {
        provider: {
          source: "source",
          key: "github",
          externalRunId: "installation-42",
          cursor: "delivery-123",
          payloadVersion: ATORYN_PROVIDER_PAYLOAD_VERSION,
        },
        redactionCount: 0,
        data: {
          repositoryId: "101",
          branchName: "atoryn/run-42",
          commitSha: HEAD_SHA,
          changeRequestId: "7",
          changeRequestUrl: "https://github.com/atoryn/fixture/pull/7",
        },
      },
      schemaVersion: ATORYN_LIVE_PROVIDER_EVENT_SCHEMA_VERSION,
    });
    expect("sequence" in event).toBe(false);
    expect("runId" in event).toBe(false);
    expect("createdAt" in event).toBe(false);
  });

  it("produces deterministic correlation IDs from provider identity and cursor", () => {
    const input = {
      source: "sandbox" as const,
      providerKey: "vercel-sandbox",
      externalRunId: "sandbox-1",
      cursor: "operation-created",
      event: {
        kind: "created" as const,
        expiresAt: "2026-08-05T01:00:00.000Z",
      },
    };

    const first = normalizeLiveProviderEvent(input);
    const second = normalizeLiveProviderEvent(input);
    const nextCursor = normalizeLiveProviderEvent({
      ...input,
      cursor: "operation-created-2",
    });

    expect(first.correlationId).toBe(second.correlationId);
    expect(first.correlationId).not.toBe(nextCursor.correlationId);
    expect(first).toMatchObject({
      type: "sandbox.ready",
      actorType: "provider",
      actorId: "vercel-sandbox",
      payload: {
        provider: {
          source: "sandbox",
          payloadVersion: 1,
        },
        data: { expiresAt: "2026-08-05T01:00:00.000Z" },
      },
      schemaVersion: 1,
    });
  });

  it("maps every coding-agent event into stable Atoryn event names", () => {
    const events = [
      { type: "message" as const, text: "Editing files" },
      {
        type: "tool_requested" as const,
        requestKey: "approval-1",
        tool: "commandExecution",
        input: { command: "pnpm test" },
      },
      { type: "usage" as const, inputTokens: 100, outputTokens: 25 },
      { type: "completed" as const, summary: "Done" },
      { type: "failed" as const, code: "TURN_FAILED", summary: "Failed" },
    ];

    expect(
      events.map((event, index) =>
        normalizeLiveProviderEvent({
          source: "agent",
          providerKey: "codex",
          externalRunId: "thread-1",
          cursor: String(index + 1),
          event,
        }).type,
      ),
    ).toEqual([
      "agent.message",
      "agent.tool_requested",
      "agent.usage",
      "agent.completed",
      "agent.failed",
    ]);
  });

  it("redacts secret fields and credential-shaped strings before persistence", () => {
    const original = {
      command: "curl -H 'Authorization: Bearer abc.def.ghi' https://example.test",
      githubToken: "ghp_abcdefghijklmnopqrstuvwxyz123456",
      nested: {
        api_key: "sk-abcdefghijklmnopqrstuvwxyz123456",
      },
    };

    const normalized = normalizeLiveProviderEvent({
      source: "agent",
      providerKey: "codex",
      externalRunId: "thread-1",
      cursor: "approval-1",
      event: {
        type: "tool_requested",
        requestKey: "approval-1",
        tool: "commandExecution",
        input: original,
      },
    });

    expect(normalized.payload.redactionCount).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(normalized.payload.data)).not.toContain("ghp_");
    expect(JSON.stringify(normalized.payload.data)).not.toContain("sk-");
    expect(JSON.stringify(normalized.payload.data)).not.toContain("Bearer abc");
    expect(original.githubToken).toContain("ghp_");
    expect(original.nested.api_key).toContain("sk-");
  });

  it("normalizes sandbox command and exposure lifecycle events", () => {
    const command = normalizeLiveProviderEvent({
      source: "sandbox",
      providerKey: "vercel-sandbox",
      externalRunId: "sandbox-1",
      cursor: "command-7",
      event: {
        kind: "command.completed",
        command: "pnpm test",
        exitCode: 0,
        durationMs: 25,
      },
    });
    const exposure = normalizeLiveProviderEvent({
      source: "sandbox",
      providerKey: "vercel-sandbox",
      externalRunId: "sandbox-1",
      cursor: "expose-8080",
      event: {
        kind: "exposed",
        port: 8080,
        url: "https://8080-sandbox-1.vercel.run",
      },
    });

    expect(command).toMatchObject({
      type: "sandbox.command_completed",
      payload: {
        data: { command: "pnpm test", exitCode: 0, durationMs: 25 },
      },
    });
    expect(exposure).toMatchObject({
      type: "sandbox.exposed",
      payload: {
        data: { port: 8080, url: "https://8080-sandbox-1.vercel.run/" },
      },
    });
  });

  it("rejects invalid provider metadata, publication identities, and non-JSON tool input", () => {
    expect(() =>
      normalizeLiveProviderEvent({
        source: "source",
        providerKey: "github",
        externalRunId: "installation-42",
        cursor: "delivery-1",
        event: {
          kind: "publication.created",
          repositoryId: "101",
          branchName: "atoryn/run-42",
          commitSha: "abc123",
          changeRequestId: "7",
          changeRequestUrl: "https://github.com/atoryn/fixture/pull/7",
        },
      }),
    ).toThrowError(LiveProviderEventNormalizationError);

    expect(() =>
      normalizeLiveProviderEvent({
        source: "source",
        providerKey: "github",
        externalRunId: "installation-42",
        cursor: "delivery-2",
        event: {
          kind: "publication.created",
          repositoryId: "101",
          branchName: "atoryn/run-42",
          commitSha: HEAD_SHA,
          changeRequestId: "7",
          changeRequestUrl: "https://user:password@github.com/atoryn/fixture/pull/7",
        },
      }),
    ).toThrowError(LiveProviderEventNormalizationError);

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() =>
      normalizeLiveProviderEvent({
        source: "agent",
        providerKey: "codex",
        externalRunId: "thread-1",
        cursor: "approval-cyclic",
        event: {
          type: "tool_requested",
          requestKey: "approval-cyclic",
          tool: "commandExecution",
          input: cyclic,
        },
      }),
    ).toMatchObject<Partial<LiveProviderEventNormalizationError>>({
      code: "NON_JSON_PAYLOAD",
    });
  });
});
