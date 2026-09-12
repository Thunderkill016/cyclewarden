import { randomUUID } from "node:crypto";

export const TASK_STATES = Object.freeze([
  "BACKLOG",
  "READY",
  "RUNNING",
  "NEEDS_INPUT",
  "VERIFYING",
  "INTERRUPTED",
  "READY_TO_SHIP",
  "FAILED",
  "MERGED",
  "CLOSED",
]);

const TRANSITIONS = Object.freeze({
  BACKLOG: new Set(["READY", "CLOSED"]),
  READY: new Set(["RUNNING", "CLOSED"]),
  RUNNING: new Set(["NEEDS_INPUT", "VERIFYING", "INTERRUPTED", "FAILED", "CLOSED"]),
  NEEDS_INPUT: new Set(["RUNNING", "INTERRUPTED", "FAILED", "CLOSED"]),
  VERIFYING: new Set(["READY_TO_SHIP", "INTERRUPTED", "FAILED", "CLOSED"]),
  INTERRUPTED: new Set(["READY", "RUNNING", "CLOSED"]),
  READY_TO_SHIP: new Set(["MERGED", "CLOSED", "RUNNING"]),
  FAILED: new Set(["READY", "RUNNING", "CLOSED"]),
  MERGED: new Set(["CLOSED"]),
  CLOSED: new Set(),
});

export function nowIso() {
  return new Date().toISOString();
}

export function createId(prefix) {
  return `${prefix}_${randomUUID()}`;
}

export function assertTaskState(value) {
  if (!TASK_STATES.includes(value)) {
    throw new Error(`Unknown task state: ${value}`);
  }
  return value;
}

export function assertTransition(from, to) {
  assertTaskState(from);
  assertTaskState(to);
  if (from === to) return;
  if (!TRANSITIONS[from].has(to)) {
    throw new Error(`Invalid task transition: ${from} -> ${to}`);
  }
}

export function createTaskRecord(input) {
  const createdAt = nowIso();
  return {
    id: createId("task"),
    projectId: input.projectId,
    title: input.title.trim(),
    objective: input.objective.trim(),
    acceptanceCriteria: Array.isArray(input.acceptanceCriteria)
      ? input.acceptanceCriteria.map((item) => String(item).trim()).filter(Boolean)
      : [],
    status: "BACKLOG",
    agent: input.agent ?? "codex",
    baseHead: input.baseHead,
    branch: null,
    worktreePath: null,
    externalThreadId: null,
    exactHead: null,
    lastMessage: null,
    pendingDecision: null,
    verification: [],
    recovery: null,
    failure: null,
    createdAt,
    updatedAt: createdAt,
    startedAt: null,
    completedAt: null,
  };
}

export function transitionTask(task, nextStatus, patch = {}) {
  assertTransition(task.status, nextStatus);
  const updated = {
    ...task,
    ...patch,
    status: nextStatus,
    updatedAt: nowIso(),
  };
  if (nextStatus === "RUNNING") {
    if (!updated.startedAt || ["FAILED", "INTERRUPTED"].includes(task.status)) {
      updated.startedAt = updated.updatedAt;
    }
    updated.completedAt = null;
  }
  if (nextStatus === "READY" && ["FAILED", "INTERRUPTED"].includes(task.status)) {
    updated.completedAt = null;
  }
  if (["READY_TO_SHIP", "FAILED", "INTERRUPTED", "MERGED", "CLOSED"].includes(nextStatus)) {
    updated.completedAt = updated.updatedAt;
  }
  return updated;
}

export function makeEvent({ taskId = null, projectId = null, type, payload = {} }) {
  return {
    id: createId("evt"),
    taskId,
    projectId,
    type,
    payload,
    createdAt: nowIso(),
  };
}

export function dashboardSnapshot(state) {
  const tasks = [...state.tasks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const active = tasks.filter((task) => !["MERGED", "CLOSED"].includes(task.status));
  return {
    version: state.version,
    generatedAt: nowIso(),
    projects: state.projects.map((project) => ({
      ...project,
      taskCounts: active.reduce(
        (acc, task) => {
          if (task.projectId !== project.id) return acc;
          acc.total += 1;
          if (task.status === "RUNNING" || task.status === "VERIFYING") acc.active += 1;
          if (["NEEDS_INPUT", "FAILED", "INTERRUPTED"].includes(task.status)) acc.blocked += 1;
          if (task.status === "READY_TO_SHIP") acc.readyToShip += 1;
          return acc;
        },
        { total: 0, active: 0, blocked: 0, readyToShip: 0 },
      ),
    })),
    needsYou: tasks.filter((task) => ["NEEDS_INPUT", "FAILED", "INTERRUPTED"].includes(task.status)),
    readyToShip: tasks.filter((task) => task.status === "READY_TO_SHIP"),
    inFlight: tasks.filter((task) => task.status === "RUNNING" || task.status === "VERIFYING"),
    backlog: tasks.filter((task) => task.status === "BACKLOG" || task.status === "READY"),
    recentEvents: [...state.events].slice(-80).reverse(),
  };
}
