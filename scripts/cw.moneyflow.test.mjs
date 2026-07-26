import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import {
  loadProject,
  projectStatus,
  selectNextTask,
  validateProject,
} from "./cw.mjs";

const moneyFlowFixture = resolve("fixtures/project-os/moneyflow");

test("MoneyFlow brownfield pilot is structurally valid", async () => {
  const model = await loadProject(moneyFlowFixture);
  assert.deepEqual(validateProject(model), []);
});

test("MoneyFlow next advances to seven-day self-use after readiness passes", async () => {
  const model = await loadProject(moneyFlowFixture);
  const next = selectNextTask(model);

  assert.equal(next.task.id, "MFVN-002");
  assert.equal(next.task.humanOnly, undefined);
  assert.match(next.task.title, /seven consecutive days/i);
});

test("MoneyFlow status keeps redesign blocked during self-use", async () => {
  const model = await loadProject(moneyFlowFixture);
  const status = projectStatus(model);

  assert.equal(status.activeTask.id, "MFVN-002");
  assert.equal(status.activeTask.humanOnly, false);
  assert.equal(status.blockers.length, 0);
  assert.match(model.status.ownerSummary.whatNotToDo, /Do not begin the broad redesign/i);

  const readiness = model.roadmap.tasks.find((task) => task.id === "MFVN-001");
  assert.equal(readiness.status, "done");
  assert.equal(readiness.completedAt, "2026-07-27");

  const redesign = model.roadmap.tasks.find((task) => task.id === "MFVN-003");
  assert.equal(redesign.status, "blocked");
  assert.deepEqual(redesign.dependsOn, ["MFVN-002"]);
});
