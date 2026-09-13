import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  createTaskWorktree,
  git,
  inspectInterruptedWorktree,
  inspectRepository,
} from "../src/git.mjs";

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

test("interrupted task can reattach an existing branch after its worktree was removed", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "cyclewarden-recovery-"));
  const repoDir = path.join(root, "repo");
  const dataDir = path.join(root, "control-data");
  try {
    await execFileAsync("git", ["init", repoDir]);
    await git(repoDir, ["config", "user.email", "ci@example.test"]);
    await git(repoDir, ["config", "user.name", "CycleWarden Test"]);
    await writeFile(path.join(repoDir, "README.md"), "fixture\n");
    await git(repoDir, ["add", "."]);
    await git(repoDir, ["commit", "-m", "fixture base"]);

    const project = await inspectRepository(repoDir);
    const task = {
      id: "task_12345678abcdef",
      title: "Resume interrupted work",
      baseHead: project.registeredHead,
      branch: null,
      worktreePath: null,
    };

    const created = await createTaskWorktree({ project, task, dataDir });
    task.branch = created.branch;
    task.worktreePath = created.worktreePath;
    await git(repoDir, ["worktree", "remove", created.worktreePath]);

    const recovery = await inspectInterruptedWorktree({ project, task, dataDir });
    assert.equal(recovery.canResume, true);
    assert.equal(recovery.worktreeExists, false);
    assert.equal(recovery.branchExists, true);
    assert.equal(recovery.reason, "WORKTREE_MISSING_BRANCH_RECOVERABLE");

    const reattached = await createTaskWorktree({ project, task, dataDir });
    assert.equal(reattached.branch, created.branch);
    assert.equal(reattached.reused, true);
    assert.equal(reattached.exactHead, project.registeredHead);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
