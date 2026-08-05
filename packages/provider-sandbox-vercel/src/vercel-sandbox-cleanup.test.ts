import { describe, expect, it } from "vitest";

import type { SandboxLimits } from "@cyclewarden/forge-domain";

import {
  VercelSandboxProvider,
  type VercelSandboxClient,
  type VercelSandboxRecord,
  type VercelSandboxRegistry,
} from "./vercel-sandbox-provider.js";

const NOW = new Date("2026-08-05T03:30:00.000Z");
const TERMINAL_REASONS = [
  "run completed",
  "run failed",
  "run expired",
  "run cancelled",
] as const;

class CleanupSandbox implements VercelSandboxClient {
  readonly sandboxId = "sbx_cleanup_matrix";
  readonly expiresAt = new Date(NOW.getTime() + 300_000).toISOString();
  stopCalls = 0;
  deleteCalls = 0;

  async runCommand() {
    return {
      exitCode: 0,
      stdout: "",
      stderr: "",
      startedAt: NOW.toISOString(),
      finishedAt: NOW.toISOString(),
    };
  }

  domain(port: number): string {
    return `https://${port}-${this.sandboxId}.vercel.run/`;
  }

  async stop(): Promise<void> {
    this.stopCalls += 1;
  }

  async delete(): Promise<void> {
    this.deleteCalls += 1;
  }
}

class CleanupRegistry implements VercelSandboxRegistry {
  readonly records = new Map<string, VercelSandboxRecord>();
  readonly stopReasons: string[] = [];

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
    this.stopReasons.push(input.reason);
    const record = this.records.get(input.sandboxId);
    if (record) this.records.set(input.sandboxId, { ...record, status: "stopped" });
  }

  async remove(sandboxId: string): Promise<void> {
    this.records.delete(sandboxId);
  }
}

const limits: SandboxLimits = {
  timeoutMs: 300_000,
  cpuMillis: 1_000,
  memoryMb: 1_024,
  storageMb: 2_048,
  allowedHosts: [],
  exposedPorts: [],
};

function fixture() {
  const sandbox = new CleanupSandbox();
  const registry = new CleanupRegistry();
  const provider = new VercelSandboxProvider({
    clients: {
      create: async () => sandbox,
      get: async () => sandbox,
    },
    repositories: {
      bootstrap: async () => undefined,
    },
    registry,
    now: () => NOW,
  });
  return { provider, registry, sandbox };
}

async function create(provider: VercelSandboxProvider) {
  return provider.create({
    runId: "11111111-1111-4111-8111-111111111111",
    repositoryUrl: "https://github.com/atoryn/cleanup-fixture.git",
    repositoryCredentialHandle: "credential-handle",
    baseBranch: "main",
    limits,
  });
}

describe("Vercel sandbox terminal cleanup", () => {
  it.each(TERMINAL_REASONS)(
    "stops and destroys an ephemeral sandbox when the %s path terminates",
    async (reason) => {
      const { provider, registry, sandbox } = fixture();
      await create(provider);

      await provider.stop({ sandboxId: sandbox.sandboxId, reason });
      await provider.destroy({ sandboxId: sandbox.sandboxId });

      expect(sandbox.stopCalls).toBe(1);
      expect(sandbox.deleteCalls).toBe(1);
      expect(registry.stopReasons).toEqual([reason]);
      await expect(registry.get(sandbox.sandboxId)).resolves.toBeNull();
    },
  );
});
