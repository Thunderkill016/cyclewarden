import { describe, expect, it } from "vitest";

import type { SandboxLimits } from "@cyclewarden/forge-domain";

import {
  VercelSandboxProvider,
  VercelSandboxProviderError,
  type VercelSandboxClient,
  type VercelSandboxCommandResult,
  type VercelSandboxCreateInput,
  type VercelSandboxRecord,
  type VercelSandboxRegistry,
} from "./vercel-sandbox-provider.js";

const NOW = new Date("2026-08-05T00:00:00.000Z");
const EXPIRES_AT = new Date(NOW.getTime() + 5 * 60 * 1_000).toISOString();

class RecordingSandbox implements VercelSandboxClient {
  readonly sandboxId = "sbx_atoryn_1";
  readonly expiresAt = EXPIRES_AT;
  readonly commands: Array<Parameters<VercelSandboxClient["runCommand"]>[0]> = [];
  readonly domains: number[] = [];
  stopCalls = 0;
  deleteCalls = 0;
  commandResult: VercelSandboxCommandResult = {
    exitCode: 0,
    stdout: async () => "tests passed",
    stderr: "",
    startedAt: "2026-08-05T00:00:01.000Z",
    finishedAt: "2026-08-05T00:00:01.025Z",
  };
  exposureUrl = "https://8080-sbx-atoryn-1.vercel.run/";

  async runCommand(input: Parameters<VercelSandboxClient["runCommand"]>[0]) {
    this.commands.push(input);
    return this.commandResult;
  }

  domain(port: number): string {
    this.domains.push(port);
    return this.exposureUrl;
  }

  async stop(): Promise<void> {
    this.stopCalls += 1;
  }

  async delete(): Promise<void> {
    this.deleteCalls += 1;
  }
}

class RecordingRegistry implements VercelSandboxRegistry {
  readonly records = new Map<string, VercelSandboxRecord>();
  readonly stopped: Array<{
    sandboxId: string;
    reason: string;
    stoppedAt: string;
  }> = [];

  async register(record: VercelSandboxRecord): Promise<void> {
    this.records.set(record.sandboxId, record);
  }

  async get(sandboxId: string): Promise<VercelSandboxRecord | null> {
    return this.records.get(sandboxId) ?? null;
  }

  async markStopped(input: {
    sandboxId: string;
    reason: string;
    stoppedAt: string;
  }): Promise<void> {
    this.stopped.push(input);
    const current = this.records.get(input.sandboxId);
    if (current) this.records.set(input.sandboxId, { ...current, status: "stopped" });
  }

  async remove(sandboxId: string): Promise<void> {
    this.records.delete(sandboxId);
  }
}

function limits(overrides: Partial<SandboxLimits> = {}): SandboxLimits {
  return {
    timeoutMs: 5 * 60 * 1_000,
    cpuMillis: 2_000,
    memoryMb: 2_048,
    storageMb: 4_096,
    allowedHosts: [],
    exposedPorts: [8080],
    ...overrides,
  };
}

function fixture() {
  const sandbox = new RecordingSandbox();
  const createCalls: VercelSandboxCreateInput[] = [];
  const bootstrapCalls: Array<{
    repositoryUrl: string;
    repositoryCredentialHandle: string;
    baseBranch: string;
  }> = [];
  const registry = new RecordingRegistry();
  let bootstrapFailure: Error | null = null;

  const provider = new VercelSandboxProvider({
    clients: {
      create: async (input) => {
        createCalls.push(input);
        return sandbox;
      },
      get: async (sandboxId) => {
        if (sandboxId !== sandbox.sandboxId) throw new Error("not found");
        return sandbox;
      },
    },
    repositories: {
      bootstrap: async (input) => {
        bootstrapCalls.push({
          repositoryUrl: input.repositoryUrl,
          repositoryCredentialHandle: input.repositoryCredentialHandle,
          baseBranch: input.baseBranch,
        });
        if (bootstrapFailure) throw bootstrapFailure;
      },
    },
    registry,
    now: () => NOW,
  });

  return {
    provider,
    sandbox,
    registry,
    createCalls,
    bootstrapCalls,
    failBootstrap(error: Error) {
      bootstrapFailure = error;
    },
  };
}

async function create(provider: VercelSandboxProvider, policy = limits()) {
  return provider.create({
    runId: "11111111-1111-4111-8111-111111111111",
    repositoryUrl: "https://github.com/atoryn/fixture.git",
    repositoryCredentialHandle: "credential-handle-1",
    baseBranch: "main",
    limits: policy,
  });
}

describe("VercelSandboxProvider", () => {
  it("creates an ephemeral Node 24 sandbox with deny-all networking and approved ports", async () => {
    const { provider, createCalls, bootstrapCalls, registry } = fixture();

    await expect(create(provider)).resolves.toEqual({
      sandboxId: "sbx_atoryn_1",
      expiresAt: EXPIRES_AT,
    });

    expect(createCalls).toHaveLength(1);
    expect(createCalls[0]).toMatchObject({
      runtime: "node24",
      timeoutMs: 300_000,
      persistent: false,
      ports: [8080],
      networkPolicy: { mode: "deny-all" },
      resources: {
        cpuMillis: 2_000,
        memoryMb: 2_048,
        storageMb: 4_096,
      },
      tags: { "atoryn.lifecycle": "ephemeral" },
    });
    expect(JSON.stringify(createCalls[0])).not.toContain("credential-handle-1");
    expect(bootstrapCalls).toEqual([
      {
        repositoryUrl: "https://github.com/atoryn/fixture.git",
        repositoryCredentialHandle: "credential-handle-1",
        baseBranch: "main",
      },
    ]);
    await expect(registry.get("sbx_atoryn_1")).resolves.toMatchObject({
      status: "running",
      exposedPorts: [8080],
    });
  });

  it("normalizes an explicit public-host allowlist", async () => {
    const { provider, createCalls } = fixture();

    await create(
      provider,
      limits({
        allowedHosts: ["API.GITHUB.COM.", "registry.npmjs.org", "api.github.com"],
      }),
    );

    expect(createCalls[0]?.networkPolicy).toEqual({
      mode: "allow-only",
      hosts: ["api.github.com", "registry.npmjs.org"],
    });
  });

  it("deletes the sandbox when repository bootstrap fails", async () => {
    const { provider, sandbox, registry, failBootstrap } = fixture();
    failBootstrap(new Error("clone failed"));

    await expect(create(provider)).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });

    expect(sandbox.deleteCalls).toBe(1);
    await expect(registry.get(sandbox.sandboxId)).resolves.toBeNull();
  });

  it("executes within the approved lease and normalizes streamed output", async () => {
    const { provider, sandbox } = fixture();
    await create(provider);

    await expect(
      provider.execute({
        sandboxId: sandbox.sandboxId,
        command: "pnpm",
        args: ["test"],
        cwd: "/workspace",
        timeoutMs: 60_000,
        environment: { CI: "true" },
      }),
    ).resolves.toEqual({
      exitCode: 0,
      stdout: "tests passed",
      stderr: "",
      durationMs: 25,
    });

    expect(sandbox.commands).toEqual([
      {
        command: "pnpm",
        args: ["test"],
        cwd: "/workspace",
        timeoutMs: 60_000,
        environment: { CI: "true" },
      },
    ]);
  });

  it("rejects credentials in command environment before contacting Vercel", async () => {
    const { provider, sandbox } = fixture();
    await create(provider);

    await expect(
      provider.execute({
        sandboxId: sandbox.sandboxId,
        command: "git",
        args: ["fetch"],
        timeoutMs: 60_000,
        environment: { GITHUB_TOKEN: "must-not-enter-sandbox" },
      }),
    ).rejects.toMatchObject({
      code: "SENSITIVE_ENVIRONMENT_DENIED",
    });

    expect(sandbox.commands).toHaveLength(0);
  });

  it("rejects commands beyond the remaining lease", async () => {
    const { provider, sandbox } = fixture();
    await create(provider);

    await expect(
      provider.execute({
        sandboxId: sandbox.sandboxId,
        command: "sleep",
        args: ["600"],
        timeoutMs: 600_000,
      }),
    ).rejects.toMatchObject({
      code: "LIMIT_EXCEEDED",
    });
  });

  it("exposes only ports approved during creation", async () => {
    const { provider, sandbox } = fixture();
    await create(provider);

    await expect(
      provider.expose({ sandboxId: sandbox.sandboxId, port: 8080 }),
    ).resolves.toEqual({
      port: 8080,
      url: "https://8080-sbx-atoryn-1.vercel.run/",
    });

    await expect(
      provider.expose({ sandboxId: sandbox.sandboxId, port: 3000 }),
    ).rejects.toMatchObject({
      code: "EXPOSURE_DENIED",
    });
    expect(sandbox.domains).toEqual([8080]);
  });

  it("stops and permanently destroys a registered sandbox", async () => {
    const { provider, sandbox, registry } = fixture();
    await create(provider);

    await provider.stop({ sandboxId: sandbox.sandboxId, reason: "run completed" });
    expect(sandbox.stopCalls).toBe(1);
    expect(registry.stopped).toEqual([
      {
        sandboxId: sandbox.sandboxId,
        reason: "run completed",
        stoppedAt: NOW.toISOString(),
      },
    ]);

    await provider.destroy({ sandboxId: sandbox.sandboxId });
    expect(sandbox.deleteCalls).toBe(1);
    await expect(registry.get(sandbox.sandboxId)).resolves.toBeNull();
  });

  it("rejects private or malformed network destinations and excessive resources", async () => {
    const { provider } = fixture();

    await expect(
      create(provider, limits({ allowedHosts: ["http://api.github.com/path"] })),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });

    await expect(
      create(provider, limits({ allowedHosts: ["localhost"] })),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });

    await expect(
      create(provider, limits({ memoryMb: 16_384 })),
    ).rejects.toMatchObject({
      code: "LIMIT_EXCEEDED",
    });
  });
});
