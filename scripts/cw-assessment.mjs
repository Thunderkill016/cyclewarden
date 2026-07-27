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
  "existing-project",
]);
const ASSESSMENT_SCOPES = new Set([
  "greenfield-project",
  "existing-project-adoption",
]);
const EVIDENCE_TYPES = new Set([
  "owner-observation",
  "user-research",
  "repository",
  "analytics",
  "support-log",
  "manual-test",
  "existing-solution",
  "external-method",
  "inference",
]);
const DIRECT_PRODUCT_EVIDENCE = new Set([
  "owner-observation",
  "user-research",
  "repository",
  "analytics",
  "support-log",
  "manual-test",
]);
const IMPLEMENTATION_STATUSES = new Set(["ready", "active", "verify"]);
const UNLOCKING_DECISIONS = new Set(["build", "existing-project"]);

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

function greenfieldAssessment() {
  return {
    schemaVersion: ASSESSMENT_SCHEMA_VERSION,
    scope: "greenfield-project",
    methodSources: [
      "docs/project-os/EVIDENCE_BASE.md",
      "docs/project-os/ASSESSMENT_PROTOCOL.md",
    ],
    evidence: [],
    problem: {
      statement: "Describe the repeated problem in observable terms.",
      currentWorkaround: "Describe how the user handles the problem today.",
      frequency: "unknown",
      currentCost: "unknown",
    },
    existingSolutions: [],
    manualTest: {
      status: "not-run",
      method: "Describe the cheapest reliable no-code or manual test.",
      result: "unknown",
      evidenceIds: [],
      exemptionReason: null,
    },
    successMeasures: [],
    appetite: {
      value: "unknown",
      reason: "unknown",
    },
    usageCost: {
      interactionCost: "unknown",
      maintenanceCost: "unknown",
    },
    noGos: [],
    killCriteria: [
      "an existing product solves the problem adequately",
      "a manual workflow is good enough",
      "the problem is too infrequent or low-cost",
      "expected usage friction exceeds the demonstrated benefit",
    ],
    decision: {
      value: "pending",
      reason: "Assessment evidence is incomplete.",
      evidenceIds: [],
      decidedAt: null,
    },
  };
}

function brownfieldAssessment() {
  return {
    schemaVersion: ASSESSMENT_SCHEMA_VERSION,
    scope: "existing-project-adoption",
    methodSources: [
      "docs/project-os/EVIDENCE_BASE.md",
      "docs/project-os/ASSESSMENT_PROTOCOL.md",
    ],
    evidence: [
      {
        id: "E1",
        type: "repository",
        source: ".",
        claim: "The owner explicitly adopted an existing repository into CycleWarden.",
        observedAt: null,
      },
    ],
    problem: {
      statement: "Recover current project truth and unfinished work from repository evidence.",
      currentWorkaround: "Coding-agent sessions inspect the repository independently and may lose project sequencing.",
      frequency: "existing repository",
      currentCost: "unknown until adoption is mapped",
    },
    existingSolutions: [],
    manualTest: {
      status: "exempt",
      method: "Not applicable to existence of an already-running repository.",
      result: "CycleWarden will map current work without validating a new broad initiative.",
      evidenceIds: ["E1"],
      exemptionReason: "The project already exists; future major initiatives still require their own assessment.",
    },
    successMeasures: [
      "a fresh session can recover current project purpose, blocker, and next valid task",
    ],
    appetite: {
      value: "repository mapping only",
      reason: "Adoption must not silently authorize a redesign or new platform initiative.",
    },
    usageCost: {
      interactionCost: "maintain a small repository-local state model",
      maintenanceCost: "must remain lower than ordinary issue and AGENTS.md workflows",
    },
    noGos: [
      "treat existing-project adoption as proof that a new broad initiative is valuable",
    ],
    killCriteria: [
      "project state requires more maintenance than the continuity it provides",
      "AGENTS.md plus ordinary issues provides the same result",
    ],
    decision: {
      value: "existing-project",
      reason: "Adopt the existing repository and recover current work from repository evidence.",
      evidenceIds: ["E1"],
      decidedAt: null,
    },
  };
}

function createAssessmentScaffold(mode) {
  return mode === "brownfield" ? brownfieldAssessment() : greenfieldAssessment();
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

  if (mode === "greenfield") {
    for (const task of roadmap.tasks ?? []) {
      if (IMPLEMENTATION_STATUSES.has(task.status)) task.status = "proposed";
    }

    status.phase = "assessment";
    status.activeTaskId = null;
    status.blockedTaskIds = [];
    status.blockers = [];
    status.unresolvedDecisions = [
      "Complete the evidence-backed build-or-not assessment.",
    ];
    status.next = {
      taskId: null,
      reason: "Assessment is pending. No implementation task may start.",
    };
    status.ownerSummary = {
      whatIsBeingBuilt: "Not decided yet.",
      whyThisTaskNow: "The project must prove that software is better than an existing or manual solution.",
      whatNotToDo: "Do not activate implementation, choose a stack, or expand the roadmap before the assessment decision is build.",
      whatComesAfter: "Choose build, use-existing, manual, or stop from traceable evidence.",
    };
  }

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

function validateEvidence(assessment, errors) {
  if (!Array.isArray(assessment?.evidence)) {
    errors.push("assessment.evidence must be an array");
    return new Map();
  }

  const byId = new Map();
  for (const [index, item] of assessment.evidence.entries()) {
    const prefix = `assessment.evidence[${index}]`;
    if (!nonEmptyString(item?.id)) {
      errors.push(`${prefix}.id is required`);
      continue;
    }
    if (byId.has(item.id)) errors.push(`duplicate assessment evidence id: ${item.id}`);
    byId.set(item.id, item);
    if (!EVIDENCE_TYPES.has(item.type)) {
      errors.push(`${item.id}.type must be one of ${[...EVIDENCE_TYPES].join(", ")}`);
    }
    if (!nonEmptyString(item.source)) errors.push(`${item.id}.source is required`);
    if (!nonEmptyString(item.claim)) errors.push(`${item.id}.claim is required`);
  }
  return byId;
}

function validateExistingSolutions(assessment, errors) {
  if (!Array.isArray(assessment?.existingSolutions)) {
    errors.push("assessment.existingSolutions must be an array");
    return;
  }
  for (const [index, solution] of assessment.existingSolutions.entries()) {
    const prefix = `assessment.existingSolutions[${index}]`;
    if (!nonEmptyString(solution?.name)) errors.push(`${prefix}.name is required`);
    if (!nonEmptyString(solution?.source)) errors.push(`${prefix}.source is required`);
    if (!nonEmptyString(solution?.fit)) errors.push(`${prefix}.fit is required`);
    if (!nonEmptyString(solution?.limitation)) errors.push(`${prefix}.limitation is required`);
  }
}

function evidenceIdsExist(ids, byId, field, errors) {
  if (!Array.isArray(ids)) {
    errors.push(`${field} must be an array`);
    return [];
  }
  for (const id of ids) {
    if (!byId.has(id)) errors.push(`${field} references missing evidence ${id}`);
  }
  return ids.filter((id) => byId.has(id));
}

export function validateAssessment(model) {
  const errors = [];
  const assessment = model.assessment;

  if (assessment?.schemaVersion !== ASSESSMENT_SCHEMA_VERSION) {
    errors.push(`assessment.json schemaVersion must be ${ASSESSMENT_SCHEMA_VERSION}`);
  }
  if (!ASSESSMENT_SCOPES.has(assessment?.scope)) {
    errors.push(`assessment.scope must be one of ${[...ASSESSMENT_SCOPES].join(", ")}`);
  }
  if (!Array.isArray(assessment?.methodSources) || assessment.methodSources.length === 0) {
    errors.push("assessment.methodSources must reference the evidence policy and protocol");
  }
  if (!nonEmptyString(assessment?.problem?.statement)) {
    errors.push("assessment.problem.statement is required");
  }
  if (!nonEmptyString(assessment?.problem?.currentWorkaround)) {
    errors.push("assessment.problem.currentWorkaround is required");
  }

  const evidenceById = validateEvidence(assessment, errors);
  validateExistingSolutions(assessment, errors);

  if (!assessment?.manualTest || typeof assessment.manualTest !== "object") {
    errors.push("assessment.manualTest is required");
  }
  if (!Array.isArray(assessment?.successMeasures)) {
    errors.push("assessment.successMeasures must be an array");
  }
  if (!nonEmptyString(assessment?.appetite?.value)) {
    errors.push("assessment.appetite.value is required");
  }
  if (!Array.isArray(assessment?.noGos)) errors.push("assessment.noGos must be an array");
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
  const decisionEvidenceIds = evidenceIdsExist(
    assessment?.decision?.evidenceIds,
    evidenceById,
    "assessment.decision.evidenceIds",
    errors,
  );

  if (decision === "existing-project") {
    if (model.project?.mode !== "brownfield") {
      errors.push("existing-project decision is only valid for brownfield mode");
    }
    const hasRepositoryEvidence = decisionEvidenceIds.some(
      (id) => evidenceById.get(id)?.type === "repository",
    );
    if (!hasRepositoryEvidence) {
      errors.push("existing-project decision requires repository evidence");
    }
  }

  if (decision === "build") {
    if (assessment?.scope !== "greenfield-project") {
      errors.push("build decision currently applies only to greenfield-project assessment");
    }
    if (assessment.existingSolutions.length === 0) {
      errors.push("build decision requires review of at least one existing or simpler solution");
    }
    const manualStatus = assessment?.manualTest?.status;
    if (!new Set(["completed", "exempt"]).has(manualStatus)) {
      errors.push("build decision requires a completed manual test or documented exemption");
    }
    if (manualStatus === "completed") {
      const manualIds = evidenceIdsExist(
        assessment.manualTest.evidenceIds,
        evidenceById,
        "assessment.manualTest.evidenceIds",
        errors,
      );
      if (!manualIds.some((id) => evidenceById.get(id)?.type === "manual-test")) {
        errors.push("completed manual test must reference manual-test evidence");
      }
    }
    if (manualStatus === "exempt" && !nonEmptyString(assessment.manualTest.exemptionReason)) {
      errors.push("manual-test exemption requires exemptionReason");
    }
    if (assessment.successMeasures.length === 0) {
      errors.push("build decision requires at least one success measure");
    }
    if (assessment.appetite.value === "unknown") {
      errors.push("build decision requires an explicit appetite");
    }
    const directEvidence = decisionEvidenceIds.some((id) =>
      DIRECT_PRODUCT_EVIDENCE.has(evidenceById.get(id)?.type),
    );
    if (!directEvidence) {
      errors.push("build decision requires direct product evidence; inference or method guidance alone is insufficient");
    }
  }

  if (!UNLOCKING_DECISIONS.has(decision)) {
    const currentTasks = (model.roadmap?.tasks ?? []).filter((task) =>
      IMPLEMENTATION_STATUSES.has(task.status),
    );
    if (currentTasks.length > 0) {
      errors.push(
        `assessment decision ${decision ?? "unknown"} cannot have implementation tasks: ${currentTasks
          .map((task) => `${task.id} [${task.status}]`)
          .join(", ")}`,
      );
    }
    if ((model.status?.activeTaskId ?? null) !== null) {
      errors.push("status.activeTaskId must be null unless assessment permits implementation");
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
    return "Assessment is pending. Gather product evidence, review simpler solutions, and run the cheapest reliable test before building.";
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
  if (!UNLOCKING_DECISIONS.has(model.assessment.decision.value)) {
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
  if (UNLOCKING_DECISIONS.has(decision)) {
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
  console.log(`Evidence items: ${assessment.evidence.length}`);
  console.log(`Existing solutions reviewed: ${assessment.existingSolutions.length}`);
  console.log(`Manual test: ${assessment.manualTest.status} — ${assessment.manualTest.method}`);
  console.log(`Success measures: ${assessment.successMeasures.length}`);
}

function printStatus(status) {
  console.log(`Project: ${status.project}`);
  console.log(`Mode: ${status.mode}`);
  console.log(`Phase: ${status.phase}`);
  console.log(`Assessment: ${status.assessment.value}`);
  console.log(
    `Current: ${
      status.currentTask
        ? `${status.currentTask.id} — ${status.currentTask.title} [${status.currentTask.status}]`
        : "none"
    }`,
  );
  console.log(
    `Next: ${status.next.id ? `${status.next.id} — ${status.next.title}` : status.next.reason}`,
  );
}

function parseCli(argv) {
  const [command, ...rest] = argv;
  const options = { json: false };
  const positional = [];
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (value === "--json") options.json = true;
    else if (value === "--name") index += 1;
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
    const mode = command === "adopt" ? "brownfield" : "greenfield";
    await applyAssessmentScaffold(parseRoot(argv), mode);
    console.log(
      mode === "greenfield"
        ? "Build-or-not assessment created. Implementation remains locked until evidence supports build."
        : "Existing repository adopted. New broad initiatives still require their own assessment.",
    );
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
