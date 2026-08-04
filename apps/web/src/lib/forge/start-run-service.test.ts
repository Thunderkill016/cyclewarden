import { beforeEach, describe, expect, it } from "vitest";

import type { ForgeActor } from "./actor";
import {
  ForgeStartRunError,
  resetForgeDemoStateForTests,
  startGovernedForgeRun,
} from "./start-run-service";
import type { ForgeStartRunInput } from "./start-run-input";

const actor: ForgeActor = {
  id: "demo-test-user",
  email: "test@example.com",
  displayName: "Test developer",
  demo: true,
};

const request: ForgeStartRunInput = {
  repositoryId: "fixture-nextjs",
  instruction: "Add a governed account settings page",
  instructionLanguage: "en",
  technicalOutputLanguage: "en",
  baseBranch: "main",
  agentProvider: "codex",
  budgetUsd: 2,
  networkPolicy: "deny-by-default",
  idempotencyKey: "11111111-1111-4111-8111-111111111111",
};

describe("Forge start run service", () => {
  beforeEach(() => resetForgeDemoStateForTests());

  it("replays a duplicate request without creating another run", async () => {
    const first = await startGovernedForgeRun({ actor, request, forceMemory: true });
    const duplicate = await startGovernedForgeRun({ actor, request, forceMemory: true });
    expect(duplicate).toEqual(first);
  });

  it("rejects a second active run without provider or persistence side effects", async () => {
    await startGovernedForgeRun({ actor, request, forceMemory: true });
    await expect(
      startGovernedForgeRun({
        actor,
        forceMemory: true,
        request: {
          ...request,
          idempotencyKey: "22222222-2222-4222-8222-222222222222",
        },
      }),
    ).rejects.toMatchObject({ code: "ACTIVE_RUN_EXISTS" });
  });

  it("returns a stable revoked connection error", async () => {
    await expect(
      startGovernedForgeRun({
        actor,
        forceMemory: true,
        request: { ...request, repositoryId: "fixture-revoked" },
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ForgeStartRunError>>({
        code: "CONNECTION_REVOKED",
      }),
    );
  });
});
