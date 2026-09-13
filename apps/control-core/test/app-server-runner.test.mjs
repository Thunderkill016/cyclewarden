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
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error("Timed out waiting for app-server runner state.");
}

test("app-server runner pauses for approval and resumes the same turn to READY_TO_SHIP", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "cyclewarden-app-runner-"));
  const repoDir = path.join(root, "repo");
  const dataDir = path.join(root, "data");
  const fakeCodex = path.join(root, "fake-codex-app-server.mjs");
  const previousMode = process.env.CYCLEWARDEN_CODEX_MODE;
  const previousBin = process.env.CYCLEWARDEN_CODEX_BIN;
  const previousArgs = process.env.CYCLEWARDEN_CODEX_APP_SERVER_ARGS;

  try {
    await execFileAsync("git", ["init", repoDir]);
    await git(repoDir, ["config", "user.email", "ci@example.test"]);
    await git(repoDir, ["config", "user.name", "CycleWarden Test"]);
    await writeFile(
      path.join(repoDir, "package.json"),
      JSON.stringify({ name: "fixture", private: true, scripts: { test: "node -e \"process.exit(0)\"" } }, null, 2),
    );
    await writeFile(path.join(repoDir, "AGENTS.md"), "# Fixture\nKeep changes bounded.\n");
    await git(repoDir, ["add", "."]);
    await git(repoDir, ["commit", "-m", "fixture base"]);

    await writeFile(
      fakeCodex,
      `#!/usr/bin/env node\n` +
        `import readline from "node:readline";\n` +
        `import { writeFile } from "node:fs/promises";\n` +
        `import { execFile } from "node:child_process";\n` +
        `import { promisify } from "node:util";\n` +
        `const exec = promisify(execFile);\n` +
        `const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });\n` +
        `for await (const line of rl) {\n` +
        `  if (!line.trim()) continue;\n` +
        `  const msg = JSON.parse(line);\n` +
        `  if (msg.method === "initialize") { console.log(JSON.stringify({ id: msg.id, result: {} })); continue; }\n` +
        `  if (msg.method === "initialized") continue;\n` +
        `  if (msg.method === "thread/start") {\n` +
        `    console.log(JSON.stringify({ id: msg.id, result: { thread: { id: "thread_fixture" } } }));\n` +
        `    continue;\n` +
        `  }\n` +
        `  if (msg.method === "turn/start") {\n` +
        `    console.log(JSON.stringify({ id: msg.id, result: { turn: { id: "turn_fixture" } } }));\n` +
        `    console.log(JSON.stringify({\n` +
        `      id: "approval_fixture",\n` +
        `      method: "item/commandExecution/requestApproval",\n` +
        `      params: { threadId: "thread_fixture", turnId: "turn_fixture", itemId: "cmd_fixture", startedAtMs: Date.now(), command: "node approved-step", reason: "fixture needs permission" }\n` +
        `    }));\n` +
        `    continue;\n` +
        `  }\n` +
        `  if (msg.id === "approval_fixture" && msg.result?.decision === "accept") {\n` +
        `    await writeFile("approved.txt", "approved\\n");\n` +
        `    await exec("git", ["add", "approved.txt"]);\n` +
        `    await exec("git", ["commit", "-m", "feat: complete approved fixture"]);\n` +
        `    const item = { type: "agentMessage", id: "message_fixture", text: "Approved work completed and committed.", phase: null, memoryCitation: null, delivery: null, questions: null };\n` +
        `    console.log(JSON.stringify({ method: "item/completed", params: { threadId: "thread_fixture", turnId: "turn_fixture", item } }));\n` +
        `    console.log(JSON.stringify({ method: "turn/completed", params: { threadId: "thread_fixture", turn: { id: "turn_fixture", items: [item], itemsView: "full", status: "completed", error: null, startedAt: null, completedAt: null, durationMs: 1 } } }));\n` +
        `    continue;\n` +
        `  }\n` +
        `}\n`,
      "utf8",
    );
    await chmod(fakeCodex, 0o755);

    process.env.CYCLEWARDEN_CODEX_MODE = "app-server";
    process.env.CYCLEWARDEN_CODEX_BIN = fakeCodex;
    process.env.CYCLEWARDEN_CODEX_APP_SERVER_ARGS = "app-server --stdio";

    const store = await new ControlStore({ dataDir }).init();
    const project = await store.registerProject(await inspectRepository(repoDir));
    const { stdout: baseHead } = await git(repoDir, ["rev-parse", "HEAD"]);
    const task = await store.addTask(
      createTaskRecord({
        projectId: project.id,
        title: "Implement approved fixture",
        objective: "Create approved.txt only after the approval is granted and commit it.",
        acceptanceCriteria: ["repository test passes"],
        baseHead,
      }),
    );

    const runner = new AgentRunner({ store });
    await runner.start(task.id);

    const blocked = await waitFor(() => {
      const current = store.getTask(task.id);
      return current.status === "NEEDS_INPUT" ? current : null;
    });
    assert.equal(blocked.externalThreadId, "thread_fixture");
    assert.equal(blocked.pendingDecision.requestId, "approval_fixture");
    assert.equal(blocked.pendingDecision.kind, "command");
    assert.equal(blocked.pendingDecision.command, "node approved-step");
    assert.equal(blocked.pendingDecision.reason, "fixture needs permission");

    await runner.decide(task.id, "accept");

    const finished = await waitFor(() => {
      const current = store.getTask(task.id);
      return ["READY_TO_SHIP", "FAILED"].includes(current.status) ? current : null;
    });
    assert.equal(finished.status, "READY_TO_SHIP", finished.failure?.message);
    assert.equal(finished.pendingDecision, null);
    assert.equal(finished.lastMessage, "Approved work completed and committed.");
    assert.equal(finished.verification.length, 1);
    assert.equal(finished.verification[0].ok, true);
    assert.equal(finished.evidence.clean, true);
    assert.deepEqual(finished.evidence.changedFiles, ["approved.txt"]);
    assert.notEqual(finished.exactHead, baseHead);

    const events = store.snapshot().events.filter((event) => event.taskId === task.id);
    assert.ok(events.some((event) => event.type === "agent.approval_requested"));
    assert.ok(events.some((event) => event.type === "agent.approval_decided" && event.payload.decision === "accept"));
    assert.ok(events.some((event) => event.type === "agent.turn_completed"));
  } finally {
    if (previousMode === undefined) delete process.env.CYCLEWARDEN_CODEX_MODE;
    else process.env.CYCLEWARDEN_CODEX_MODE = previousMode;
    if (previousBin === undefined) delete process.env.CYCLEWARDEN_CODEX_BIN;
    else process.env.CYCLEWARDEN_CODEX_BIN = previousBin;
    if (previousArgs === undefined) delete process.env.CYCLEWARDEN_CODEX_APP_SERVER_ARGS;
    else process.env.CYCLEWARDEN_CODEX_APP_SERVER_ARGS = previousArgs;
    await rm(root, { recursive: true, force: true });
  }
});
