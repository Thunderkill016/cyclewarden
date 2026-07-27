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

test("JS Practice Loop keeps JPL-003 current through owner verification", async () => {
  const model = await loadProject(fixture);
  const next = selectNextTask(model);

  assert.equal(next.task.id, "JPL-003");
  assert.equal(next.task.status, "verify");
  assert.match(next.task.title, /retry a reflected mistake/i);
  assert.match(next.reason, /owner acceptance/i);
});

test("JS Practice Loop records JPL-002 acceptance without claiming learning effectiveness", async () => {
  const model = await loadProject(fixture);
  const status = projectStatus(model);
  const reflection = model.roadmap.tasks.find((task) => task.id === "JPL-002");

  assert.equal(status.currentTask.id, "JPL-003");
  assert.equal(status.currentTask.status, "verify");
  assert.equal(
    model.roadmap.tasks.filter((task) =>
      new Set(["active", "verify"]).has(task.status),
    ).length,
    1,
  );
  assert.equal(reflection.status, "done");
  assert.equal(reflection.acceptedAt, "2026-07-27");
  assert.ok(
    reflection.ownerAcceptance.some((item) =>
      /owner said to continue/i.test(item),
    ),
  );
  assert.ok(
    reflection.ownerAcceptance.some((item) =>
      /not as proof of learning effectiveness/i.test(item),
    ),
  );
});

test("JPL-003 stays bounded to a verified manual fresh-retry flow", async () => {
  const model = await loadProject(fixture);
  const retry = model.roadmap.tasks.find((task) => task.id === "JPL-003");

  assert.equal(retry.status, "verify");
  assert.deepEqual(retry.dependsOn, ["JPL-002"]);
  assert.equal(retry.scopeCorrection.decision, "manual review only");
  assert.ok(
    retry.scope.some((item) => /hiding the previous attempt, mistake and lesson/i.test(item)),
  );
  assert.ok(
    retry.acceptance.some((item) => /required before prior material is revealed/i.test(item)),
  );
  assert.ok(retry.outOfScope.some((item) => /fixed intervals/i.test(item)));
  assert.ok(retry.outOfScope.some((item) => /AI hints/i.test(item)));
  assert.ok(retry.outOfScope.some((item) => /backend/i.test(item)));
  assert.ok(
    retry.automatedEvidence.some((item) => /30232806674/i.test(item)),
  );
  assert.ok(
    retry.manualEvidencePending.some((item) => /fresh-retry state/i.test(item)),
  );
});

test("JS Practice Loop keeps later learning features dependency-blocked", async () => {
  const model = await loadProject(fixture);
  const byId = new Map(model.roadmap.tasks.map((task) => [task.id, task]));

  assert.equal(byId.get("JPL-001").status, "done");
  assert.equal(byId.get("JPL-002").status, "done");
  assert.equal(byId.get("JPL-003").status, "verify");
  assert.equal(byId.get("JPL-004").status, "blocked");
  assert.deepEqual(byId.get("JPL-004").dependsOn, ["JPL-003"]);
  assert.equal(byId.get("JPL-005").status, "blocked");
  assert.deepEqual(byId.get("JPL-005").dependsOn, ["JPL-004"]);
});
