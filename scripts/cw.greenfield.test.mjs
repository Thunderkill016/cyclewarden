import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import {
  loadProject,
  projectStatus,
  selectNextTask,
  validateProject,
} from "./cw.mjs";

const fixture = resolve("fixtures/project-os/js-practice-loop");

test("JS Practice Loop greenfield project is structurally valid", async () => {
  const model = await loadProject(fixture);
  assert.deepEqual(validateProject(model), []);
});

test("JS Practice Loop selects the smallest complete first slice", async () => {
  const model = await loadProject(fixture);
  const next = selectNextTask(model);

  assert.equal(next.task.id, "JPL-001");
  assert.match(next.task.title, /create and persist one JavaScript practice attempt/i);
  assert.equal(next.reason, "Continue the current active task before starting another task.");
});

test("JS Practice Loop prevents premature platform expansion", async () => {
  const model = await loadProject(fixture);
  const status = projectStatus(model);
  const project = model.project;
  const first = model.roadmap.tasks.find((task) => task.id === "JPL-001");

  assert.equal(status.activeTask.id, "JPL-001");
  assert.equal(model.roadmap.tasks.filter((task) => task.status === "active").length, 1);
  assert.equal(project.foundation.backend, "none");
  assert.equal(project.foundation.authentication, "none; single-user local tool");
  assert.match(project.foundation.data, /localStorage/i);
  assert.match(project.design.componentLibrary, /none for the first slice/i);
  assert.ok(project.project.nonGoals.some((item) => /AI tutor or answer generator/i.test(item)));
  assert.ok(first.outOfScope.some((item) => /accounts, backend, database, sync or deployment/i.test(item)));
  assert.ok(first.outOfScope.some((item) => /AI hints or generated solutions/i.test(item)));
});

test("JS Practice Loop keeps later learning features dependency-blocked", async () => {
  const model = await loadProject(fixture);
  const byId = new Map(model.roadmap.tasks.map((task) => [task.id, task]));

  assert.equal(byId.get("JPL-002").status, "blocked");
  assert.deepEqual(byId.get("JPL-002").dependsOn, ["JPL-001"]);
  assert.equal(byId.get("JPL-003").status, "blocked");
  assert.deepEqual(byId.get("JPL-003").dependsOn, ["JPL-002"]);
  assert.equal(byId.get("JPL-004").status, "blocked");
  assert.deepEqual(byId.get("JPL-004").dependsOn, ["JPL-003"]);
  assert.equal(byId.get("JPL-005").status, "blocked");
  assert.deepEqual(byId.get("JPL-005").dependsOn, ["JPL-004"]);
});
