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
    pendingDecision: null,
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
        taskCounts: {
          total: 1,
          active: ["RUNNING", "VERIFYING"].includes(this.task.status) ? 1 : 0,
          blocked: this.task.status === "NEEDS_INPUT" ? 1 : 0,
          readyToShip: this.task.status === "READY_TO_SHIP" ? 1 : 0,
        },
      }],
      needsYou: this.task.status === "NEEDS_INPUT" ? [task] : [],
      readyToShip: this.task.status === "READY_TO_SHIP" ? [task] : [],
      inFlight: ["RUNNING", "VERIFYING"].includes(this.task.status) ? [task] : [],
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

test("sanitized NEEDS_INPUT approval preserves correlation id but redacts command secrets and local home", () => {
  const store = new FakeStore();
  store.task.status = "NEEDS_INPUT";
  store.task.pendingDecision = {
    requestId: "approval_current_123",
    kind: "command",
    command: "OPENAI_API_KEY=super-secret curl -H 'Authorization: Bearer bearer-secret-123' /home/user/private/repo && echo sk-proj-verysecrettoken",
    reason: "Need network permission for the bounded check.",
    threadId: "private_thread_should_not_leave_core",
    turnId: "private_turn_should_not_leave_core",
    itemId: "private_item_should_not_leave_core",
    requestedAt: "2026-09-13T05:00:00.000Z",
  };

  const sanitized = sanitizeDashboard(store.dashboard());
  const pending = sanitized.needsYou[0].pendingDecision;
  const raw = JSON.stringify(sanitized);

  assert.equal(pending.requestId, "approval_current_123");
  assert.equal(pending.kind, "command");
  assert.equal(pending.reason, "Need network permission for the bounded check.");
  assert.match(pending.commandPreview, /OPENAI_API_KEY=<redacted>/);
  assert.match(pending.commandPreview, /Bearer <redacted>/);
  assert.match(pending.commandPreview, /<redacted-token>/);
  assert.equal(raw.includes("super-secret"), false);
  assert.equal(raw.includes("bearer-secret-123"), false);
  assert.equal(raw.includes("verysecrettoken"), false);
  assert.equal(raw.includes("/home/user"), false);
  assert.equal(raw.includes("private_thread_should_not_leave_core"), false);
  assert.equal(raw.includes("private_turn_should_not_leave_core"), false);
  assert.equal(raw.includes("private_item_should_not_leave_core"), false);
});

test("idle bridge does not resync only because generatedAt changed", async () => {
  const store = new FakeStore();
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (String(url).endsWith("/sync")) return jsonResponse({ ok: true });
    if (String(url).endsWith("/pull")) return jsonResponse({ ok: true, commands: [] });
    return jsonResponse({ error: "unexpected" }, 404);
  };
  const bridge = new AtoRynBridge({
    store,
    runner: { start() {}, cancel() {}, decide() {} },
    fetchImpl,
    baseUrl: "https://telegram-ai.example.workers.dev",
    token: "test-secret",
    coreId: "core_test",
    pollMs: 5_000,
  });

  await bridge.tickOnce();
  await new Promise((resolve) => setTimeout(resolve, 5));
  await bridge.tickOnce();

  assert.equal(calls.filter((url) => url.endsWith("/sync")).length, 1);
  assert.equal(calls.filter((url) => url.endsWith("/pull")).length, 2);
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
    async decide() {
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

test("remote approval decision applies once and duplicate delivery does not call runner twice", async () => {
  const store = new FakeStore();
  store.task.status = "NEEDS_INPUT";
  store.task.pendingDecision = {
    requestId: "approval_current",
    kind: "command",
    command: "git status",
    reason: "fixture",
  };
  let decisions = 0;
  const runner = {
    async start() { throw new Error("not expected"); },
    async cancel() { throw new Error("not expected"); },
    async decide(taskId, decision) {
      decisions += 1;
      assert.equal(taskId, store.task.id);
      assert.equal(decision, "accept");
      assert.equal(store.task.pendingDecision.requestId, "approval_current");
      store.task.status = "RUNNING";
      store.task.pendingDecision = null;
      return store.task;
    },
  };
  const command = {
    id: "cc_decision_1",
    kind: "decision",
    decision: "accept",
    expectedRequestId: "approval_current",
    taskId: store.task.id,
    projectId: store.task.projectId,
    leaseId: "lease_decision_1",
  };
  const results = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body || "{}");
    if (String(url).endsWith("/sync")) return jsonResponse({ ok: true });
    if (String(url).endsWith("/pull")) return jsonResponse({ ok: true, commands: [command] });
    if (String(url).endsWith("/result")) {
      results.push(body.result);
      return jsonResponse({ ok: true });
    }
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

  assert.equal(decisions, 1);
  assert.equal(store.task.status, "RUNNING");
  assert.equal(store.task.pendingDecision, null);
  assert.equal(store.events.filter((event) => event.type === "remote.command_started").length, 1);
  assert.equal(store.events.filter((event) => event.type === "remote.command_completed").length, 1);
  assert.equal(results.length, 2);
  assert.equal(results[0].ok, true);
  assert.equal(results[1].ok, true);
});

test("stale remote decision cannot approve a newer pending Codex request", async () => {
  const store = new FakeStore();
  store.task.status = "NEEDS_INPUT";
  store.task.pendingDecision = {
    requestId: "approval_new",
    kind: "command",
    command: "npm test",
    reason: "new approval",
  };
  let decisions = 0;
  const runner = {
    async start() { throw new Error("not expected"); },
    async cancel() { throw new Error("not expected"); },
    async decide() {
      decisions += 1;
      throw new Error("stale decision must never reach runner");
    },
  };
  const command = {
    id: "cc_decision_stale",
    kind: "decision",
    decision: "acceptForSession",
    expectedRequestId: "approval_old",
    taskId: store.task.id,
    projectId: store.task.projectId,
    leaseId: "lease_stale",
  };
  const results = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body || "{}");
    if (String(url).endsWith("/sync")) return jsonResponse({ ok: true });
    if (String(url).endsWith("/pull")) return jsonResponse({ ok: true, commands: [command] });
    if (String(url).endsWith("/result")) {
      results.push(body.result);
      return jsonResponse({ ok: true });
    }
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

  assert.equal(decisions, 0);
  assert.equal(store.task.status, "NEEDS_INPUT");
  assert.equal(store.task.pendingDecision.requestId, "approval_new");
  assert.equal(results.length, 1);
  assert.equal(results[0].ok, false);
  assert.match(results[0].error, /thay đổi|hết hạn/);
});

test("bridge rejects plaintext remote endpoints but allows localhost test endpoints", () => {
  const store = new FakeStore();
  const runner = { start() {}, cancel() {}, decide() {} };
  assert.throws(
    () => new AtoRynBridge({ store, runner, baseUrl: "http://example.com", token: "x" }),
    /requires HTTPS/,
  );
  const local = new AtoRynBridge({ store, runner, baseUrl: "http://127.0.0.1:8787", token: "x" });
  assert.equal(local.enabled, true);
  assert.equal(local.status().baseUrl, "http://127.0.0.1:8787");
  assert.equal(Object.hasOwn(local.status(), "token"), false);
});
