import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { git, inspectRepository } from "../src/git.mjs";

const execFileAsync = promisify(execFile);

test("inspectRepository imports safe agent-contract checks without enabling shell commands", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "cyclewarden-contract-"));
  const repoDir = path.join(root, "repo");
  try {
    await execFileAsync("git", ["init", repoDir]);
    await git(repoDir, ["config", "user.email", "ci@example.test"]);
    await git(repoDir, ["config", "user.name", "CycleWarden Test"]);
    await writeFile(path.join(repoDir, "AGENTS.md"), "# Instructions\n");
    await writeFile(
      path.join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture",
        private: true,
        scripts: {
          "check:knowledge": "node -e \"process.exit(0)\"",
          test: "node -e \"process.exit(0)\"",
        },
      }, null, 2),
    );
    await writeFile(
      path.join(repoDir, "agent-contract.json"),
      JSON.stringify({
        schemaVersion: 1,
        canonicalInstructionFile: "AGENTS.md",
        contextRouter: "docs/context/README.md",
        minimumNodeMajor: 24,
        alwaysChecks: ["npm run check:knowledge", "rm -rf /"],
      }, null, 2),
    );
    await git(repoDir, ["add", "."]);
    await git(repoDir, ["commit", "-m", "fixture base"]);

    const project = await inspectRepository(repoDir);
    assert.equal(project.contract.schemaVersion, 1);
    assert.equal(project.contract.canonicalInstructionFile, "AGENTS.md");
    assert.equal(project.contract.minimumNodeMajor, 24);
    assert.deepEqual(
      project.verification.map((check) => [check.name, check.command, check.args]),
      [
        ["contract:check:knowledge", "npm", ["run", "check:knowledge"]],
        ["test", "npm", ["run", "test"]],
      ],
    );
    assert.equal(project.contractWarnings.length, 1);
    assert.match(project.contractWarnings[0], /Unsupported agent-contract alwaysCheck/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
