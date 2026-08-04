import { describe, expect, it } from "vitest";

import type { SandboxProvider } from "@cyclewarden/forge-domain";

export function defineSandboxProviderContract(
  name: string,
  createProvider: () => SandboxProvider,
): void {
  describe(`${name} sandbox provider contract`, () => {
    it("creates, executes, stops, and destroys a sandbox", async () => {
      const provider = createProvider();
      const sandbox = await provider.create({
        runId: "run",
        repositoryUrl: "https://example.test/repo.git",
        repositoryCredentialHandle: "secret-handle",
        baseBranch: "main",
        limits: {
          timeoutMs: 1000,
          cpuMillis: 1000,
          memoryMb: 512,
          storageMb: 1024,
          allowedHosts: [],
        },
      });
      const result = await provider.execute({
        sandboxId: sandbox.sandboxId,
        command: "pnpm",
        args: ["test"],
        timeoutMs: 1000,
      });
      expect(result.exitCode).toBe(0);
      await provider.stop({ sandboxId: sandbox.sandboxId, reason: "contract" });
      await provider.destroy({ sandboxId: sandbox.sandboxId });
    });
  });
}
