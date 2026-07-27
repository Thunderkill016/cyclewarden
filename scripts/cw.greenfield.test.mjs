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

test("JS Practice Loop stops after JPL-003 acceptance instead of inventing the next feature", async () => {
  const model = await loadProject(fixture);
  const next = selectNextTask(model);

  assert.equal(next.task, null);
  assert.match(next.reason, /No task is ready/i);
  assert.ok(next.blocked.some((task) => task.id === "JPL-004"));
});

test("JS Practice Loop records JPL-003 acceptance and has no current implementation task", async () => {
  const model = await loadProject(fixture);
  const status = projectStatus(model);
  const retry = model.roadmap.tasks.find((task) => task.id === "JPL-003");

  assert.equal(status.currentTask, null);
  assert.equal(
    model.roadmap.tasks.filter((task) =>
      new Set(["active", "verify"]).has(task.status),
    ).length,
    0,
  );
  assert.equal(retry.status, "done");
  assert.equal(retry.acceptedAt, "2026-07-27");
  assert.ok(
    retry.ownerAcceptance.some((item) =>
      /responded OK/i.test(item),
    ),
  );
  assert.ok(
    retry.ownerAcceptance.some((item) =>
      /does not provide the five real-exercise evidence/i.test(item),
    ),
  );
});

test("JPL-003 remains bounded to the accepted manual fresh-retry flow", async () => {
  const model = await loadProject(fixture);
  const retry = model.roadmap.tasks.find((task) => task.id === "JPL-003");

  assert.equal(retry.status, "done");
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
    retry.automatedEvidence.some((item) => /30232985685/i.test(item)),
  );
});

test("JPL-004 remains blocked by missing product evidence even though its dependency is done", async () => {
  const model = await loadProject(fixture);
  const byId = new Map(model.roadmap.tasks.map((task) => [task.id, task]));
  const history = byId.get("JPL-004");

  assert.equal(byId.get("JPL-001").status, "done");
  assert.equal(byId.get("JPL-002").status, "done");
  assert.equal(byId.get("JPL-003").status, "done");
  assert.equal(history.status, "blocked");
  assert.deepEqual(history.dependsOn, ["JPL-003"]);
  assert.match(history.blockedReason, /five real exercises/i);
  assert.equal(byId.get("JPL-005").status, "blocked");
  assert.deepEqual(byId.get("JPL-005").dependsOn, ["JPL-004"]);
  assert.ok(
    model.status.blockers.some(
      (blocker) => blocker.taskId === "JPL-004" && blocker.type === "product-evidence",
    ),
  );
});
