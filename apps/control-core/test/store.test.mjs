import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createTaskRecord } from "../src/domain.mjs";
import { ControlStore } from "../src/store.mjs";

test("store persists projects and tasks across instances", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "cyclewarden-control-"));
  try {
    const store = await new ControlStore({ dataDir }).init();
    await store.registerProject({ id: "project_1", name: "demo", rootPath: "/tmp/demo", registeredAt: new Date().toISOString() });
    await store.addTask(
      createTaskRecord({ projectId: "project_1", title: "Task", objective: "Do work", baseHead: "abc123" }),
    );
    const reopened = await new ControlStore({ dataDir }).init();
    assert.equal(reopened.snapshot().projects.length, 1);
    assert.equal(reopened.snapshot().tasks.length, 1);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("restart reconciliation prevents phantom running tasks", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "cyclewarden-control-"));
  try {
    const store = await new ControlStore({ dataDir }).init();
    await store.registerProject({ id: "project_1", name: "demo", rootPath: "/tmp/demo", registeredAt: new Date().toISOString() });
    const task = await store.addTask(
      createTaskRecord({ projectId: "project_1", title: "Task", objective: "Do work", baseHead: "abc123" }),
    );
    await store.transition(task.id, "READY");
    await store.transition(task.id, "RUNNING");

    const reopened = await new ControlStore({ dataDir }).init();
    const count = await reopened.reconcileInterruptedTasks();
    assert.equal(count, 1);
    assert.equal(reopened.getTask(task.id).status, "FAILED");
    assert.equal(reopened.getTask(task.id).failure.code, "CORE_RESTARTED");
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("subscribers receive committed dashboard snapshots and can unsubscribe", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "cyclewarden-control-"));
  try {
    const store = await new ControlStore({ dataDir }).init();
    const snapshots = [];
    const unsubscribe = store.subscribe((snapshot) => snapshots.push(snapshot));

    await store.registerProject({ id: "project_1", name: "demo", rootPath: "/tmp/demo", registeredAt: new Date().toISOString() });
    assert.equal(snapshots.length, 1);
    assert.equal(snapshots[0].projects.length, 1);

    unsubscribe();
    await store.addTask(
      createTaskRecord({ projectId: "project_1", title: "Task", objective: "Do work", baseHead: "abc123" }),
    );
    assert.equal(snapshots.length, 1);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});
