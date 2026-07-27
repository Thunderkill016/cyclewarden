#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { loadProject } from "./cw.mjs";
import {
  projectStatus as lifecycleProjectStatus,
  runCli as runLifecycleCli,
  selectNextTask as selectLifecycleNextTask,
  validateProject as validateLifecycleProject,
} from "./cw-cli.mjs";

const ASSESSMENT_SCHEMA_VERSION = 1;
const ASSESSMENT_DECISIONS = new Set([
  "pending",
  "build",
  "use-existing",
  "manual",
  "stop",
]);
const IMPLEMENTATION_STATUSES = new Set(["ready", "active", "verify"]);

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function assessmentPath(root) {
  return join(resolve(root), ".cyclewarden", "assessment.json");
}

async function readJson(path) {
  let source;
  try {
    source = await readFile(path, "utf8");
  } catch (error) {
    throw new Error(`Cannot read ${path}: ${error.message}`);
  }

  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`Invalid JSON in ${path}: ${error.message}`);
  }
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function createAssessmentScaffold(mode) {
  return {
    schemaVersion: ASSESSMENT_SCHEMA_VERSION,
    problem: {
      statement: "Describe the repeated problem in observable terms.",
      frequencyEvidence: "unknown",
      currentWorkaround: "Describe how the owner handles the problem today.",
      workaroundCost: "unknown",
    },
    existingSolutions: [],
    manualTest: {
      status: "not-run",
      method: "Describe the smallest no-code or manual test that could disprove the need to build.",
      result: "unknown",
    },
    usageCost: {
      interactionCost: "unknown",
      maintenanceCost: "unknown",
    },
    killCriteria: [
      "an existing product solves the problem adequately",
      "a manual workflow is good enough",
      "the problem is too infrequent or low-cost",
      "expected usage friction exceeds the demonstrated benefit",
    ],
    decision: {
      value: "pending",
      reason:
        mode === "brownfield"
          ? "Decide whether further project investment is justified before activating new implementation work."
          : "Assess necessity before shaping or implementing a custom product.",
      decidedAt: null,
    },
    buildEvidence: [],
  };
}

function parseRoot(argv) {
  const candidate = argv[1];
  return candidate && !candidate.startsWith("--") ? candidate : process.cwd();
}

async function applyAssessmentScaffold(root, mode) {
  const directory = join(resolve(root), ".cyclewarden");
  const roadmapPath = join(directory, "roadmap.json");
  const statusPath = join(directory, "status.json");
  const [roadmap, status] = await Promise.all([
    readJson(roadmapPath),
    readJson(statusPath),
  ]);

  for (const task of roadmap.tasks ?? []) {
    if (IMPLEMENTATION_STATUSES.has(task.status)) task.status = "proposed";
  }

  status.phase = "assessment";
  status.activeTaskId = null;
  status.blockedTaskIds = [];
  status.blockers = [];
  status.unresolvedDecisions = [
    "Complete the build-or-not assessment and record an explicit decision.",
  ];
  status.next = {
    taskId: null,
    reason: "Assessment is pending. No implementation task may start.",
  };
  status.ownerSummary = {
    whatIsBeingBuilt: "Not decided yet.",
    whyThisTaskNow: "The project must prove that building is better than using an existing or manual solution.",
    whatNotToDo: "Do not activate implementation, choose a stack or expand the roadmap before the assessment decision is build.",
    whatComesAfter: "Choose build, use-existing, manual or stop from evidence. Only build unlocks implementation tasks.",
  };

  await Promise.all([
    writeJson(assessmentPath(root), createAssessmentScaffold(mode)),
    writeJson(roadmapPath, roadmap),
    writeJson(statusPath, status),
  ]);
}

export async function scaffoldAssessedProject(root, options) {
  const command = options.mode === "brownfield" ? "adopt" : "init";
  const argv = [command, root, "--name", options.name ?? "Unnamed project"];
  const result = await runLifecycleCli(argv);
  if (result !== 0) return result;
  await applyAssessmentScaffold(root, options.mode);
  return 0;
}

export async function loadAssessedProject(root) {
  const [model, assessment] = await Promise.all([
    loadProject(root),
    readJson(assessmentPath(root)),
  ]);
  return { ...model, assessment };
}

export function validateAssessment(model) {
  const errors = [];
  const assessment = model.assessment;

  if (assessment?.schemaVersion !== ASSESSMENT_SCHEMA_VERSION) {
    errors.push(`assessment.json schemaVersion must be ${ASSESSMENT_SCHEMA_VERSION}`);
  }
  if (!nonEmptyString(assessment?.problem?.statement)) {
    errors.push("assessment.problem.statement is required");
  }
  if (!nonEmptyString(assessment?.problem?.currentWorkaround)) {
    errors.push("assessment.problem.currentWorkaround is required");
  }
  if (!Array.isArray(assessment?.existingSolutions)) {
    errors.push("assessment.existingSolutions must be an array");
  }
  if (!assessment?.manualTest || typeof assessment.manualTest !== "object") {
    errors.push("assessment.manualTest is required");
  }
  if (!Array.isArray(assessment?.killCriteria) || assessment.killCriteria.length === 0) {
    errors.push("assessment.killCriteria must contain at least one criterion");
  }

  const decision = assessment?.decision?.value;
  if (!ASSESSMENT_DECISIONS.has(decision)) {
    errors.push(
      `assessment.decision.value must be one of ${[...ASSESSMENT_DECISIONS].join(", ")}`,
    );
  }
  if (!nonEmptyString(assessment?.decision?.reason)) {
    errors.push("assessment.decision.reason is required");
  }
  if (decision === "build") {
    if (!Array.isArray(assessment?.buildEvidence) || assessment.buildEvidence.length === 0) {
      errors.push("assessment.buildEvidence is required when decision is build");
    }
  }

  if (decision !== "build") {
    const implementationTasks = (model.roadmap?.tasks ?? []).filter((task) =>
      IMPLEMENTATION_STATUSES.has(task.status),
    );
    if (implementationTasks.length > 0) {
      errors.push(
        `assessment decision ${decision ?? "unknown"} cannot have implementation tasks: ${implementationTasks
          .map((task) => `${task.id} [${task.status}]`)
          .join(", ")}`,
      );
    }
    if ((model.status?.activeTaskId ?? null) !== null) {
      errors.push("status.activeTaskId must be null unless assessment decision is build");
    }
  }

  return errors;
}

export function validateProject(model) {
  return [...validateLifecycleProject(model), ...validateAssessment(model)];
}

function assessmentStopReason(assessment) {
  const decision = assessment.decision.value;
  if (decision === "pending") {
    return "Assessment is pending. Compare existing solutions and run the smallest manual test before building.";
  }
  if (decision === "use-existing") {
    return `Use an existing solution instead of building. ${assessment.decision.reason}`;
  }
  if (decision === "manual") {
    return `Keep the manual workflow; no implementation task is valid. ${assessment.decision.reason}`;
  }
  return `Project stopped by assessment decision. ${assessment.decision.reason}`;
}

export function selectNextTask(model) {
  if (model.assessment.decision.value !== "build") {
    return {
      task: null,
      reason: assessmentStopReason(model.assessment),
      assessmentDecision: model.assessment.decision.value,
    };
  }
  return selectLifecycleNextTask(model);
}

export function projectStatus(model) {
  const decision = model.assessment.decision.value;
  if (decision === "build") {
    return {
      ...lifecycleProjectStatus(model),
      assessment: model.assessment.decision,
    };
  }

  return {
    project: model.project.project.name,
    mode: model.project.mode,
    phase: model.status.phase,
    assessment: model.assessment.decision,
    currentTask: null,
    blockers: model.status.blockers,
    unresolvedDecisions: model.status.unresolvedDecisions,
    next: selectNextTask(model),
  };
}

function printAssessment(assessment) {
  console.log(`Decision: ${assessment.decision.value}`);
  console.log(`Reason: ${assessment.decision.reason}`);
  console.log(`Problem: ${assessment.problem.statement}`);
  console.log(`Current workaround: ${assessment.problem.currentWorkaround}`);
  console.log(`Manual test: ${assessment.manualTest.status} — ${assessment.manualTest.method}`);
  console.log(`Existing solutions reviewed: ${assessment.existingSolutions.length}`);
  console.log(`Build evidence items: ${assessment.buildEvidence.length}`);
}

function printStatus(status) {
  console.log(`Project: ${status.project}`);
  console.log(`Mode: ${status.mode}`);
  console.log(`Phase: ${status.phase}`);
  console.log(`Assessment: ${status.assessment.value}`);
  console.log(`Current: ${status.currentTask ? `${status.currentTask.id} — ${status.currentTask.title} [${status.currentTask.status}]` : "none"}`);
  console.log(`Next: ${status.next.id ? `${status.next.id} — ${status.next.title}` : status.next.reason}`);
}

function parseCli(argv) {
  const [command, ...rest] = argv;
  const options = { json: false };
  const positional = [];
  for (const value of rest) {
    if (value === "--json") options.json = true;
    else if (value === "--name") break;
    else positional.push(value);
  }
  return { command, root: positional[0] ?? process.cwd(), options };
}

function usage() {
  console.log(`CycleWarden Project OS pilot\n\nUsage:\n  pnpm cw -- init [root] --name "Project name"\n  pnpm cw -- adopt [root] --name "Project name"\n  pnpm cw -- assess [root] [--json]\n  pnpm cw -- validate [root]\n  pnpm cw -- status [root] [--json]\n  pnpm cw -- next [root] [--json]\n`);
}

export async function runCli(argv = process.argv.slice(2)) {
  const [command] = argv;

  if (command === "init" || command === "adopt") {
    const result = await runLifecycleCli(argv);
    if (result !== 0) return result;
    await applyAssessmentScaffold(
      parseRoot(argv),
      command === "adopt" ? "brownfield" : "greenfield",
    );
    console.log("Build-or-not assessment created. Implementation remains locked until decision is build.");
    return 0;
  }

  if (!command || new Set(["help", "--help", "-h"]).has(command)) {
    usage();
    return 0;
  }

  const { root, options } = parseCli(argv);
  const model = await loadAssessedProject(root);
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
  if (command === "assess") {
    if (options.json) console.log(JSON.stringify(model.assessment, null, 2));
    else printAssessment(model.assessment);
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
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

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
