import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CodexAppServerClient } from "../src/codex-app-server.mjs";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

test("app-server transport handshakes, correlates approval, and rejects stale decisions", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "cyclewarden-app-server-"));
  const fakeCodex = path.join(root, "fake-codex-app-server.mjs");
  const approvalSeen = deferred();
  const transcriptSeen = deferred();

  try {
    await writeFile(
      fakeCodex,
      `#!/usr/bin/env node\n` +
        `import readline from "node:readline";\n` +
        `const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });\n` +
        `let initialized = false;\n` +
        `let threadParams = null;\n` +
        `let turnParams = null;\n` +
        `for await (const line of rl) {\n` +
        `  if (!line.trim()) continue;\n` +
        `  const msg = JSON.parse(line);\n` +
        `  if (msg.method === "initialize") {\n` +
        `    if (msg.params?.clientInfo?.name !== "cyclewarden-control-core") process.exit(31);\n` +
        `    console.log(JSON.stringify({ id: msg.id, result: { userAgent: "fixture" } }));\n` +
        `    continue;\n` +
        `  }\n` +
        `  if (msg.method === "initialized") { initialized = true; continue; }\n` +
        `  if (msg.method === "thread/start") {\n` +
        `    threadParams = msg.params;\n` +
        `    console.log(JSON.stringify({ id: msg.id, result: { thread: { id: "thread_fixture" } } }));\n` +
        `    continue;\n` +
        `  }\n` +
        `  if (msg.method === "turn/start") {\n` +
        `    turnParams = msg.params;\n` +
        `    console.log(JSON.stringify({ id: msg.id, result: { turn: { id: "turn_fixture" } } }));\n` +
        `    console.log(JSON.stringify({\n` +
        `      id: "approval_1",\n` +
        `      method: "item/commandExecution/requestApproval",\n` +
        `      params: {\n` +
        `        threadId: "thread_fixture",\n` +
        `        turnId: "turn_fixture",\n` +
        `        itemId: "item_fixture",\n` +
        `        startedAtMs: Date.now(),\n` +
        `        command: "git status",\n` +
        `        reason: "fixture approval"\n` +
        `      }\n` +
        `    }));\n` +
        `    continue;\n` +
        `  }\n` +
        `  if (msg.id === "approval_1" && msg.result?.decision) {\n` +
        `    console.log(JSON.stringify({\n` +
        `      method: "fixture/transcript",\n` +
        `      params: { initialized, threadParams, turnParams, decision: msg.result.decision }\n` +
        `    }));\n` +
        `    continue;\n` +
        `  }\n` +
        `}\n`,
      "utf8",
    );
    await chmod(fakeCodex, 0o755);

    const client = new CodexAppServerClient({
      cwd: root,
      bin: fakeCodex,
      onApproval: (approval) => approvalSeen.resolve(approval),
      onNotification: (notification) => {
        if (notification.method === "fixture/transcript") transcriptSeen.resolve(notification.params);
      },
    });

    await client.start();
    const thread = await client.startThread({ cwd: root, developerInstructions: "Keep changes bounded." });
    assert.equal(thread.threadId, "thread_fixture");

    const turn = await client.startTurn({ threadId: thread.threadId, text: "Implement the fixture." });
    assert.equal(turn.turnId, "turn_fixture");

    const approval = await approvalSeen.promise;
    assert.equal(approval.requestId, "approval_1");
    assert.equal(approval.method, "item/commandExecution/requestApproval");
    assert.equal(approval.params.command, "git status");

    await assert.rejects(() => client.decide(approval.requestId, "allowEverything"), /Unsupported Codex approval decision/);
    await client.decide(approval.requestId, "accept");
    await assert.rejects(() => client.decide(approval.requestId, "accept"), /stale, unknown, or already answered/);

    const transcript = await transcriptSeen.promise;
    assert.equal(transcript.initialized, true);
    assert.equal(transcript.threadParams.cwd, root);
    assert.equal(transcript.threadParams.approvalPolicy, "on-request");
    assert.equal(transcript.threadParams.approvalsReviewer, "user");
    assert.equal(transcript.threadParams.sandbox, "workspace-write");
    assert.equal(transcript.turnParams.threadId, "thread_fixture");
    assert.deepEqual(transcript.turnParams.input, [
      { type: "text", text: "Implement the fixture.", text_elements: [] },
    ]);
    assert.equal(transcript.decision, "accept");

    client.kill();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("app-server approval timeout automatically cancels the request", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "cyclewarden-app-timeout-"));
  const fakeCodex = path.join(root, "fake-codex-timeout.mjs");
  const timeoutSeen = deferred();
  const cancelSeen = deferred();

  try {
    await writeFile(
      fakeCodex,
      `#!/usr/bin/env node\n` +
        `import readline from "node:readline";\n` +
        `const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });\n` +
        `for await (const line of rl) {\n` +
        `  if (!line.trim()) continue;\n` +
        `  const msg = JSON.parse(line);\n` +
        `  if (msg.method === "initialize") { console.log(JSON.stringify({ id: msg.id, result: {} })); continue; }\n` +
        `  if (msg.method === "initialized") continue;\n` +
        `  if (msg.method === "thread/start") { console.log(JSON.stringify({ id: msg.id, result: { thread: { id: "thread_timeout" } } })); continue; }\n` +
        `  if (msg.method === "turn/start") {\n` +
        `    console.log(JSON.stringify({ id: msg.id, result: { turn: { id: "turn_timeout" } } }));\n` +
        `    console.log(JSON.stringify({ id: "approval_timeout", method: "item/fileChange/requestApproval", params: { threadId: "thread_timeout", turnId: "turn_timeout", itemId: "file_timeout", startedAtMs: Date.now(), reason: "timeout fixture" } }));\n` +
        `    continue;\n` +
        `  }\n` +
        `  if (msg.id === "approval_timeout") {\n` +
        `    console.log(JSON.stringify({ method: "fixture/cancelled", params: { decision: msg.result?.decision ?? null } }));\n` +
        `  }\n` +
        `}\n`,
      "utf8",
    );
    await chmod(fakeCodex, 0o755);

    const client = new CodexAppServerClient({
      cwd: root,
      bin: fakeCodex,
      env: { ...process.env, CYCLEWARDEN_CODEX_APPROVAL_TIMEOUT_MS: "500" },
      onApprovalTimeout: (approval) => timeoutSeen.resolve(approval),
      onNotification: (notification) => {
        if (notification.method === "fixture/cancelled") cancelSeen.resolve(notification.params);
      },
    });

    await client.start();
    const thread = await client.startThread({ cwd: root });
    await client.startTurn({ threadId: thread.threadId, text: "Wait for timeout." });

    const timedOut = await timeoutSeen.promise;
    assert.equal(timedOut.requestId, "approval_timeout");
    assert.equal(timedOut.method, "item/fileChange/requestApproval");
    const cancelled = await cancelSeen.promise;
    assert.equal(cancelled.decision, "cancel");
    assert.equal(client.hasApproval("approval_timeout"), false);
    await assert.rejects(() => client.decide("approval_timeout", "accept"), /stale, unknown, or already answered/);

    client.kill();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
