import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, parse, resolve } from "node:path";

vi.mock("server-only", () => ({}));

import {
  assertEvolutionProjectRoot,
  resolveEvolutionProjectContext,
  resolveEvolutionProjectRoot,
} from "./evolution-workspace";

const originalEnv = { ...process.env };
const roots: string[] = [];

afterEach(async () => {
  process.env = { ...originalEnv };
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Evolution workspace project-root boundary", () => {
  it("keeps the configured absolute path out of the client-facing label", async () => {
    const root = await mkdtemp(join(tmpdir(), "cyclewarden-workspace-label-"));
    roots.push(root);
    process.env.CYCLEWARDEN_PROJECT_ROOT = root;

    const label = resolveEvolutionProjectRoot();
    expect(label).toBe("server-configured trusted repository");
    expect(label).not.toContain(root);
  });

  it("returns the canonical real path for a configured directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "cyclewarden-workspace-root-"));
    roots.push(root);
    process.env.CYCLEWARDEN_PROJECT_ROOT = root;

    await expect(assertEvolutionProjectRoot()).resolves.toBe(await realpath(root));
  });

  it("rejects a symlink that resolves to the filesystem root", async () => {
    const root = await mkdtemp(join(tmpdir(), "cyclewarden-workspace-link-"));
    roots.push(root);
    const rootLink = join(root, "root-link");
    await symlink(parse(root).root, rootLink, "dir");
    process.env.CYCLEWARDEN_PROJECT_ROOT = rootLink;

    await expect(assertEvolutionProjectRoot()).rejects.toThrow(
      "Configured project root may not target a filesystem root"
    );
  });
});

describe("Evolution workspace multi-project registry", () => {
  it("selects the configured default project and keeps paths server-side", async () => {
    const root = await mkdtemp(join(tmpdir(), "cyclewarden-project-registry-"));
    roots.push(root);
    const firstProject = join(root, "first");
    const secondProject = join(root, "second");
    await Promise.all([mkdir(firstProject), mkdir(secondProject)]);
    const registryPath = join(root, "projects.json");
    await writeFile(
      registryPath,
      JSON.stringify({
        version: 1,
        defaultProjectId: "second",
        projects: [
          {
            id: "first",
            label: "First project",
            projectRoot: firstProject,
            stateRoot: join(root, "state-first"),
          },
          {
            id: "second",
            label: "Second project",
            projectRoot: secondProject,
            stateRoot: join(root, "state-second"),
          },
        ],
      })
    );
    process.env.CYCLEWARDEN_PROJECTS_FILE = registryPath;

    const context = await resolveEvolutionProjectContext();

    expect(context.projects).toEqual([
      { id: "first", label: "First project" },
      { id: "second", label: "Second project" },
    ]);
    expect(context.selected).toEqual({
      id: "second",
      label: "Second project",
      projectRoot: await realpath(secondProject),
      stateRoot: resolve(root, "state-second"),
    });
    expect(JSON.stringify(context.projects)).not.toContain(root);
  });

  it("resolves an explicit project ID only from the server-owned registry", async () => {
    const root = await mkdtemp(join(tmpdir(), "cyclewarden-project-select-"));
    roots.push(root);
    const project = join(root, "project");
    await mkdir(project);
    const registryPath = join(root, "projects.json");
    await writeFile(
      registryPath,
      JSON.stringify({
        version: 1,
        projects: [
          {
            id: "atoenglish",
            label: "AtoEnglish",
            projectRoot: project,
            stateRoot: join(root, "state"),
          },
        ],
      })
    );
    process.env.CYCLEWARDEN_PROJECTS_FILE = registryPath;

    await expect(resolveEvolutionProjectContext("atoenglish")).resolves.toMatchObject({
      selected: { id: "atoenglish", label: "AtoEnglish" },
    });
    await expect(resolveEvolutionProjectContext("unknown")).rejects.toThrow(
      "Requested project is not present in the server-configured registry"
    );
    await expect(resolveEvolutionProjectContext("../../escape")).rejects.toThrow(
      "Invalid configured project ID"
    );
  });

  it("rejects duplicate project IDs before any repository action", async () => {
    const root = await mkdtemp(join(tmpdir(), "cyclewarden-project-duplicates-"));
    roots.push(root);
    const project = join(root, "project");
    await mkdir(project);
    const registryPath = join(root, "projects.json");
    await writeFile(
      registryPath,
      JSON.stringify({
        version: 1,
        projects: [
          { id: "same", label: "One", projectRoot: project, stateRoot: join(root, "state-one") },
          { id: "same", label: "Two", projectRoot: project, stateRoot: join(root, "state-two") },
        ],
      })
    );
    process.env.CYCLEWARDEN_PROJECTS_FILE = registryPath;

    await expect(resolveEvolutionProjectContext()).rejects.toThrow(
      "project IDs must be unique"
    );
  });
});
