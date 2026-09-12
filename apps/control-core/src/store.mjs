import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { dashboardSnapshot, makeEvent, nowIso, transitionTask } from "./domain.mjs";

const EMPTY_STATE = Object.freeze({ version: 1, projects: [], tasks: [], events: [] });

function cloneEmptyState() {
  return { version: 1, projects: [], tasks: [], events: [] };
}

function validateState(value) {
  if (!value || value.version !== 1) return cloneEmptyState();
  return {
    version: 1,
    projects: Array.isArray(value.projects) ? value.projects : [],
    tasks: Array.isArray(value.tasks) ? value.tasks : [],
    events: Array.isArray(value.events) ? value.events : [],
  };
}

export function resolveControlDataDir() {
  return process.env.CYCLEWARDEN_CONTROL_DATA_DIR
    ? path.resolve(process.env.CYCLEWARDEN_CONTROL_DATA_DIR)
    : path.join(os.homedir(), ".cyclewarden", "control-center");
}

export class ControlStore {
  constructor({ dataDir = resolveControlDataDir() } = {}) {
    this.dataDir = dataDir;
    this.statePath = path.join(dataDir, "state.json");
    this.state = cloneEmptyState();
    this.writeQueue = Promise.resolve();
  }

  async init() {
    await mkdir(this.dataDir, { recursive: true });
    try {
      this.state = validateState(JSON.parse(await readFile(this.statePath, "utf8")));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      this.state = cloneEmptyState();
      await this.#persist();
    }
    return this;
  }

  snapshot() {
    return structuredClone(this.state);
  }

  dashboard() {
    return dashboardSnapshot(this.state);
  }

  getProject(projectId) {
    return this.state.projects.find((project) => project.id === projectId) ?? null;
  }

  getTask(taskId) {
    return this.state.tasks.find((task) => task.id === taskId) ?? null;
  }

  async registerProject(project) {
    return this.#mutate((state) => {
      const existing = state.projects.find((item) => item.rootPath === project.rootPath);
      if (existing) return existing;
      state.projects.push(project);
      state.events.push(
        makeEvent({ projectId: project.id, type: "project.registered", payload: { name: project.name } }),
      );
      return project;
    });
  }

  async addTask(task) {
    return this.#mutate((state) => {
      if (!state.projects.some((project) => project.id === task.projectId)) {
        throw new Error(`Project not found: ${task.projectId}`);
      }
      state.tasks.push(task);
      state.events.push(
        makeEvent({ taskId: task.id, projectId: task.projectId, type: "task.created", payload: { title: task.title } }),
      );
      return task;
    });
  }

  async patchTask(taskId, patch, event = null) {
    return this.#mutate((state) => {
      const index = state.tasks.findIndex((task) => task.id === taskId);
      if (index < 0) throw new Error(`Task not found: ${taskId}`);
      state.tasks[index] = { ...state.tasks[index], ...patch, updatedAt: nowIso() };
      if (event) {
        state.events.push(
          makeEvent({
            taskId,
            projectId: state.tasks[index].projectId,
            type: event.type,
            payload: event.payload ?? {},
          }),
        );
      }
      return state.tasks[index];
    });
  }

  async transition(taskId, nextStatus, patch = {}, eventType = "task.state_changed") {
    return this.#mutate((state) => {
      const index = state.tasks.findIndex((task) => task.id === taskId);
      if (index < 0) throw new Error(`Task not found: ${taskId}`);
      const previous = state.tasks[index];
      const next = transitionTask(previous, nextStatus, patch);
      state.tasks[index] = next;
      state.events.push(
        makeEvent({
          taskId,
          projectId: next.projectId,
          type: eventType,
          payload: { from: previous.status, to: nextStatus },
        }),
      );
      return next;
    });
  }

  async appendEvent(event) {
    return this.#mutate((state) => {
      state.events.push(makeEvent(event));
      if (state.events.length > 2000) state.events.splice(0, state.events.length - 2000);
      return state.events.at(-1);
    });
  }

  async reconcileInterruptedTasks() {
    const interrupted = this.state.tasks.filter((task) => ["RUNNING", "VERIFYING"].includes(task.status));
    for (const task of interrupted) {
      await this.transition(
        task.id,
        "FAILED",
        { failure: { code: "CORE_RESTARTED", message: "Local core restarted before the run completed." } },
        "task.reconciled_after_restart",
      );
    }
    return interrupted.length;
  }

  async #mutate(mutator) {
    let result;
    const operation = this.writeQueue.then(async () => {
      const previousState = structuredClone(this.state);
      try {
        result = await mutator(this.state);
        await this.#persist();
      } catch (error) {
        this.state = previousState;
        throw error;
      }
    });
    this.writeQueue = operation.catch(() => undefined);
    await operation;
    return structuredClone(result);
  }

  async #persist() {
    await mkdir(this.dataDir, { recursive: true });
    const tempPath = `${this.statePath}.${process.pid}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(this.state, null, 2)}\n`, { mode: 0o600 });
    await rename(tempPath, this.statePath);
  }
}

export { EMPTY_STATE };
