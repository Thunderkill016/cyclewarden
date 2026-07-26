import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  loadProject,
  projectStatus,
  scaffoldProject,
  selectNextTask,
  validateProject,
} from "./cw.mjs";

async function withTempProject(fn) {
  const root = await mkdtemp(join(tmpdir(), "cyclewarden-project-os-"));
  try {
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function editJson(path, mutate) {
  const value = JSON.parse(await readFile(path, "utf8"));
  mutate(value);
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

test("greenfield scaffold creates one valid active shaping task", async () => {
  await withTempProject(async (root) => {
    await scaffoldProject(root, { mode: "greenfield", name: "Study Coach" });
    const model = await loadProject(root);

    assert.deepEqual(validateProject(model), []);
    assert.equal(model.project.mode, "greenfield");
    assert.equal(model.roadmap.tasks.length, 1);
    assert.equal(model.roadmap.tasks[0].status, "active");
    assert.equal(model.status.activeTaskId, "CW-001");

    const next = selectNextTask(model);
    assert.equal(next.task.id, "CW-001");
    assert.match(next.reason, /current active task/i);
  });
});

test("brownfield scaffold records adoption mode", async () => {
  await withTempProject(async (root) => {
    await scaffoldProject(root, { mode: "brownfield", name: "Existing App" });
    const model = await loadProject(root);

    assert.deepEqual(validateProject(model), []);
    assert.equal(model.project.mode, "brownfield");
    assert.match(model.roadmap.tasks[0].title, /Map current project truth/);
  });
});

test("validation rejects more than one active task", async () => {
  await withTempProject(async (root) => {
    const paths = await scaffoldProject(root, { mode: "greenfield", name: "Invalid App" });
    await editJson(paths.roadmap, (roadmap) => {
      roadmap.tasks.push({
        id: "CW-002",
        title: "Second active task",
        status: "active",
        dependsOn: [],
        acceptance: ["bounded"],
        requiredEvidence: ["test"],
      });
    });

    const errors = validateProject(await loadProject(root));
    assert.ok(errors.some((error) => error.includes("only one task may be active")));
  });
});

test("validation rejects dependency cycles", async () => {
  await withTempProject(async (root) => {
    const paths = await scaffoldProject(root, { mode: "greenfield", name: "Cyclic App" });
    await editJson(paths.roadmap, (roadmap) => {
      roadmap.tasks[0].status = "blocked";
      roadmap.tasks[0].dependsOn = ["CW-002"];
      roadmap.tasks.push({
        id: "CW-002",
        title: "Cyclic dependency",
        status: "blocked",
        dependsOn: ["CW-001"],
      });
    });
    await editJson(paths.status, (status) => {
      status.activeTaskId = null;
      status.blockedTaskIds = ["CW-001", "CW-002"];
    });

    const errors = validateProject(await loadProject(root));
    assert.ok(errors.some((error) => error.includes("dependency cycle detected")));
  });
});

test("next selects the first dependency-ready task when nothing is active", async () => {
  await withTempProject(async (root) => {
    const paths = await scaffoldProject(root, { mode: "greenfield", name: "Sequenced App" });
    await editJson(paths.roadmap, (roadmap) => {
      roadmap.tasks[0].status = "done";
      roadmap.tasks.push({
        id: "CW-002",
        title: "Build first vertical slice",
        status: "ready",
        dependsOn: ["CW-001"],
        acceptance: ["user can complete the first flow"],
        requiredEvidence: ["focused test"],
      });
      roadmap.tasks.push({
        id: "CW-003",
        title: "Add later capability",
        status: "blocked",
        dependsOn: ["CW-002"],
      });
    });
    await editJson(paths.status, (status) => {
      status.activeTaskId = null;
      status.lastCompletedTaskId = "CW-001";
      status.blockedTaskIds = ["CW-003"];
    });

    const model = await loadProject(root);
    assert.deepEqual(validateProject(model), []);

    const next = selectNextTask(model);
    assert.equal(next.task.id, "CW-002");
    assert.match(next.reason, /dependencies are complete/i);
  });
});

test("status surfaces human-only work and project blockers", async () => {
  await withTempProject(async (root) => {
    const paths = await scaffoldProject(root, { mode: "brownfield", name: "Manual Gate App" });
    await editJson(paths.roadmap, (roadmap) => {
      roadmap.tasks[0].humanOnly = true;
    });
    await editJson(paths.status, (status) => {
      status.blockers.push({
        taskId: "CW-001",
        type: "human-evidence",
        reason: "Requires a physical device.",
      });
      status.unresolvedDecisions.push("Choose the device.");
    });

    const model = await loadProject(root);
    assert.deepEqual(validateProject(model), []);

    const status = projectStatus(model);
    assert.equal(status.activeTask.humanOnly, true);
    assert.equal(status.blockers.length, 1);
    assert.deepEqual(status.unresolvedDecisions, ["Choose the device."]);
  });
});
