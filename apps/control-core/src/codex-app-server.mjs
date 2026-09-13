import { spawn } from "node:child_process";

const APPROVAL_METHODS = new Set([
  "item/commandExecution/requestApproval",
  "item/fileChange/requestApproval",
]);

const ALLOWED_DECISIONS = new Set(["accept", "acceptForSession", "decline", "cancel"]);

function appServerArgs() {
  const raw = process.env.CYCLEWARDEN_CODEX_APP_SERVER_ARGS;
  if (raw) return raw.split(" ").map((part) => part.trim()).filter(Boolean);
  return ["app-server", "--stdio"];
}

function extractThreadId(result) {
  return result?.thread?.id ?? result?.threadId ?? result?.id ?? null;
}

function extractTurnId(result) {
  return result?.turn?.id ?? result?.turnId ?? result?.id ?? null;
}

export class CodexAppServerClient {
  constructor({
    cwd,
    env = process.env,
    bin = process.env.CYCLEWARDEN_CODEX_BIN || "codex",
    onNotification = null,
    onApproval = null,
    onStderr = null,
    onClose = null,
  } = {}) {
    this.cwd = cwd;
    this.env = env;
    this.bin = bin;
    this.onNotification = onNotification;
    this.onApproval = onApproval;
    this.onStderr = onStderr;
    this.onClose = onClose;
    this.child = null;
    this.nextId = 1;
    this.stdoutBuffer = "";
    this.pending = new Map();
    this.approvals = new Map();
    this.closed = false;
  }

  async start() {
    if (this.child) return;
    this.child = spawn(this.bin, appServerArgs(), {
      cwd: this.cwd,
      env: this.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk) => this.#consume(chunk));
    this.child.stderr.on("data", (chunk) => this.onStderr?.(chunk));
    this.child.once("error", (error) => this.#closeWithError(error));
    this.child.once("close", (code, signal) => {
      const reason = signal ?? code ?? "unknown";
      const error = this.closed
        ? null
        : new Error(`Codex app-server exited unexpectedly (${reason}).`);
      if (error) this.#closeWithError(error);
    });

    await this.request("initialize", {
      clientInfo: { name: "cyclewarden-control-core", title: "CycleWarden Control Center", version: "0.2.0" },
      capabilities: { experimentalApi: false, requestAttestation: false },
    });
    this.notify("initialized", {});
  }

  request(method, params = {}) {
    if (!this.child?.stdin?.writable) return Promise.reject(new Error("Codex app-server is not running."));
    const id = this.nextId++;
    const payload = { id, method, params };
    return new Promise((resolve, reject) => {
      this.pending.set(String(id), { resolve, reject, method });
      this.#write(payload);
    });
  }

  notify(method, params = {}) {
    this.#write({ method, params });
  }

  async startThread({ cwd = this.cwd, developerInstructions = null } = {}) {
    const result = await this.request("thread/start", {
      cwd,
      approvalPolicy: "on-request",
      sandbox: "workspace-write",
      developerInstructions,
      ephemeral: false,
      threadSource: "user",
    });
    const threadId = extractThreadId(result);
    if (!threadId) throw new Error("Codex app-server thread/start did not return a thread id.");
    return { threadId, result };
  }

  async startTurn({ threadId, text }) {
    const result = await this.request("turn/start", {
      threadId,
      input: [{ type: "text", text, text_elements: [] }],
    });
    const turnId = extractTurnId(result);
    if (!turnId) throw new Error("Codex app-server turn/start did not return a turn id.");
    return { turnId, result };
  }

  hasApproval(requestId) {
    return this.approvals.has(String(requestId));
  }

  async decide(requestId, decision) {
    if (!ALLOWED_DECISIONS.has(decision)) throw new Error(`Unsupported Codex approval decision: ${decision}`);
    const key = String(requestId);
    const pending = this.approvals.get(key);
    if (!pending) throw new Error("Approval request is stale, unknown, or already answered.");
    this.approvals.delete(key);
    this.#write({ id: pending.id, result: { decision } });
    return { ok: true, method: pending.method, decision };
  }

  kill(signal = "SIGTERM") {
    this.closed = true;
    if (this.child && !this.child.killed) this.child.kill(signal);
    this.#rejectAll(new Error("Codex app-server stopped."));
  }

  #write(value) {
    if (!this.child?.stdin?.writable) throw new Error("Codex app-server stdin is unavailable.");
    this.child.stdin.write(`${JSON.stringify(value)}\n`);
  }

  #consume(chunk) {
    this.stdoutBuffer += chunk;
    const lines = this.stdoutBuffer.split("\n");
    this.stdoutBuffer = lines.pop() ?? "";
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        this.onNotification?.({ method: "app-server/unparsed", params: { text: line.slice(0, 4000) } });
        continue;
      }
      this.#handle(message);
    }
  }

  #handle(message) {
    if (message && message.id !== undefined && typeof message.method === "string") {
      const key = String(message.id);
      if (APPROVAL_METHODS.has(message.method)) {
        if (this.approvals.has(key)) return;
        const approval = { id: message.id, method: message.method, params: message.params ?? {} };
        this.approvals.set(key, approval);
        this.onApproval?.({ requestId: key, ...approval });
        return;
      }
      this.#write({ id: message.id, error: { code: -32601, message: `Unsupported server request: ${message.method}` } });
      return;
    }

    if (message && message.id !== undefined && (Object.hasOwn(message, "result") || Object.hasOwn(message, "error"))) {
      const key = String(message.id);
      const pending = this.pending.get(key);
      if (!pending) return;
      this.pending.delete(key);
      if (message.error) pending.reject(new Error(message.error.message || `Codex app-server request failed: ${pending.method}`));
      else pending.resolve(message.result);
      return;
    }

    if (message && typeof message.method === "string") {
      this.onNotification?.({ method: message.method, params: message.params ?? {} });
    }
  }

  #closeWithError(error) {
    if (this.closed) return;
    this.closed = true;
    this.#rejectAll(error);
    this.onClose?.(error);
  }

  #rejectAll(error) {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
    this.approvals.clear();
  }
}

export const CODEX_APP_SERVER_APPROVAL_DECISIONS = Object.freeze([...ALLOWED_DECISIONS]);
