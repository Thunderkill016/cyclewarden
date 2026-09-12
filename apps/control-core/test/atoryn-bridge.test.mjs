import test from "node:test";
import assert from "node:assert/strict";
import { AtoRynBridge, sanitizeDashboard } from "../src/atoryn-bridge.mjs";

function makeTask(status = "BACKLOG") {
  return {
    id: "task_1234567890abcdef",
    projectId: "project_demo",
    title: "Ship bridge",
    objective: "secret objective must stay local",
    acceptanceCriteria: ["secret criteria"],
    status,
    agent: "codex",
    branch: null,
    worktreePath: "/home/user/private/worktree",
    exactHead: null,
    lastMessage: "private agent output",
    failure: null,
    updatedAt: new Date().toISOString(),
  };
}

class FakeStore {
  constructor() {
    this.dataDir = "/home/user/.cyclewarden/control-center";
    this.task = makeTask();
    this.events = [];
    this.listeners = new Set();
  }

  dashboard() {
    const task = structuredClone(this.task);
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      projects: [{
        id: "project_demo",
        name: "demo",
        rootPath: "/home/user/private/repo",
        agentsPath: "/home/user/private/repo/AGENTS.md",
        taskCounts: { total: 1, active: this.task.status === "RUNNING" ? 1 : 0, blocked: 0, readyToShip: 0 },
      }],
      needsYou: [],
      readyToShip: [],
      inFlight: this.task.status === "RUNNING" ? [task] : [],
      backlog: this.task.status === "BACKLOG" ? [task] : [],
      recentEvents: structuredClone(this.events),
    };
  }

  snapshot() {
    return { events: structuredClone(this.events) };
  }

  getTask(id) {
    return id === this.task.id ? this.task : null;
  }

  async appendEvent(event) {
    const stored = { ...event, id: `evt_${this.events.length + 1}`, createdAt: new Date().toISOString() };
    this.events.push(stored);
    for (const listener of this.listeners) listener(this.dashboard());
    return stored;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("sanitized snapshot never exports local paths or task objective", () => {
  const store = new FakeStore();
  const sanitized = sanitizeDashboard(store.dashboard());
  const raw = JSON.stringify(sanitized);
  assert.equal(raw.includes("/home/user"), false);
  assert.equal(raw.includes("secret objective"), false);
  assert.equal(raw.includes("private agent output"), false);
  assert.equal(sanitized.backlog[0].title, "Ship bridge");
  assert.equal(sanitized.projects[0].name, "demo");
});

test("re-delivered remote run command is not executed twice", async () => {
  const store = new FakeStore();
  let starts = 0;
  const runner = {
    async start(taskId) {
      starts += 1;
      assert.equal(taskId, store.task.id);
      store.task.status = "RUNNING";
      return store.task;
    },
    async cancel() {
      throw new Error("not expected");
    },
  };

  const command = {
    id: "cc_command_1",
    kind: "run",
    taskId: store.task.id,
    projectId: store.task.projectId,
    leaseId: "lease_1",
  };
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body || "{}");
    calls.push({ url: String(url), body, authorization: init.headers.authorization });
    if (String(url).endsWith("/sync")) return jsonResponse({ ok: true });
    if (String(url).endsWith("/pull")) return jsonResponse({ ok: true, commands: [command] });
    if (String(url).endsWith("/result")) return jsonResponse({ ok: true });
    return jsonResponse({ error: "unexpected" }, 404);
  };

  const bridge = new AtoRynBridge({
    store,
    runner,
    fetchImpl,
    baseUrl: "https://telegram-ai.example.workers.dev",
    token: "test-secret",
    coreId: "core_test",
    pollMs: 5_000,
  });

  await bridge.tickOnce();
  await bridge.tickOnce();

  assert.equal(starts, 1);
  assert.equal(store.events.filter((event) => event.type === "remote.command_started").length, 1);
  assert.equal(store.events.filter((event) => event.type === "remote.command_completed").length, 1);
  assert.ok(calls.every((call) => call.authorization === "Bearer test-secret"));
  const results = calls.filter((call) => call.url.endsWith("/result"));
  assert.equal(results.length, 2);
  assert.equal(results[1].body.result.ok, true);
  assert.match(results[1].body.result.message, /giao cho Codex local/);
});

test("bridge rejects plaintext remote endpoints but allows localhost test endpoints", () => {
  const store = new FakeStore();
  const runner = { start() {}, cancel() {} };
  assert.throws(
    () => new AtoRynBridge({ store, runner, baseUrl: "http://example.com", token: "x" }),
    /requires HTTPS/,
  );
  const local = new AtoRynBridge({ store, runner, baseUrl: "http://127.0.0.1:8787", token: "x" });
  assert.equal(local.enabled, true);
  assert.equal(local.status().baseUrl, "http://127.0.0.1:8787");
  assert.equal(Object.hasOwn(local.status(), "token"), false);
});
