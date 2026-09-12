import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const serverPath = fileURLToPath(new URL("../src/server.mjs", import.meta.url));

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function waitFor(fn, timeoutMs = 20_000, intervalMs = 75) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw lastError || new Error("Timed out waiting for process-level Control Core condition.");
}

function startCore({ port, dataDir, fakeCodex, firstStarted, firstExited }) {
  const child = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      CYCLEWARDEN_CONTROL_PORT: String(port),
      CYCLEWARDEN_CONTROL_DATA_DIR: dataDir,
      CYCLEWARDEN_CODEX_BIN: fakeCodex,
      CYCLEWARDEN_ATORYN_URL: "",
      CYCLEWARDEN_ATORYN_TOKEN: "",
      CYCLEWARDEN_TEST_FIRST_STARTED: firstStarted,
      CYCLEWARDEN_TEST_FIRST_EXITED: firstExited,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const capture = (chunk) => {
    output += chunk.toString();
    if (output.length > 24_000) output = output.slice(-24_000);
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);
  return { child, output: () => output };
}

async function stopCore(record, signal = "SIGTERM") {
  if (!record?.child || record.child.exitCode !== null || record.child.signalCode) return;
  record.child.kill(signal);
  await Promise.race([
    new Promise((resolve) => record.child.once("close", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3_000)),
  ]);
  if (record.child.exitCode === null && !record.child.signalCode) record.child.kill("SIGKILL");
}

async function request(port, pathname, init = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    ...init,
    headers: init.body ? { "content-type": "application/json", ...(init.headers || {}) } : init.headers,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${pathname} HTTP ${response.status}: ${body.message || body.error || "failed"}`);
  return body;
}

async function initFixtureRepo(repoDir) {
  await execFileAsync("git", ["init", repoDir]);
  await execFileAsync("git", ["-C", repoDir, "config", "user.email", "ci@example.test"]);
  await execFileAsync("git", ["-C", repoDir, "config", "user.name", "CycleWarden Process Test"]);
  await writeFile(
    path.join(repoDir, "package.json"),
    JSON.stringify({
      name: "restart-resume-fixture",
      private: true,
      scripts: { test: "node -e \"process.exit(0)\"" },
    }, null, 2),
  );
  await writeFile(path.join(repoDir, "AGENTS.md"), "# Fixture\nKeep changes bounded.\n");
  await execFileAsync("git", ["-C", repoDir, "add", "."]);
  await execFileAsync("git", ["-C", repoDir, "commit", "-m", "fixture base"]);
}

test("real Control Core process restart surfaces INTERRUPTED and explicitly resumes the same worktree", { timeout: 40_000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "cyclewarden-restart-resume-"));
  const repoDir = path.join(root, "repo");
  const dataDir = path.join(root, "control-data");
  const fakeCodex = path.join(root, "fake-codex.mjs");
  const firstStarted = path.join(root, "first-started");
  const firstExited = path.join(root, "first-exited");
  const port = await freePort();
  let firstCore = null;
  let secondCore = null;

  try {
    await initFixtureRepo(repoDir);
    await writeFile(
      fakeCodex,
      `#!/usr/bin/env node\n` +
        `import { access, writeFile } from "node:fs/promises";\n` +
        `import { execFile } from "node:child_process";\n` +
        `import { promisify } from "node:util";\n` +
        `const exec = promisify(execFile);\n` +
        `const started = process.env.CYCLEWARDEN_TEST_FIRST_STARTED;\n` +
        `const exited = process.env.CYCLEWARDEN_TEST_FIRST_EXITED;\n` +
        `let resumed = true;\n` +
        `try { await access(started); } catch { resumed = false; }\n` +
        `if (!resumed) {\n` +
        `  await writeFile(started, String(process.pid));\n` +
        `  console.log(JSON.stringify({type:"thread.started",thread_id:"thread_before_restart"}));\n` +
        `  const parent = process.ppid;\n` +
        `  const timer = setInterval(async () => {\n` +
        `    try { process.kill(parent, 0); } catch {\n` +
        `      clearInterval(timer);\n` +
        `      await writeFile(exited, "parent-gone");\n` +
        `      process.exit(0);\n` +
        `    }\n` +
        `  }, 40);\n` +
        `} else {\n` +
        `  console.log(JSON.stringify({type:"thread.started",thread_id:"thread_after_restart"}));\n` +
        `  await writeFile("result.txt", "resumed safely\\n");\n` +
        `  await exec("git", ["add", "result.txt"]);\n` +
        `  await exec("git", ["commit", "-m", "feat: finish resumed task"]);\n` +
        `  console.log(JSON.stringify({type:"item.completed",item:{type:"agent_message",text:"Resumed and committed."}}));\n` +
        `}\n`,
    );
    await chmod(fakeCodex, 0o755);

    firstCore = startCore({ port, dataDir, fakeCodex, firstStarted, firstExited });
    await waitFor(() => request(port, "/health").then((value) => value.ok));

    const registered = await request(port, "/projects", {
      method: "POST",
      body: JSON.stringify({ path: repoDir }),
    });
    const created = await request(port, "/tasks", {
      method: "POST",
      body: JSON.stringify({
        projectId: registered.project.id,
        title: "Resume after restart",
        objective: "Finish result.txt after the local core is restarted.",
        acceptanceCriteria: ["result.txt is committed", "repository test passes"],
      }),
    });
    const taskId = created.task.id;

    await request(port, `/tasks/${encodeURIComponent(taskId)}/start`, { method: "POST", body: "{}" });
    await waitFor(async () => {
      try { return Boolean(await readFile(firstStarted, "utf8")); } catch { return false; }
    });
    const beforeRestart = await waitFor(async () => {
      const snapshot = await request(port, "/snapshot");
      return snapshot.inFlight.find((item) => item.id === taskId) || null;
    });
    assert.equal(beforeRestart.status, "RUNNING");
    assert.ok(beforeRestart.worktreePath);
    const originalWorktree = beforeRestart.worktreePath;
    const originalBranch = beforeRestart.branch;

    firstCore.child.kill("SIGKILL");
    await new Promise((resolve) => firstCore.child.once("close", resolve));
    await waitFor(async () => {
      try { return Boolean(await readFile(firstExited, "utf8")); } catch { return false; }
    });

    secondCore = startCore({ port, dataDir, fakeCodex, firstStarted, firstExited });
    await waitFor(() => request(port, "/health").then((value) => value.ok));
    const interrupted = await waitFor(async () => {
      const snapshot = await request(port, "/snapshot");
      return snapshot.needsYou.find((item) => item.id === taskId && item.status === "INTERRUPTED") || null;
    });
    assert.equal(interrupted.failure.code, "CORE_RESTARTED");
    assert.equal(interrupted.recovery.canResume, true);
    assert.equal(interrupted.recovery.reason, "WORKTREE_CLEAN");
    assert.equal(interrupted.worktreePath, originalWorktree);
    assert.equal(interrupted.branch, originalBranch);

    await request(port, `/tasks/${encodeURIComponent(taskId)}/start`, { method: "POST", body: "{}" });
    const ready = await waitFor(async () => {
      const snapshot = await request(port, "/snapshot");
      return snapshot.readyToShip.find((item) => item.id === taskId) || null;
    });
    assert.equal(ready.status, "READY_TO_SHIP");
    assert.equal(ready.worktreePath, originalWorktree);
    assert.equal(ready.branch, originalBranch);
    assert.equal(ready.lastMessage, "Resumed and committed.");
    assert.equal(ready.recovery, null);
    assert.equal(ready.evidence.clean, true);
    assert.deepEqual(ready.evidence.changedFiles, ["result.txt"]);
    assert.equal(ready.verification.length, 1);
    assert.equal(ready.verification[0].ok, true);
  } catch (error) {
    const logs = [firstCore?.output(), secondCore?.output()].filter(Boolean).join("\n--- restart ---\n");
    error.message += `\nControl Core logs:\n${logs}`;
    throw error;
  } finally {
    await stopCore(firstCore);
    await stopCore(secondCore);
    await rm(root, { recursive: true, force: true });
  }
});
