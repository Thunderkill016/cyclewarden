import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import { loadProject } from "./cw.mjs";
import {
  projectStatus,
  selectNextTask,
  validateProject,
} from "./cw-cli.mjs";

const fixture = resolve("fixtures/project-os/js-practice-loop");

test("JS Practice Loop greenfield project is structurally valid", async () => {
  const model = await loadProject(fixture);
  assert.deepEqual(validateProject(model), []);
});

test("JS Practice Loop keeps JPL-002 current through owner verification", async () => {
  const model = await loadProject(fixture);
  const next = selectNextTask(model);

  assert.equal(next.task.id, "JPL-002");
  assert.equal(next.task.status, "verify");
  assert.match(next.task.title, /record the mistake and lesson learned/i);
  assert.match(next.reason, /owner acceptance/i);
});

test("JS Practice Loop records JPL-001 acceptance without claiming learning effectiveness", async () => {
  const model = await loadProject(fixture);
  const status = projectStatus(model);
  const project = model.project;
  const first = model.roadmap.tasks.find((task) => task.id === "JPL-001");

  assert.equal(status.currentTask.id, "JPL-002");
  assert.equal(status.currentTask.status, "verify");
  assert.equal(
    model.roadmap.tasks.filter((task) =>
      new Set(["active", "verify"]).has(task.status),
    ).length,
    1,
  );
  assert.equal(first.status, "done");
  assert.equal(first.acceptedAt, "2026-07-27");
  assert.ok(
    first.ownerAcceptance.some((item) =>
      /explicitly accepted JPL-001/i.test(item),
    ),
  );
  assert.ok(
    first.ownerAcceptance.some((item) =>
      /does not yet prove.*improves learning outcomes/i.test(item),
    ),
  );
  assert.equal(project.foundation.backend, "none");
  assert.equal(project.foundation.authentication, "none; single-user local tool");
  assert.match(project.foundation.data, /localStorage/i);
  assert.match(project.design.componentLibrary, /none for the first slice/i);
});

test("JPL-002 stays bounded to editable reflection and migration", async () => {
  const model = await loadProject(fixture);
  const reflection = model.roadmap.tasks.find((task) => task.id === "JPL-002");

  assert.equal(reflection.status, "verify");
  assert.deepEqual(reflection.dependsOn, ["JPL-001"]);
  assert.ok(reflection.scope.some((item) => /schema-version-1/i.test(item)));
  assert.ok(reflection.scope.some((item) => /edit both reflection fields/i.test(item)));
  assert.ok(reflection.outOfScope.some((item) => /retry scheduling/i.test(item)));
  assert.ok(reflection.outOfScope.some((item) => /AI hints/i.test(item)));
  assert.ok(reflection.outOfScope.some((item) => /backend/i.test(item)));
  assert.ok(
    reflection.automatedEvidence.some((item) => /30228865620/i.test(item)),
  );
  assert.ok(
    reflection.manualEvidencePending.some((item) => /owner reviews/i.test(item)),
  );
});

test("JS Practice Loop keeps later learning features dependency-blocked", async () => {
  const model = await loadProject(fixture);
  const byId = new Map(model.roadmap.tasks.map((task) => [task.id, task]));

  assert.equal(byId.get("JPL-001").status, "done");
  assert.equal(byId.get("JPL-002").status, "verify");
  assert.equal(byId.get("JPL-003").status, "blocked");
  assert.deepEqual(byId.get("JPL-003").dependsOn, ["JPL-002"]);
  assert.equal(byId.get("JPL-004").status, "blocked");
  assert.deepEqual(byId.get("JPL-004").dependsOn, ["JPL-003"]);
  assert.equal(byId.get("JPL-005").status, "blocked");
  assert.deepEqual(byId.get("JPL-005").dependsOn, ["JPL-004"]);
});
