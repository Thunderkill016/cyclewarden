import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const execFileAsync = promisify(execFile);
const CONFIRMATION = process.env.CYCLEWARDEN_LIVE_APPROVAL_DOGFOOD_CONFIRM;
const REQUIRED_CONFIRMATION = "RUN:LIVE-ATORYN-APPROVAL";
const CORE_URL = process.env.CYCLEWARDEN_CONTROL_URL || "http://127.0.0.1:4318";
const POLL_MS = positiveInteger(process.env.CYCLEWARDEN_LIVE_DOGFOOD_POLL_MS, 1_500);
const APPROVAL_WAIT_MS = positiveInteger(process.env.CYCLEWARDEN_LIVE_DOGFOOD_APPROVAL_WAIT_MS, 3 * 60_000);
const COMPLETION_WAIT_MS = positiveInteger(process.env.CYCLEWARDEN_LIVE_DOGFOOD_COMPLETION_WAIT_MS, 10 * 60_000);
const MARKER_CONTENT = "cyclewarden-live-atoryn-approval-v1\n";
const TERMINAL = new Set(["READY_TO_SHIP", "FAILED", "INTERRUPTED", "CLOSED"]);

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function required(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeUrl(value) {
  const url = new URL(value);
  required(url.protocol === "http:", "Live dogfood core URL must use loopback HTTP.");
  required(["127.0.0.1", "localhost", "::1"].includes(url.hostname), "Live dogfood only talks to a loopback Control Core.");
  return url.toString().replace(/\/$/, "");
}

async function requestJson(baseUrl, pathname, { method = "GET", body = null, timeoutMs = 12_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  try {
    const response = await fetch(`${baseUrl}${pathname}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`${method} ${pathname} failed (${response.status}): ${payload?.message || payload?.error || "unknown error"}`);
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

async function workerCapabilities(baseUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  timer.unref?.();
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/check`, { signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    required(response.ok, `AtoRyn /check failed with HTTP ${response.status}.`);
    return payload?.control_bridge ?? null;
  } finally {
    clearTimeout(timer);
  }
}

function allTasks(snapshot) {
  return [
    ...(snapshot?.needsYou || []),
    ...(snapshot?.readyToShip || []),
    ...(snapshot?.inFlight || []),
    ...(snapshot?.backlog || []),
  ];
}

function findTask(snapshot, taskId) {
  return allTasks(snapshot).find((task) => task.id === taskId) ?? null;
}

function taskEvents(snapshot, taskId) {
  return (snapshot?.recentEvents || []).filter((event) => event?.taskId === taskId);
}

async function waitForTask(baseUrl, taskId, predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    const snapshot = await requestJson(baseUrl, "/snapshot");
    const task = findTask(snapshot, taskId);
    if (task) last = { task, snapshot };
    if (task && predicate(task, snapshot)) return { task, snapshot };
    await sleep(POLL_MS);
  }
  throw new Error(`${label} timed out after ${timeoutMs}ms. Last task state: ${last?.task?.status || "missing"}.`);
}

async function git(cwd, args) {
  const { stdout, stderr } = await execFileAsync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    timeout: 20_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

async function seedFixture(root) {
  await mkdir(path.join(root, "src"), { recursive: true });
  await mkdir(path.join(root, "test"), { recursive: true });
  await writeFile(
    path.join(root, "package.json"),
    `${JSON.stringify({
      name: "cyclewarden-live-approval-dogfood",
      private: true,
      type: "module",
      scripts: { test: "node --test" },
    }, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(root, "src", "sum.mjs"),
    "export function sum(left, right) {\n  throw new Error('TODO: implement sum');\n}\n",
    "utf8",
  );
  await writeFile(
    path.join(root, "test", "sum.test.mjs"),
    [
      "import test from 'node:test';",
      "import assert from 'node:assert/strict';",
      "import { sum } from '../src/sum.mjs';",
      "",
      "test('adds finite numbers', () => {",
      "  assert.equal(sum(2, 3), 5);",
      "  assert.equal(sum(-4, 1.5), -2.5);",
      "});",
      "",
      "test('rejects non-finite input', () => {",
      "  assert.throws(() => sum(Number.NaN, 1), /finite/);",
      "  assert.throws(() => sum(1, Number.POSITIVE_INFINITY), /finite/);",
      "});",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(root, "AGENTS.md"),
    [
      "# Live approval dogfood fixture",
      "",
      "This repository is disposable test evidence for CycleWarden.",
      "Do not use network access. Do not modify tests or package.json.",
      "Only change src/sum.mjs, run npm test, and commit the intended repository change.",
      "The task objective may require one marker write outside this repository; request approval for it instead of bypassing the sandbox.",
      "",
    ].join("\n"),
    "utf8",
  );

  await execFileAsync("git", ["init", "-q", root], { encoding: "utf8" });
  await git(root, ["config", "user.name", "CycleWarden Live Dogfood"]);
  await git(root, ["config", "user.email", "live-dogfood@cyclewarden.invalid"]);
  await git(root, ["add", "."]);
  await git(root, ["commit", "-qm", "test: seed live approval fixture"]);
}

function hasRemoteDecisionEvidence(snapshot, taskId) {
  const events = taskEvents(snapshot, taskId);
  const started = events.some((event) => event.type === "remote.command_started" && event.payload?.kind === "decision");
  const completed = events.some((event) => event.type === "remote.command_completed" && event.payload?.kind === "decision" && event.payload?.result?.ok === true);
  const approval = events.some((event) => event.type === "agent.approval_requested");
  const decided = events.some((event) => event.type === "agent.approval_decided");
  return { started, completed, approval, decided, ok: started && completed && approval && decided };
}

async function main() {
  required(CONFIRMATION === REQUIRED_CONFIRMATION, `Live approval dogfood requires CYCLEWARDEN_LIVE_APPROVAL_DOGFOOD_CONFIRM=${REQUIRED_CONFIRMATION}`);
  const coreUrl = safeUrl(CORE_URL);
  const [doctor, health] = await Promise.all([
    requestJson(coreUrl, "/doctor"),
    requestJson(coreUrl, "/health"),
  ]);

  required(doctor?.ok === true, "Control Core doctor is not healthy.");
  required(doctor?.runtime?.codexMode === "app-server", `Control Core is using ${doctor?.runtime?.codexMode || "unknown"}; restart it with CYCLEWARDEN_CODEX_MODE=app-server.`);
  required(doctor?.codex?.ok === true, `Codex CLI is unavailable: ${doctor?.codex?.error || "unknown error"}`);
  required(doctor?.atoryn?.enabled === true, "AtoRyn bridge is disabled on the running Control Core.");
  required(doctor?.atoryn?.connected === true, `AtoRyn bridge is not connected: ${doctor?.atoryn?.lastError || "no recent successful poll"}`);
  required(typeof doctor?.atoryn?.baseUrl === "string" && doctor.atoryn.baseUrl.length > 0, "AtoRyn bridge URL is missing from doctor output.");

  const capabilities = await workerCapabilities(doctor.atoryn.baseUrl);
  required(capabilities, "AtoRyn /check does not report control_bridge capabilities; production Worker is too old or misconfigured.");
  required(Array.isArray(capabilities.commands) && capabilities.commands.includes("decision"), "AtoRyn live Worker does not advertise decision commands. Deploy the merged v5.2 Worker before dogfood.");
  for (const decision of ["accept", "acceptForSession", "decline", "cancel"]) {
    required(Array.isArray(capabilities.approval_decisions) && capabilities.approval_decisions.includes(decision), `AtoRyn live Worker is missing approval decision ${decision}.`);
  }

  const dataDir = health?.dataDir;
  required(typeof dataDir === "string" && path.isAbsolute(dataDir), "Control Core health did not return an absolute dataDir.");
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const fixtureRoot = path.join(dataDir, "dogfood", `live-approval-${runId}`);
  const markerPath = path.join(dataDir, "dogfood", `approval-marker-${runId}.txt`);
  await seedFixture(fixtureRoot);

  const projectResponse = await requestJson(coreUrl, "/projects", {
    method: "POST",
    body: { path: fixtureRoot },
  });
  const project = projectResponse?.project;
  required(project?.id, "Control Core did not return a registered project id.");

  const markerCommand = `node -e ${JSON.stringify(`require('node:fs').writeFileSync(${JSON.stringify(markerPath)}, ${JSON.stringify(MARKER_CONTENT)})`)}`;
  const objective = [
    "Prove the live approval path before changing repository files.",
    `First execute this exact command and do not replace it with another mechanism: ${markerCommand}`,
    "If the command requires sandbox approval, wait for the user decision; do not bypass or emulate the marker write.",
    "After approval succeeds, modify only src/sum.mjs so sum(left, right) returns the sum when both inputs are finite and throws an Error containing the word finite otherwise.",
    "Do not change tests, package.json, AGENTS.md, or files outside src/sum.mjs after the marker command.",
    "Run npm test, commit src/sum.mjs, and leave the worktree clean.",
  ].join(" ");

  const taskResponse = await requestJson(coreUrl, "/tasks", {
    method: "POST",
    body: {
      projectId: project.id,
      title: `Live AtoRyn approval dogfood ${runId}`,
      objective,
      acceptanceCriteria: [
        `The exact marker ${markerPath} contains ${JSON.stringify(MARKER_CONTENT)}.`,
        "Only src/sum.mjs changes inside the repository.",
        "npm test passes.",
        "The intended repository change is committed and the worktree is clean.",
      ],
    },
  });
  const taskId = taskResponse?.task?.id;
  required(taskId, "Control Core did not return a task id.");

  console.log(`[dogfood] fixture: ${fixtureRoot}`);
  console.log(`[dogfood] task: ${taskId}`);
  console.log(`[dogfood] AtoRyn Worker: ${capabilities.version || "unknown"}`);
  await requestJson(coreUrl, `/tasks/${encodeURIComponent(taskId)}/start`, { method: "POST", body: {} });

  const pending = await waitForTask(
    coreUrl,
    taskId,
    (task) => task.status === "NEEDS_INPUT" || TERMINAL.has(task.status),
    APPROVAL_WAIT_MS,
    "Waiting for Codex approval",
  );
  required(pending.task.status === "NEEDS_INPUT", `Task reached ${pending.task.status} before a live approval was observed: ${pending.task.failure?.message || "no failure detail"}`);
  required(pending.task.pendingDecision?.requestId, "NEEDS_INPUT task is missing the correlated approval request id.");

  console.log("[dogfood] Codex is waiting for approval.");
  console.log("[dogfood] Open the private AtoRyn Telegram chat and tap 'Allow once' for this task.");
  console.log("[dogfood] Do not use the local web approval buttons; this canary requires remote.command_* evidence from AtoRyn.");
  if (pending.task.pendingDecision?.command) {
    console.log(`[dogfood] approval command: ${String(pending.task.pendingDecision.command).slice(0, 600)}`);
  }

  const completed = await waitForTask(
    coreUrl,
    taskId,
    (task) => TERMINAL.has(task.status),
    COMPLETION_WAIT_MS,
    "Waiting for Telegram approval + Codex completion",
  );
  required(completed.task.status === "READY_TO_SHIP", `Dogfood task ended in ${completed.task.status}: ${completed.task.failure?.message || "no failure detail"}`);

  const remoteEvidence = hasRemoteDecisionEvidence(completed.snapshot, taskId);
  required(remoteEvidence.approval, "Missing agent.approval_requested evidence.");
  required(remoteEvidence.decided, "Missing agent.approval_decided evidence.");
  required(remoteEvidence.started, "Missing remote.command_started(kind=decision); approval was not proven to come through AtoRyn.");
  required(remoteEvidence.completed, "Missing successful remote.command_completed(kind=decision) evidence.");

  const marker = await readFile(markerPath, "utf8");
  required(marker === MARKER_CONTENT, `Marker content mismatch at ${markerPath}.`);
  required(completed.task.evidence?.clean === true, "READY_TO_SHIP evidence says worktree is not clean.");
  required(Array.isArray(completed.task.evidence?.changedFiles), "READY_TO_SHIP evidence is missing changedFiles.");
  required(completed.task.evidence.changedFiles.length === 1 && completed.task.evidence.changedFiles[0] === "src/sum.mjs", `Unexpected changed files: ${(completed.task.evidence.changedFiles || []).join(", ")}`);
  required(Array.isArray(completed.task.verification) && completed.task.verification.length > 0, "Verification results are missing.");
  required(completed.task.verification.every((check) => check.ok === true), "At least one repository verification check failed.");
  required(completed.task.worktreePath, "Task worktree path is missing.");
  required(completed.task.exactHead, "Task exact head is missing.");

  const [{ stdout: status }, { stdout: actualHead }] = await Promise.all([
    git(completed.task.worktreePath, ["status", "--porcelain=v1"]),
    git(completed.task.worktreePath, ["rev-parse", "HEAD"]),
  ]);
  required(status === "", `Git worktree is dirty after READY_TO_SHIP: ${status}`);
  required(actualHead === completed.task.exactHead, `Exact head mismatch: task=${completed.task.exactHead} git=${actualHead}`);

  console.log("[dogfood] PASS — live Codex app-server approval travelled through AtoRyn Telegram and returned to the local runner.");
  console.log(`[dogfood] exact head: ${completed.task.exactHead}`);
  console.log(`[dogfood] marker: ${markerPath}`);
  console.log(`[dogfood] evidence retained under: ${fixtureRoot}`);
}

await main();
