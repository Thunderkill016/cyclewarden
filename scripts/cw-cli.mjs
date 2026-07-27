#!/usr/bin/env node

import process from "node:process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  loadProject,
  runCli as runLegacyCli,
  validateProject as validateBaseProject,
} from "./cw.mjs";

const CURRENT_STATUSES = new Set(["active", "verify"]);

function currentTasks(model) {
  return model.roadmap.tasks.filter((task) => CURRENT_STATUSES.has(task.status));
}

export function validateProject(model) {
  const baseErrors = validateBaseProject(model).filter(
    (error) =>
      !error.startsWith("status.activeTaskId is ") &&
      !error.startsWith("status.activeTaskId must match active roadmap task "),
  );
  const tasks = currentTasks(model);
  const currentTaskId = model.status?.activeTaskId ?? null;

  if (tasks.length > 1) {
    baseErrors.push(
      `only one task may be current; found ${tasks.map((task) => `${task.id} [${task.status}]`).join(", ")}`,
    );
  }

  if (tasks.length === 0 && currentTaskId !== null) {
    baseErrors.push(
      `status.activeTaskId is ${currentTaskId}, but no roadmap task is active or verify`,
    );
  }

  if (tasks.length === 1 && currentTaskId !== tasks[0].id) {
    baseErrors.push(
      `status.activeTaskId must match current roadmap task ${tasks[0].id}`,
    );
  }

  return baseErrors;
}

export function selectNextTask(model) {
  const tasks = model.roadmap.tasks;
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const current = tasks.find((task) => CURRENT_STATUSES.has(task.status));

  if (current) {
    return {
      task: current,
      reason:
        current.status === "verify"
          ? "Continue verification and owner acceptance before starting another task."
          : "Continue the current active task before starting another task.",
    };
  }

  const ready = tasks.find(
    (task) =>
      task.status === "ready" &&
      (task.dependsOn ?? []).every(
        (dependency) => tasksById.get(dependency)?.status === "done",
      ),
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
      waitingOn: (task.dependsOn ?? []).filter(
        (dependency) => tasksById.get(dependency)?.status !== "done",
      ),
    }));

  return {
    task: null,
    reason:
      blocked.length === 0
        ? "All roadmap tasks are complete or dropped."
        : "No task is ready; unresolved dependencies or project decisions remain.",
    blocked,
  };
}

export function projectStatus(model) {
  const next = selectNextTask(model);
  const current = currentTasks(model)[0] ?? null;

  return {
    project: model.project.project.name,
    mode: model.project.mode,
    phase: model.status.phase,
    currentTask: current
      ? {
          id: current.id,
          title: current.title,
          status: current.status,
          humanOnly: Boolean(current.humanOnly),
        }
      : null,
    blockers: model.status.blockers,
    unresolvedDecisions: model.status.unresolvedDecisions,
    next: next.task
      ? { id: next.task.id, title: next.task.title, status: next.task.status, reason: next.reason }
      : next,
  };
}

function parseCli(argv) {
  const [command, ...rest] = argv;
  const options = { json: false };
  const positional = [];

  for (const value of rest) {
    if (value === "--json") options.json = true;
    else positional.push(value);
  }

  return { command, root: positional[0] ?? process.cwd(), options };
}

function printStatus(status) {
  console.log(`Project: ${status.project}`);
  console.log(`Mode: ${status.mode}`);
  console.log(`Phase: ${status.phase}`);
  console.log(
    `Current: ${
      status.currentTask
        ? `${status.currentTask.id} — ${status.currentTask.title} [${status.currentTask.status}]${
            status.currentTask.humanOnly ? " [human evidence]" : ""
          }`
        : "none"
    }`,
  );
  console.log(
    `Next: ${status.next.id ? `${status.next.id} — ${status.next.title}` : status.next.reason}`,
  );
  if (status.next.id) console.log(`Reason: ${status.next.reason}`);
}

function usage() {
  console.log(`CycleWarden Project OS pilot\n\nUsage:\n  pnpm cw -- init [root] --name "Project name"\n  pnpm cw -- adopt [root] --name "Project name"\n  pnpm cw -- validate [root]\n  pnpm cw -- status [root] [--json]\n  pnpm cw -- next [root] [--json]\n`);
}

export async function runCli(argv = process.argv.slice(2)) {
  const [command] = argv;

  if (command === "init" || command === "adopt") {
    return runLegacyCli(argv);
  }

  if (!command || new Set(["help", "--help", "-h"]).has(command)) {
    usage();
    return 0;
  }

  const { root, options } = parseCli(argv);
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
    else printStatus(status);
    return 0;
  }

  if (command === "next") {
    const result = selectNextTask(model);
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else if (result.task) {
      console.log(`${result.task.id} — ${result.task.title} [${result.task.status}]`);
      console.log(result.reason);
    } else {
      console.log(result.reason);
    }
    return 0;
  }

  usage();
  return 1;
}

const invokedDirectly =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedDirectly) {
  runCli()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
