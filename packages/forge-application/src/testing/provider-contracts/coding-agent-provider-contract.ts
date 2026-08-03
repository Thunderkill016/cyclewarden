import { describe, expect, it } from "vitest";

import type { CodingAgentProvider } from "@cyclewarden/forge-domain";

export function defineCodingAgentProviderContract(
  name: string,
  createProvider: () => CodingAgentProvider,
): void {
  describe(`${name} coding agent provider contract`, () => {
    it("starts, streams events, accepts instruction, resolves approval, and cancels", async () => {
      const provider = createProvider();
      const started = await provider.start({
        runId: "run",
        sandboxId: "sandbox",
        objective: "Change code",
        acceptanceCriteria: ["Tests pass"],
        constraints: [],
        technicalOutputLanguage: "en",
      });
      const events = [];
      for await (const item of provider.events({ externalRunId: started.externalRunId })) {
        events.push(item);
      }
      expect(events.length).toBeGreaterThan(0);
      await provider.addInstruction({
        externalRunId: started.externalRunId,
        instruction: "Continue",
      });
      await provider.resolveApproval({
        externalRunId: started.externalRunId,
        requestKey: "request-1",
        decision: "approved",
      });
      await provider.cancel({ externalRunId: started.externalRunId, reason: "done" });
    });
  });
}
