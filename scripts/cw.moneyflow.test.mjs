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

test("MoneyFlow next advances to the Calm Ledger foundation after the owner drops the fixed self-use gate", async () => {
  const model = await loadProject(moneyFlowFixture);
  const next = selectNextTask(model);

  assert.equal(next.task.id, "MFVN-003");
  assert.equal(next.task.humanOnly, undefined);
  assert.match(next.task.title, /Calm Ledger foundation/i);
});

test("MoneyFlow records the seven-day gate as dropped rather than falsely complete", async () => {
  const model = await loadProject(moneyFlowFixture);
  const status = projectStatus(model);

  assert.equal(status.activeTask.id, "MFVN-003");
  assert.equal(status.activeTask.humanOnly, false);
  assert.equal(status.blockers.length, 0);
  assert.match(model.status.ownerSummary.whatNotToDo, /Do not begin later redesign slices/i);

  const readiness = model.roadmap.tasks.find((task) => task.id === "MFVN-001");
  assert.equal(readiness.status, "done");
  assert.equal(readiness.completedAt, "2026-07-27");

  const selfUse = model.roadmap.tasks.find((task) => task.id === "MFVN-002");
  assert.equal(selfUse.status, "dropped");
  assert.match(selfUse.dropReason, /removed the fixed seven-day requirement/i);

  const foundation = model.roadmap.tasks.find((task) => task.id === "MFVN-003");
  assert.equal(foundation.status, "active");
  assert.deepEqual(foundation.dependsOn, ["MFVN-001"]);

  const dailyFlows = model.roadmap.tasks.find((task) => task.id === "MFVN-004");
  assert.equal(dailyFlows.status, "blocked");
  assert.deepEqual(dailyFlows.dependsOn, ["MFVN-003"]);
});
