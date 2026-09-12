import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createTaskRecord } from "../src/domain.mjs";
import { inspectRepository, git } from "../src/git.mjs";
import { AgentRunner } from "../src/runner.mjs";
import { ControlStore } from "../src/store.mjs";

const execFileAsync = promisify(execFile);

async function waitFor(predicate, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Timed out waiting for control-core state transition.");
}

test("runner creates an isolated worktree and reaches READY_TO_SHIP after exact-head verification", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "cyclewarden-runner-"));
  const repoDir = path.join(root, "repo");
  const dataDir = path.join(root, "data");
  const fakeCodex = path.join(root, "fake-codex.mjs");
  const previousCodexBin = process.env.CYCLEWARDEN_CODEX_BIN;

  try {
    await execFileAsync("git", ["init", repoDir]);
    await git(repoDir, ["config", "user.email", "ci@example.test"]);
    await git(repoDir, ["config", "user.name", "CycleWarden Test"]);
    await writeFile(
      path.join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture",
        private: true,
        scripts: { test: "node -e \"process.exit(0)\"" },
      }, null, 2),
    );
    await writeFile(path.join(repoDir, "AGENTS.md"), "# Fixture\nKeep changes bounded.\n");
    await git(repoDir, ["add", "."]);
    await git(repoDir, ["commit", "-m", "fixture base"]);

    await writeFile(
      fakeCodex,
      `#!/usr/bin/env node\n` +
        `import { writeFile } from "node:fs/promises";\n` +
        `import { execFile } from "node:child_process";\n` +
        `import { promisify } from "node:util";\n` +
        `const exec = promisify(execFile);\n` +
        `console.log(JSON.stringify({type:"thread.started",thread_id:"thread_fixture"}));\n` +
        `console.log(JSON.stringify({type:"turn.started"}));\n` +
        `await writeFile("result.txt", "implemented\\n");\n` +
        `await exec("git", ["add", "result.txt"]);\n` +
        `await exec("git", ["commit", "-m", "feat: implement fixture task"]);\n` +
        `console.log(JSON.stringify({type:"item.completed",item:{type:"agent_message",text:"Implemented and committed."}}));\n` +
        `console.log(JSON.stringify({type:"turn.completed",usage:{input_tokens:1,cached_input_tokens:0,output_tokens:1,reasoning_output_tokens:0}}));\n`,
    );
    await chmod(fakeCodex, 0o755);
    process.env.CYCLEWARDEN_CODEX_BIN = fakeCodex;

    const store = await new ControlStore({ dataDir }).init();
    const project = await store.registerProject(await inspectRepository(repoDir));
    const { stdout: baseHead } = await git(repoDir, ["rev-parse", "HEAD"]);
    const task = await store.addTask(
      createTaskRecord({
        projectId: project.id,
        title: "Implement fixture",
        objective: "Create result.txt and commit it.",
        acceptanceCriteria: ["repository test passes"],
        baseHead,
      }),
    );

    const runner = new AgentRunner({ store });
    await runner.start(task.id);

    const finished = await waitFor(() => {
      const current = store.getTask(task.id);
      return ["READY_TO_SHIP", "FAILED"].includes(current.status) ? current : null;
    });

    assert.equal(finished.status, "READY_TO_SHIP", finished.failure?.message);
    assert.equal(finished.externalThreadId, "thread_fixture");
    assert.equal(finished.lastMessage, "Implemented and committed.");
    assert.equal(finished.verification.length, 1);
    assert.equal(finished.verification[0].name, "test");
    assert.equal(finished.verification[0].ok, true);
    assert.equal(finished.evidence.clean, true);
    assert.deepEqual(finished.evidence.changedFiles, ["result.txt"]);
    assert.notEqual(finished.exactHead, baseHead);
    assert.ok(finished.worktreePath.startsWith(dataDir));
  } finally {
    if (previousCodexBin === undefined) delete process.env.CYCLEWARDEN_CODEX_BIN;
    else process.env.CYCLEWARDEN_CODEX_BIN = previousCodexBin;
    await rm(root, { recursive: true, force: true });
  }
});
