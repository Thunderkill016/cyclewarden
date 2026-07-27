import assert from "node:assert/strict";
import test from "node:test";

import {
  projectStatus,
  selectNextTask,
  validateProject,
} from "./cw-cli.mjs";

function verificationModel() {
  return {
    project: {
      schemaVersion: 1,
      mode: "greenfield",
      project: {
        id: "verification-pilot",
        name: "Verification Pilot",
      },
    },
    roadmap: {
      schemaVersion: 1,
      tasks: [
        {
          id: "VP-000",
          title: "Shape the project",
          status: "done",
          dependsOn: [],
          acceptance: ["scope is explicit"],
          requiredEvidence: ["project state"],
        },
        {
          id: "VP-001",
          title: "Verify the first slice",
          status: "verify",
          dependsOn: ["VP-000"],
          acceptance: ["automated checks pass", "owner reviews the result"],
          requiredEvidence: ["CI run", "owner decision"],
        },
        {
          id: "VP-002",
          title: "Build a later slice",
          status: "blocked",
          dependsOn: ["VP-001"],
        },
      ],
    },
    status: {
      schemaVersion: 1,
      phase: "verification",
      activeTaskId: "VP-001",
      lastCompletedTaskId: "VP-000",
      blockedTaskIds: ["VP-002"],
      blockers: [],
      unresolvedDecisions: [],
    },
  };
}

test("verify is a valid current-task state", () => {
  const model = verificationModel();

  assert.deepEqual(validateProject(model), []);

  const next = selectNextTask(model);
  assert.equal(next.task.id, "VP-001");
  assert.equal(next.task.status, "verify");
  assert.match(next.reason, /owner acceptance/i);

  const status = projectStatus(model);
  assert.deepEqual(status.currentTask, {
    id: "VP-001",
    title: "Verify the first slice",
    status: "verify",
    humanOnly: false,
  });
});

test("active and verify cannot coexist as two current tasks", () => {
  const model = verificationModel();
  model.roadmap.tasks.push({
    id: "VP-003",
    title: "Unrelated active work",
    status: "active",
    dependsOn: ["VP-000"],
    acceptance: ["bounded"],
    requiredEvidence: ["test"],
  });

  const errors = validateProject(model);
  assert.ok(errors.some((error) => error.includes("only one task may be current")));
});
