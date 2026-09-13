import test from "node:test";
import assert from "node:assert/strict";
import { AtoRynBridge, sanitizeDashboard } from "../src/atoryn-bridge.mjs";

function task(status = "INTERRUPTED") {
  return {
    id: "task_resume_demo",
    projectId: "project_demo",
    title: "Resume demo",
    objective: "private objective",
    acceptanceCriteria: ["private criteria"],
    status,
    agent: "codex",
    branch: "cyclewarden/private",
    worktreePath: "/private/worktree/path",
    exactHead: "abc123",
    lastMessage: "private output",
    failure: { code: "CORE_RESTARTED", message: "private detail" },
    recovery: {
      canResume: true,
      reason: "WORKTREE_DIRTY",
      worktreePath: "/private/worktree/path",
      changedFiles: ["secret.txt"],
    },
    updatedAt: new Date().toISOString(),
  };
}

class FakeStore {
  constructor() {
    this.dataDir = "/private/control";
    this.task = task();
    this.events = [];
  }

  dashboard() {
    const copy = structuredClone(this.task);
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      projects: [{ id: "project_demo", name: "demo", taskCounts: { total: 1, active: 0, blocked: 1, readyToShip: 0 } }],
      needsYou: [copy],
      readyToShip: [],
      inFlight: [],
      backlog: [],
    };
  }

  snapshot() { return { events: structuredClone(this.events) }; }
  getTask(id) { return id === this.task.id ? this.task : null; }
  async appendEvent(event) {
    this.events.push({ ...event, id: `evt_${this.events.length + 1}`, createdAt: new Date().toISOString() });
  }
  subscribe() { return () => {}; }
}

function response(value) {
  return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
}

test("sanitized interrupted task relays only canResume and reason", () => {
  const clean = sanitizeDashboard(new FakeStore().dashboard());
  const remoteTask = clean.needsYou[0];
  assert.deepEqual(remoteTask.recovery, { canResume: true, reason: "WORKTREE_DIRTY" });
  const raw = JSON.stringify(remoteTask);
  assert.equal(raw.includes("/private/worktree/path"), false);
  assert.equal(raw.includes("secret.txt"), false);
  assert.equal(raw.includes("private objective"), false);
  assert.equal(raw.includes("private output"), false);
});

test("remote run reports resume semantics for interrupted tasks", async () => {
  const store = new FakeStore();
  let starts = 0;
  const runner = {
    async start(taskId) {
      starts += 1;
      assert.equal(taskId, store.task.id);
      store.task.status = "RUNNING";
      return store.task;
    },
    async cancel() { throw new Error("not expected"); },
  };
  const command = {
    id: "cc_resume_demo",
    kind: "run",
    taskId: store.task.id,
    projectId: store.task.projectId,
    leaseId: "lease_demo",
  };
  let resultBody = null;
  const fetchImpl = async (url, init) => {
    const target = String(url);
    if (target.endsWith("/sync")) return response({ ok: true });
    if (target.endsWith("/pull")) return response({ ok: true, commands: [command] });
    if (target.endsWith("/result")) {
      resultBody = JSON.parse(init.body || "{}");
      return response({ ok: true });
    }
    return new Response("{}", { status: 404 });
  };
  const bridge = new AtoRynBridge({
    store,
    runner,
    fetchImpl,
    baseUrl: "https://telegram.example.test",
    token: "test-token",
    coreId: "core_test",
  });

  await bridge.tickOnce();
  assert.equal(starts, 1);
  assert.equal(resultBody.result.ok, true);
  assert.match(resultBody.result.message, /resume an toàn/);
});
