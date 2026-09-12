import test from "node:test";
import assert from "node:assert/strict";
import { createTaskRecord, dashboardSnapshot, transitionTask } from "../src/domain.mjs";

test("task lifecycle accepts the V0 happy path", () => {
  let task = createTaskRecord({
    projectId: "project_1",
    title: "Fix workspace",
    objective: "Repair workspace state",
    acceptanceCriteria: ["tests pass"],
    baseHead: "abc123",
  });
  task = transitionTask(task, "READY");
  task = transitionTask(task, "RUNNING");
  task = transitionTask(task, "VERIFYING");
  task = transitionTask(task, "READY_TO_SHIP", { exactHead: "def456" });
  assert.equal(task.status, "READY_TO_SHIP");
  assert.equal(task.exactHead, "def456");
});

test("invalid transitions fail closed", () => {
  const task = createTaskRecord({
    projectId: "project_1",
    title: "Task",
    objective: "Do work",
    acceptanceCriteria: [],
    baseHead: "abc123",
  });
  assert.throws(() => transitionTask(task, "READY_TO_SHIP"), /Invalid task transition/);
});

test("dashboard groups decision states instead of exposing a generic kanban", () => {
  const base = {
    version: 1,
    projects: [{ id: "project_1", name: "demo", rootPath: "/tmp/demo" }],
    events: [],
    tasks: [],
  };
  let blocked = createTaskRecord({ projectId: "project_1", title: "Blocked", objective: "x", baseHead: "a" });
  blocked = transitionTask(transitionTask(blocked, "READY"), "RUNNING");
  blocked = transitionTask(blocked, "NEEDS_INPUT");
  let running = createTaskRecord({ projectId: "project_1", title: "Running", objective: "x", baseHead: "a" });
  running = transitionTask(transitionTask(running, "READY"), "RUNNING");
  let ready = createTaskRecord({ projectId: "project_1", title: "Ready", objective: "x", baseHead: "a" });
  ready = transitionTask(transitionTask(transitionTask(ready, "READY"), "RUNNING"), "VERIFYING");
  ready = transitionTask(ready, "READY_TO_SHIP");
  const snapshot = dashboardSnapshot({ ...base, tasks: [blocked, running, ready] });
  assert.equal(snapshot.needsYou.length, 1);
  assert.equal(snapshot.inFlight.length, 1);
  assert.equal(snapshot.readyToShip.length, 1);
  assert.deepEqual(snapshot.projects[0].taskCounts, { total: 3, active: 1, blocked: 1, readyToShip: 1 });
});
