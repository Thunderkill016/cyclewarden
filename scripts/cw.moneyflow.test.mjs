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

test("MoneyFlow next remains on the manual readiness gates", async () => {
  const model = await loadProject(moneyFlowFixture);
  const next = selectNextTask(model);

  assert.equal(next.task.id, "MFVN-001");
  assert.equal(next.task.humanOnly, true);
  assert.match(next.task.title, /manual readiness gates/i);
});

test("MoneyFlow status explains why redesign work is blocked", async () => {
  const model = await loadProject(moneyFlowFixture);
  const status = projectStatus(model);

  assert.equal(status.activeTask.id, "MFVN-001");
  assert.equal(status.activeTask.humanOnly, true);
  assert.ok(status.blockers.some((blocker) => blocker.type === "human-evidence"));
  assert.match(model.status.ownerSummary.whatNotToDo, /Do not begin the broad redesign/i);

  const redesign = model.roadmap.tasks.find((task) => task.id === "MFVN-003");
  assert.equal(redesign.status, "blocked");
  assert.deepEqual(redesign.dependsOn, ["MFVN-002"]);
});
