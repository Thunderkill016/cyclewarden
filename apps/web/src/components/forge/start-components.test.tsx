import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ForgeRepositoryOption } from "@/lib/forge/repositories";
import { RepositorySelector } from "./repository-selector";
import { RunReview } from "./run-review";
import { TaskComposer } from "./task-composer";

const repositories: ForgeRepositoryOption[] = [
  {
    id: "active",
    provider: "fake-source",
    namespace: "fixture",
    name: "app",
    defaultBranch: "main",
    status: "active",
    supported: true,
    description: "Supported fixture",
  },
  {
    id: "archived",
    provider: "fake-source",
    namespace: "fixture",
    name: "old-app",
    defaultBranch: "main",
    status: "archived",
    supported: false,
    description: "Archived fixture",
  },
];

describe("Forge start components", () => {
  it("renders selectable supported repositories and disables unsupported ones", () => {
    const html = renderToStaticMarkup(
      <RepositorySelector repositories={repositories} defaultRepositoryId="active" />,
    );
    expect(html).toContain('name="repositoryId"');
    expect(html).toContain('value="active"');
    expect(html).toContain("checked");
    expect(html).toContain('value="archived"');
    expect(html).toContain("disabled");
  });

  it("renders separate instruction and technical output language controls", () => {
    const html = renderToStaticMarkup(<TaskComposer />);
    expect(html).toContain('name="instructionLanguage"');
    expect(html).toContain('name="technicalOutputLanguage"');
    expect(html).toContain('name="instruction"');
  });

  it("renders reviewed branch, agent, budget and permission policy", () => {
    const html = renderToStaticMarkup(<RunReview baseBranch="main" />);
    expect(html).toContain('name="baseBranch"');
    expect(html).toContain('name="agentProvider"');
    expect(html).toContain('name="budgetUsd"');
    expect(html).toContain('name="networkPolicy"');
    expect(html).toContain("Sensitive actions remain blocked");
  });
});
