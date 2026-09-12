import { inspectProjectHealth } from "./git.mjs";
import { nowIso } from "./domain.mjs";

const DEFAULT_INTERVAL_MS = 15_000;
const MIN_INTERVAL_MS = 5_000;

function semanticHealth(value) {
  if (!value) return null;
  return {
    available: Boolean(value.available),
    head: value.head ?? null,
    branch: value.branch ?? null,
    dirty: value.dirty ?? null,
    changedFiles: value.changedFiles ?? null,
    headMoved: value.headMoved ?? null,
  };
}

function sameHealth(a, b) {
  return JSON.stringify(semanticHealth(a)) === JSON.stringify(semanticHealth(b));
}

function eventFor(previous, next) {
  if (!previous && next.available) return "project.health_initialized";
  if (previous?.available !== next.available) {
    return next.available ? "project.available" : "project.unavailable";
  }
  if (previous?.head !== next.head) return "project.head_changed";
  if (previous?.dirty !== next.dirty || previous?.changedFiles !== next.changedFiles) {
    return "project.dirty_changed";
  }
  if (previous?.branch !== next.branch) return "project.branch_changed";
  return "project.health_changed";
}

export class ProjectHealthWatcher {
  constructor({
    store,
    inspectHealth = inspectProjectHealth,
    intervalMs = Number.parseInt(process.env.CYCLEWARDEN_PROJECT_HEALTH_MS || `${DEFAULT_INTERVAL_MS}`, 10),
  }) {
    this.store = store;
    this.inspectHealth = inspectHealth;
    this.intervalMs = Number.isFinite(intervalMs) ? Math.max(MIN_INTERVAL_MS, intervalMs) : DEFAULT_INTERVAL_MS;
    this.timer = null;
    this.running = false;
    this.refreshing = false;
    this.lastSweepAt = null;
    this.lastError = null;
  }

  status() {
    return {
      running: this.running,
      intervalMs: this.intervalMs,
      lastSweepAt: this.lastSweepAt,
      lastError: this.lastError,
    };
  }

  start() {
    if (this.running) return this.status();
    this.running = true;
    void this.refreshAll();
    this.timer = setInterval(() => void this.refreshAll(), this.intervalMs);
    this.timer.unref?.();
    return this.status();
  }

  stop() {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async refreshAll() {
    if (this.refreshing) return this.status();
    this.refreshing = true;
    try {
      const projects = this.store.snapshot().projects ?? [];
      for (const project of projects) {
        await this.refreshProject(project.id);
      }
      this.lastSweepAt = nowIso();
      this.lastError = null;
    } catch (error) {
      this.lastError = String(error?.message || error).slice(0, 500);
    } finally {
      this.refreshing = false;
    }
    return this.status();
  }

  async refreshProject(projectId) {
    const project = this.store.getProject(projectId);
    if (!project) return null;

    const inspected = await this.inspectHealth(project);
    const previous = project.health ?? null;
    if (sameHealth(previous, inspected)) return previous;

    const next = {
      ...semanticHealth(inspected),
      error: inspected.error ?? null,
      checkedAt: inspected.checkedAt ?? nowIso(),
      changedAt: nowIso(),
    };
    const type = eventFor(previous, next);
    await this.store.patchProject(
      projectId,
      { health: next },
      {
        type,
        payload: {
          available: next.available,
          head: next.head,
          branch: next.branch,
          dirty: next.dirty,
          changedFiles: next.changedFiles,
          headMoved: next.headMoved,
        },
      },
    );
    return next;
  }
}
