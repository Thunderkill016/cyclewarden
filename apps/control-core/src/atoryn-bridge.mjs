import os from "node:os";
import { createHash } from "node:crypto";

const DEFAULT_POLL_MS = 5_000;
const HEARTBEAT_MS = 15_000;
const MAX_BACKOFF_MS = 60_000;
const REQUEST_TIMEOUT_MS = 10_000;
const REMOTE_STARTED = "remote.command_started";
const REMOTE_COMPLETED = "remote.command_completed";

export function sanitizeDashboard(snapshot) {
  const cleanTask = (task) => ({
    id: String(task?.id || ""),
    projectId: String(task?.projectId || ""),
    title: String(task?.title || "").slice(0, 180),
    status: String(task?.status || "UNKNOWN"),
    agent: String(task?.agent || ""),
    branch: task?.branch ? String(task.branch).slice(0, 160) : null,
    exactHead: task?.exactHead ? String(task.exactHead).slice(0, 64) : null,
    failure: task?.failure?.code ? { code: String(task.failure.code).slice(0, 120) } : null,
    updatedAt: String(task?.updatedAt || ""),
  });

  const source = snapshot && typeof snapshot === "object" ? snapshot : {};
  return {
    version: Number(source.version || 1),
    generatedAt: String(source.generatedAt || new Date().toISOString()),
    projects: (Array.isArray(source.projects) ? source.projects : []).map((project) => ({
      id: String(project?.id || ""),
      name: String(project?.name || "").slice(0, 120),
      taskCounts: project?.taskCounts && typeof project.taskCounts === "object"
        ? {
            total: Number(project.taskCounts.total || 0),
            active: Number(project.taskCounts.active || 0),
            blocked: Number(project.taskCounts.blocked || 0),
            readyToShip: Number(project.taskCounts.readyToShip || 0),
          }
        : { total: 0, active: 0, blocked: 0, readyToShip: 0 },
    })),
    needsYou: (Array.isArray(source.needsYou) ? source.needsYou : []).map(cleanTask),
    readyToShip: (Array.isArray(source.readyToShip) ? source.readyToShip : []).map(cleanTask),
    inFlight: (Array.isArray(source.inFlight) ? source.inFlight : []).map(cleanTask),
    backlog: (Array.isArray(source.backlog) ? source.backlog : []).map(cleanTask),
  };
}

export class AtoRynBridge {
  constructor({
    store,
    runner,
    fetchImpl = globalThis.fetch,
    baseUrl = process.env.CYCLEWARDEN_ATORYN_URL || "",
    token = process.env.CYCLEWARDEN_ATORYN_TOKEN || "",
    coreId = process.env.CYCLEWARDEN_CORE_ID || defaultCoreId(store?.dataDir),
    pollMs = Number.parseInt(process.env.CYCLEWARDEN_ATORYN_POLL_MS || `${DEFAULT_POLL_MS}`, 10),
  }) {
    this.store = store;
    this.runner = runner;
    this.fetchImpl = fetchImpl;
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.token = String(token || "").trim();
    this.coreId = String(coreId || "control-core").slice(0, 120);
    this.pollMs = Number.isFinite(pollMs) && pollMs >= 2_000 ? pollMs : DEFAULT_POLL_MS;
    this.timer = null;
    this.unsubscribe = null;
    this.stopped = true;
    this.inFlight = false;
    this.dirty = true;
    this.lastSnapshotHash = null;
    this.lastSyncAt = 0;
    this.lastSuccessAt = 0;
    this.lastError = null;
    this.backoffMs = this.pollMs;
  }

  get enabled() {
    return Boolean(this.baseUrl && this.token);
  }

  status() {
    return {
      enabled: this.enabled,
      connected: this.enabled && Date.now() - this.lastSuccessAt <= Math.max(30_000, this.pollMs * 3),
      coreId: this.coreId,
      baseUrl: this.baseUrl || null,
      lastSuccessAt: this.lastSuccessAt || null,
      lastSyncAt: this.lastSyncAt || null,
      lastError: this.lastError,
    };
  }

  start() {
    if (!this.enabled || !this.stopped) return this.status();
    this.stopped = false;
    this.unsubscribe = this.store.subscribe(() => {
      this.dirty = true;
      this.#schedule(100);
    });
    this.#schedule(0);
    return this.status();
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  async tickOnce() {
    if (!this.enabled || this.inFlight) return this.status();
    this.inFlight = true;
    try {
      const now = Date.now();
      const snapshot = sanitizeDashboard(this.store.dashboard());
      const hash = sha256(JSON.stringify({ ...snapshot, generatedAt: null }));
      if (this.dirty || hash !== this.lastSnapshotHash || now - this.lastSyncAt >= HEARTBEAT_MS) {
        await this.#post("sync", { coreId: this.coreId, snapshot });
        this.lastSnapshotHash = hash;
        this.lastSyncAt = Date.now();
        this.dirty = false;
      }

      const pulled = await this.#post("pull", { coreId: this.coreId });
      for (const command of Array.isArray(pulled?.commands) ? pulled.commands : []) {
        const result = await this.#executeCommand(command);
        await this.#post("result", {
          coreId: this.coreId,
          commandId: command.id,
          leaseId: command.leaseId,
          result,
        });
      }

      this.lastSuccessAt = Date.now();
      this.lastError = null;
      this.backoffMs = this.pollMs;
    } catch (error) {
      this.lastError = safeError(error);
      this.backoffMs = Math.min(MAX_BACKOFF_MS, Math.max(this.pollMs, this.backoffMs * 2));
    } finally {
      this.inFlight = false;
    }
    return this.status();
  }

  async #executeCommand(command) {
    const commandId = clean(command?.id, 120);
    const kind = command?.kind === "run" ? "run" : command?.kind === "cancel" ? "cancel" : null;
    const taskId = clean(command?.taskId, 120);
    if (!commandId || !kind || !taskId) {
      return { ok: false, error: "Malformed remote command." };
    }

    const history = this.store.snapshot().events || [];
    const completed = [...history].reverse().find((event) =>
      event.type === REMOTE_COMPLETED && event.payload?.commandId === commandId,
    );
    if (completed?.payload?.result) return completed.payload.result;

    const started = [...history].reverse().find((event) =>
      event.type === REMOTE_STARTED && event.payload?.commandId === commandId,
    );
    if (started) {
      const task = this.store.getTask(taskId);
      const active = task && ["RUNNING", "VERIFYING", "READY_TO_SHIP"].includes(task.status);
      const replayResult = active
        ? { ok: true, status: task.status, message: "Command đã được nhận trước đó; không chạy lặp." }
        : { ok: false, status: task?.status || null, error: "Command đã được nhận trước đó; cần gửi lệnh mới để thử lại." };
      await this.#recordCompleted(command, replayResult);
      return replayResult;
    }

    const task = this.store.getTask(taskId);
    if (!task) {
      const result = { ok: false, error: `Task không tồn tại: ${taskId}` };
      await this.#recordCompleted(command, result);
      return result;
    }

    await this.store.appendEvent({
      taskId,
      projectId: task.projectId,
      type: REMOTE_STARTED,
      payload: { commandId, kind },
    });

    let result;
    try {
      if (kind === "run") {
        const next = await this.runner.start(taskId);
        result = { ok: true, status: next?.status || "RUNNING", message: "Task đã được giao cho Codex local." };
      } else {
        await this.runner.cancel(taskId);
        result = { ok: true, status: this.store.getTask(taskId)?.status || task.status, message: "Đã gửi yêu cầu hủy process local." };
      }
    } catch (error) {
      result = { ok: false, status: this.store.getTask(taskId)?.status || task.status, error: safeError(error) };
    }

    await this.#recordCompleted(command, result);
    return result;
  }

  async #recordCompleted(command, result) {
    const task = this.store.getTask(command.taskId);
    await this.store.appendEvent({
      taskId: command.taskId,
      projectId: task?.projectId || command.projectId || null,
      type: REMOTE_COMPLETED,
      payload: {
        commandId: command.id,
        kind: command.kind,
        result,
      },
    });
  }

  async #post(operation, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    timer.unref?.();
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/control/bridge/${operation}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.token}`,
          "content-type": "application/json",
          "user-agent": "CycleWarden-Control-Core/1",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(`AtoRyn bridge ${operation} HTTP ${response.status}: ${payload?.error || payload?.message || "failed"}`);
      }
      return payload;
    } finally {
      clearTimeout(timer);
    }
  }

  #schedule(delay) {
    if (this.stopped || !this.enabled || this.timer) return;
    this.timer = setTimeout(async () => {
      this.timer = null;
      await this.tickOnce();
      this.#schedule(this.lastError ? this.backoffMs : this.pollMs);
    }, Math.max(0, delay));
    this.timer.unref?.();
  }
}

function normalizeBaseUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  let url;
  try { url = new URL(raw); } catch { throw new Error("CYCLEWARDEN_ATORYN_URL must be a valid URL."); }
  const localHttp = url.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !localHttp) throw new Error("AtoRyn bridge requires HTTPS outside localhost.");
  return url.toString().replace(/\/$/, "");
}

function defaultCoreId(dataDir) {
  return `core_${sha256(`${os.hostname()}|${String(dataDir || "")}`).slice(0, 16)}`;
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function clean(value, max) {
  return String(value || "").trim().slice(0, max);
}

function safeError(error) {
  return String(error?.message || error || "unknown error").slice(0, 1000);
}
