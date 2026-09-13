import test from "node:test";
import assert from "node:assert/strict";
import { ProjectHealthWatcher } from "../src/project-health-watcher.mjs";

class FakeStore {
  constructor() {
    this.project = {
      id: "project_demo",
      name: "demo",
      rootPath: "/tmp/demo",
      registeredHead: "aaa111",
      health: null,
    };
    this.events = [];
    this.patchCount = 0;
  }

  snapshot() {
    return { projects: [structuredClone(this.project)] };
  }

  getProject(projectId) {
    return projectId === this.project.id ? this.project : null;
  }

  async patchProject(projectId, patch, event) {
    assert.equal(projectId, this.project.id);
    this.project = { ...this.project, ...patch };
    this.patchCount += 1;
    if (event) this.events.push(event);
    return this.project;
  }
}

test("project watcher persists only semantic health changes", async () => {
  const store = new FakeStore();
  let health = {
    available: true,
    head: "aaa111",
    branch: "main",
    dirty: false,
    changedFiles: 0,
    headMoved: false,
    checkedAt: new Date().toISOString(),
  };
  const watcher = new ProjectHealthWatcher({
    store,
    inspectHealth: async () => ({ ...health, checkedAt: new Date().toISOString() }),
    intervalMs: 5_000,
  });

  await watcher.refreshProject(store.project.id);
  assert.equal(store.patchCount, 1);
  assert.equal(store.events.at(-1).type, "project.health_initialized");

  await watcher.refreshProject(store.project.id);
  assert.equal(store.patchCount, 1, "checkedAt-only changes must not persist or emit");

  health = { ...health, dirty: true, changedFiles: 2 };
  await watcher.refreshProject(store.project.id);
  assert.equal(store.patchCount, 2);
  assert.equal(store.events.at(-1).type, "project.dirty_changed");
  assert.equal(store.project.health.dirty, true);
  assert.equal(store.project.health.changedFiles, 2);
});

test("project watcher records unavailable and recovered transitions", async () => {
  const store = new FakeStore();
  const states = [
    {
      available: false,
      head: null,
      branch: null,
      dirty: null,
      changedFiles: null,
      headMoved: null,
      error: "repo missing",
      checkedAt: new Date().toISOString(),
    },
    {
      available: true,
      head: "bbb222",
      branch: "main",
      dirty: false,
      changedFiles: 0,
      headMoved: true,
      error: null,
      checkedAt: new Date().toISOString(),
    },
  ];
  const watcher = new ProjectHealthWatcher({
    store,
    inspectHealth: async () => states.shift(),
    intervalMs: 5_000,
  });

  await watcher.refreshProject(store.project.id);
  assert.equal(store.project.health.available, false);
  assert.equal(store.events.at(-1).type, "project.unavailable");

  await watcher.refreshProject(store.project.id);
  assert.equal(store.project.health.available, true);
  assert.equal(store.events.at(-1).type, "project.available");
  assert.equal(store.project.health.headMoved, true);
});
