import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { initialForgeLanguageState } from "@/lib/forge/language-state";
import type { ForgeRepositoryOption } from "@/lib/forge/repositories";
import type {
  ForgeApprovalView,
  ForgeRunEventView,
} from "@/lib/forge/run-control-service";
import { MobileRunCommandCenter } from "./mobile-run-command-center";
import { RepositorySelector } from "./repository-selector";
import { RunActivityFeed } from "./run-activity-feed";
import { TaskComposer } from "./task-composer";

const repository: ForgeRepositoryOption = {
  id: "repo-1",
  provider: "github",
  namespace: "a-very-long-namespace-that-must-wrap",
  name: "a-very-long-repository-name-that-must-not-overflow",
  defaultBranch: "main",
  status: "active",
  supported: true,
  description: "A long repository description used to verify narrow viewport wrapping.",
};

const approval: ForgeApprovalView = {
  id: "approval-1",
  runId: "run-1",
  actionType: "network_access",
  riskLevel: "high",
  summary: "Allow a deliberately long package registry hostname without overflowing.",
  status: "pending",
  requestedAt: "2026-08-05T04:00:00.000Z",
  resolvedAt: null,
  resolvedByUserId: null,
  resolutionReason: null,
  version: 1,
};

const event: ForgeRunEventView = {
  runId: "run-1",
  sequence: 1,
  type: "provider.event.with.an.intentionally.long.identifier",
  payload: {
    summary: "A long event detail that must wrap inside the activity card on mobile.",
  },
  createdAt: "2026-08-05T04:00:00.000Z",
};

describe("Forge responsive hardening", () => {
  it("keeps repository and language controls wrap-safe with mobile-sized targets", () => {
    const repositoryHtml = renderToStaticMarkup(
      createElement(RepositorySelector, {
        repositories: [repository],
        defaultRepositoryId: repository.id,
        locale: "en",
      }),
    );
    const taskHtml = renderToStaticMarkup(
      createElement(TaskComposer, {
        languages: initialForgeLanguageState,
        onLanguagesChange: () => undefined,
      }),
    );

    expect(repositoryHtml).toContain("overflow-hidden");
    expect(repositoryHtml).toContain("break-all");
    expect(repositoryHtml).toContain("h-5 w-5");
    expect(taskHtml).toContain("min-h-11");
    expect(taskHtml).toContain("text-base");
  });

  it("keeps run activity and command controls constrained on narrow screens", () => {
    const activityHtml = renderToStaticMarkup(
      createElement(RunActivityFeed, { events: [event] }),
    );
    const commandHtml = renderToStaticMarkup(
      createElement(MobileRunCommandCenter, {
        state: "running",
        approvals: [approval],
        pendingAction: null,
        onInstruction: async () => undefined,
        onCancel: async () => undefined,
        onApproval: async () => undefined,
      }),
    );

    expect(activityHtml).toContain("grid-cols-[auto_minmax(0,1fr)]");
    expect(activityHtml).toContain("break-all");
    expect(commandHtml).toContain("overflow-hidden");
    expect(commandHtml.match(/min-h-11/g)?.length).toBeGreaterThanOrEqual(4);
    expect(commandHtml).toContain("min-[360px]:grid-cols-2");
  });
});
