#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const SCHEMA_VERSION = 1;
const PROJECT_DIR = ".cyclewarden";
const ALLOWED_STATUSES = new Set([
  "proposed",
  "ready",
  "active",
  "verify",
  "blocked",
  "done",
  "dropped",
]);

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJson(path) {
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    throw new Error(`Cannot read ${path}: ${error.message}`);
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON in ${path}: ${error.message}`);
  }
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function projectPaths(root) {
  const directory = join(resolve(root), PROJECT_DIR);
  return {
    root: resolve(root),
    directory,
    project: join(directory, "project.json"),
    roadmap: join(directory, "roadmap.json"),
    status: join(directory, "status.json"),
    readme: join(directory, "README.md"),
  };
}

function scaffoldData(mode, name) {
  const projectName = nonEmptyString(name) ? name.trim() : "Unnamed project";
  const firstTask = mode === "brownfield"
    ? {
        id: "CW-001",
        title: "Map current project truth and active constraints",
        status: "active",
        dependsOn: [],
        source: "CycleWarden adoption scaffold",
        acceptance: [
          "current product purpose is grounded in repository evidence",
          "foundation decisions and invariants are recorded",
          "unfinished work and blockers are represented without guessing",
          "one next implementation task can be selected",
        ],
        requiredEvidence: [
          ".cyclewarden/project.json",
          ".cyclewarden/roadmap.json",
          ".cyclewarden/status.json",
        ],
      }
    : {
        id: "CW-001",
        title: "Shape the first useful vertical slice",
        status: "active",
        dependsOn: [],
        source: "CycleWarden greenfield scaffold",
        acceptance: [
          "target user and problem are explicit",
          "the first useful end-to-end flow is bounded",
          "non-goals prevent premature feature expansion",
          "only decisions required by the first slice are selected",
        ],
        requiredEvidence: [
          ".cyclewarden/project.json",
          ".cyclewarden/roadmap.json",
          ".cyclewarden/status.json",
        ],
      };

  return {
    project: {
      schemaVersion: SCHEMA_VERSION,
      mode,
      project: {
        id: projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project",
        name: projectName,
        mission: "Describe the user outcome this project exists to create.",
        targetUser: "Describe one primary user.",
        currentPhase: mode === "brownfield" ? "adoption" : "shaping",
        firstCriticalFlow: [],
        priorities: [],
        nonGoals: [],
      },
      foundation: {
        frontend: "unknown",
        data: "unknown",
        authentication: "unknown",
        validation: "unknown",
        testing: [],
        deployment: "unknown",
      },
      invariants: [],
      sources: [],
      unknowns: [],
    },
    roadmap: {
      schemaVersion: SCHEMA_VERSION,
      tasks: [firstTask],
    },
    status: {
      schemaVersion: SCHEMA_VERSION,
      phase: mode === "brownfield" ? "adoption" : "shaping",
      activeTaskId: firstTask.id,
      lastCompletedTaskId: null,
      blockedTaskIds: [],
      blockers: [],
      unresolvedDecisions: [],
      next: {
        taskId: firstTask.id,
        reason: "Continue the current active task before starting new work.",
      },
      ownerSummary: {
        whatIsBeingBuilt: "Not established yet.",
        whyThisTaskNow: "The project must be shaped or mapped before implementation expands.",
        whatNotToDo: "Do not start unrelated implementation or silently choose foundation technology.",
        whatComesAfter: "Select the first dependency-ready vertical slice.",
      },
    },
  };
}

export async function scaffoldProject(root, { mode, name }) {
  if (!new Set(["greenfield", "brownfield"]).has(mode)) {
    throw new Error(`Unsupported scaffold mode: ${mode}`);
  }

  const paths = projectPaths(root);
  if (await fileExists(paths.directory)) {
    throw new Error(`${paths.directory} already exists; refusing to overwrite project state.`);
  }

  const data = scaffoldData(mode, name);
  await mkdir(paths.directory, { recursive: true });
  await writeJson(paths.project, data.project);
  await writeJson(paths.roadmap, data.roadmap);
  await writeJson(paths.status, data.status);
  await writeFile(
    paths.readme,
    `# CycleWarden project state\n\nMode: ${mode}\n\nEdit the JSON artifacts with repository-grounded facts. Run \`pnpm cw -- validate ${paths.root}\` before relying on status or next-task selection.\n`,
    "utf8",
  );

  return paths;
}

export async function loadProject(root) {
  const paths = projectPaths(root);
  const [project, roadmap, status] = await Promise.all([
    readJson(paths.project),
    readJson(paths.roadmap),
    readJson(paths.status),
  ]);
  return { paths, project, roadmap, status };
}

function findDependencyCycle(tasksById) {
  const visiting = new Set();
  const visited = new Set();

  function visit(id, trail) {
    if (visiting.has(id)) {
      const start = trail.indexOf(id);
      return [...trail.slice(start), id];
    }
    if (visited.has(id)) return null;

    visiting.add(id);
    const task = tasksById.get(id);
    for (const dependency of task?.dependsOn ?? []) {
      if (!tasksById.has(dependency)) continue;
      const cycle = visit(dependency, [...trail, id]);
      if (cycle) return cycle;
    }
    visiting.delete(id);
    visited.add(id);
    return null;
  }

  for (const id of tasksById.keys()) {
    const cycle = visit(id, []);
    if (cycle) return cycle;
  }
  return null;
}

export function validateProject(model) {
  const errors = [];
  const { project, roadmap, status } = model;

  if (project?.schemaVersion !== SCHEMA_VERSION) {
    errors.push(`project.json schemaVersion must be ${SCHEMA_VERSION}`);
  }
  if (!nonEmptyString(project?.project?.id)) errors.push("project.project.id is required");
  if (!nonEmptyString(project?.project?.name)) errors.push("project.project.name is required");
  if (!new Set(["greenfield", "brownfield"]).has(project?.mode)) {
    errors.push("project.mode must be greenfield or brownfield");
  }

  if (roadmap?.schemaVersion !== SCHEMA_VERSION) {
    errors.push(`roadmap.json schemaVersion must be ${SCHEMA_VERSION}`);
  }
  if (!Array.isArray(roadmap?.tasks) || roadmap.tasks.length === 0) {
    errors.push("roadmap.tasks must contain at least one task");
    return errors;
  }

  if (status?.schemaVersion !== SCHEMA_VERSION) {
    errors.push(`status.json schemaVersion must be ${SCHEMA_VERSION}`);
  }

  const tasksById = new Map();
  for (const [index, task] of roadmap.tasks.entries()) {
    const prefix = `roadmap.tasks[${index}]`;
    if (!nonEmptyString(task?.id)) {
      errors.push(`${prefix}.id is required`);
      continue;
    }
    if (tasksById.has(task.id)) errors.push(`duplicate task id: ${task.id}`);
    tasksById.set(task.id, task);

    if (!nonEmptyString(task.title)) errors.push(`${task.id}.title is required`);
    if (!ALLOWED_STATUSES.has(task.status)) {
      errors.push(`${task.id}.status must be one of ${[...ALLOWED_STATUSES].join(", ")}`);
    }
    if (!Array.isArray(task.dependsOn)) errors.push(`${task.id}.dependsOn must be an array`);

    if (new Set(["ready", "active", "verify", "done"]).has(task.status)) {
      if (!Array.isArray(task.acceptance) || task.acceptance.length === 0) {
        errors.push(`${task.id}.acceptance is required for status ${task.status}`);
      }
      if (!Array.isArray(task.requiredEvidence) || task.requiredEvidence.length === 0) {
        errors.push(`${task.id}.requiredEvidence is required for status ${task.status}`);
      }
    }
  }

  for (const task of tasksById.values()) {
    for (const dependency of task.dependsOn ?? []) {
      if (dependency === task.id) errors.push(`${task.id} cannot depend on itself`);
      if (!tasksById.has(dependency)) errors.push(`${task.id} depends on missing task ${dependency}`);
    }
  }

  const cycle = findDependencyCycle(tasksById);
  if (cycle) errors.push(`dependency cycle detected: ${cycle.join(" -> ")}`);

  const activeTasks = [...tasksById.values()].filter((task) => task.status === "active");
  if (activeTasks.length > 1) {
    errors.push(`only one task may be active; found ${activeTasks.map((task) => task.id).join(", ")}`);
  }

  const activeTaskId = status?.activeTaskId ?? null;
  if (activeTasks.length === 0 && activeTaskId !== null) {
    errors.push(`status.activeTaskId is ${activeTaskId}, but no roadmap task is active`);
  }
  if (activeTasks.length === 1 && activeTaskId !== activeTasks[0].id) {
    errors.push(`status.activeTaskId must match active roadmap task ${activeTasks[0].id}`);
  }
  if (activeTaskId !== null && !tasksById.has(activeTaskId)) {
    errors.push(`status.activeTaskId references missing task ${activeTaskId}`);
  }

  for (const task of tasksById.values()) {
    if (!new Set(["ready", "active", "verify"]).has(task.status)) continue;
    const incomplete = (task.dependsOn ?? []).filter((dependency) => tasksById.get(dependency)?.status !== "done");
    if (incomplete.length > 0) {
      errors.push(`${task.id} is ${task.status} but dependencies are not done: ${incomplete.join(", ")}`);
    }
  }

  if (!Array.isArray(status?.blockedTaskIds)) errors.push("status.blockedTaskIds must be an array");
  for (const id of status?.blockedTaskIds ?? []) {
    if (!tasksById.has(id)) errors.push(`status.blockedTaskIds references missing task ${id}`);
  }
  if (!Array.isArray(status?.blockers)) errors.push("status.blockers must be an array");
  if (!Array.isArray(status?.unresolvedDecisions)) errors.push("status.unresolvedDecisions must be an array");

  return errors;
}

export function selectNextTask(model) {
  const tasks = model.roadmap.tasks;
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const active = tasks.find((task) => task.status === "active");
  if (active) {
    return {
      task: active,
      reason: "Continue the current active task before starting another task.",
    };
  }

  const ready = tasks.find(
    (task) => task.status === "ready" && (task.dependsOn ?? []).every((id) => tasksById.get(id)?.status === "done"),
  );
  if (ready) {
    return {
      task: ready,
      reason: "This is the first ready task whose dependencies are complete.",
    };
  }

  const blocked = tasks
    .filter((task) => !new Set(["done", "dropped"]).has(task.status))
    .map((task) => ({
      id: task.id,
      status: task.status,
      waitingOn: (task.dependsOn ?? []).filter((id) => tasksById.get(id)?.status !== "done"),
    }));

  return {
    task: null,
    reason: blocked.length === 0 ? "All roadmap tasks are complete or dropped." : "No task is ready; unresolved dependencies or project decisions remain.",
    blocked,
  };
}

export function projectStatus(model) {
  const next = selectNextTask(model);
  const active = model.roadmap.tasks.find((task) => task.status === "active") ?? null;
  return {
    project: model.project.project.name,
    mode: model.project.mode,
    phase: model.status.phase,
    activeTask: active ? { id: active.id, title: active.title, humanOnly: Boolean(active.humanOnly) } : null,
    blockers: model.status.blockers,
    unresolvedDecisions: model.status.unresolvedDecisions,
    next: next.task ? { id: next.task.id, title: next.task.title, reason: next.reason } : next,
  };
}

function parseCli(argv) {
  const [command, ...rest] = argv;
  const options = { json: false, name: undefined };
  const positional = [];

  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (value === "--json") {
      options.json = true;
    } else if (value === "--name") {
      options.name = rest[index + 1];
      index += 1;
    } else {
      positional.push(value);
    }
  }

  return { command, root: positional[0] ?? process.cwd(), options };
}

function printHumanStatus(status) {
  console.log(`Project: ${status.project}`);
  console.log(`Mode: ${status.mode}`);
  console.log(`Phase: ${status.phase}`);
  console.log(`Active: ${status.activeTask ? `${status.activeTask.id} — ${status.activeTask.title}${status.activeTask.humanOnly ? " [human evidence]" : ""}` : "none"}`);
  console.log(`Next: ${status.next.id ? `${status.next.id} — ${status.next.title}` : status.next.reason}`);
  if (status.next.reason && status.next.id) console.log(`Reason: ${status.next.reason}`);
  if (status.blockers.length > 0) {
    console.log("Blockers:");
    for (const blocker of status.blockers) console.log(`- ${blocker.taskId ?? "project"}: ${blocker.reason}`);
  }
  if (status.unresolvedDecisions.length > 0) {
    console.log("Unresolved decisions:");
    for (const decision of status.unresolvedDecisions) console.log(`- ${decision}`);
  }
}

function usage() {
  console.log(`CycleWarden Project OS pilot\n\nUsage:\n  pnpm cw -- init [root] --name "Project name"\n  pnpm cw -- adopt [root] --name "Project name"\n  pnpm cw -- validate [root]\n  pnpm cw -- status [root] [--json]\n  pnpm cw -- next [root] [--json]\n`);
}

export async function runCli(argv = process.argv.slice(2)) {
  const { command, root, options } = parseCli(argv);

  if (!command || command === "help" || command === "--help" || command === "-h") {
    usage();
    return 0;
  }

  if (command === "init" || command === "adopt") {
    const mode = command === "init" ? "greenfield" : "brownfield";
    const paths = await scaffoldProject(root, { mode, name: options.name });
    console.log(`Created ${mode} CycleWarden state at ${paths.directory}`);
    console.log("Fill the repository-grounded project facts, then run validate.");
    return 0;
  }

  const model = await loadProject(root);
  const errors = validateProject(model);
  if (errors.length > 0) {
    console.error("CycleWarden project state is invalid:");
    for (const error of errors) console.error(`- ${error}`);
    return 1;
  }

  if (command === "validate") {
    console.log(`CycleWarden project state is valid: ${model.project.project.name}`);
    return 0;
  }

  if (command === "status") {
    const status = projectStatus(model);
    if (options.json) console.log(JSON.stringify(status, null, 2));
    else printHumanStatus(status);
    return 0;
  }

  if (command === "next") {
    const result = selectNextTask(model);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.task) {
      console.log(`${result.task.id} — ${result.task.title}`);
      console.log(result.reason);
    } else {
      console.log(result.reason);
      for (const item of result.blocked ?? []) {
        console.log(`- ${item.id} [${item.status}]${item.waitingOn.length > 0 ? ` waiting on ${item.waitingOn.join(", ")}` : ""}`);
      }
    }
    return 0;
  }

  usage();
  return 1;
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedDirectly) {
  runCli().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
