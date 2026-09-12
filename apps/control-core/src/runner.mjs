import { spawn } from "node:child_process";
import { createTaskWorktree, newRunId, worktreeEvidence } from "./git.mjs";

const MAX_CAPTURE = 16_000;

function appendBounded(current, chunk) {
  const next = `${current}${chunk}`;
  return next.length > MAX_CAPTURE ? next.slice(-MAX_CAPTURE) : next;
}

function buildPrompt(task) {
  const acceptance = task.acceptanceCriteria.length
    ? task.acceptanceCriteria.map((item) => `- ${item}`).join("\n")
    : "- Preserve existing behavior outside the requested scope.";
  return [
    "You are implementing one bounded task inside an isolated git worktree.",
    "Read AGENTS.md and repository-local instructions before editing.",
    "Do not merge, deploy, change unrelated files, or weaken tests/checks.",
    "Implement the smallest coherent change that satisfies the objective.",
    "Run relevant repository checks before finishing.",
    "Commit all intended changes to the current task branch before your final response.",
    "Leave the worktree clean. If you cannot safely finish, explain the blocker instead of inventing success.",
    "",
    `Task: ${task.title}`,
    `Objective: ${task.objective}`,
    "Acceptance criteria:",
    acceptance,
  ].join("\n");
}

function parseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

async function runCheck(check, cwd, onOutput) {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const child = spawn(check.command, check.args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output = appendBounded(output, chunk.toString());
      onOutput?.(chunk.toString());
    });
    child.stderr.on("data", (chunk) => {
      output = appendBounded(output, chunk.toString());
      onOutput?.(chunk.toString());
    });
    child.on("error", (error) => {
      resolve({
        name: check.name,
        ok: false,
        exitCode: null,
        durationMs: Date.now() - startedAt,
        output: appendBounded(output, `\n${error.message}`),
      });
    });
    child.on("close", (code) => {
      resolve({
        name: check.name,
        ok: code === 0,
        exitCode: code,
        durationMs: Date.now() - startedAt,
        output,
      });
    });
  });
}

export class AgentRunner {
  constructor({ store }) {
    this.store = store;
    this.processes = new Map();
  }

  isRunning(taskId) {
    return this.processes.has(taskId);
  }

  async start(taskId) {
    let task = this.store.getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (this.processes.has(taskId)) throw new Error("Task is already running.");
    const project = this.store.getProject(task.projectId);
    if (!project) throw new Error(`Project not found: ${task.projectId}`);

    if (task.status === "BACKLOG" || task.status === "FAILED") {
      task = await this.store.transition(taskId, "READY", { failure: null, verification: [] });
    }
    if (task.status !== "READY" && task.status !== "READY_TO_SHIP") {
      throw new Error(`Task cannot start from ${task.status}.`);
    }

    const worktree = await createTaskWorktree({ project, task, dataDir: this.store.dataDir });
    const runId = newRunId();
    task = await this.store.transition(
      taskId,
      "RUNNING",
      {
        runId,
        branch: worktree.branch,
        worktreePath: worktree.worktreePath,
        exactHead: worktree.exactHead,
        lastMessage: null,
        pendingDecision: null,
        failure: null,
      },
      "task.run_started",
    );

    const args = ["exec", "--json", "--sandbox", "workspace-write", buildPrompt(task)];
    const child = spawn(process.env.CYCLEWARDEN_CODEX_BIN || "codex", args, {
      cwd: task.worktreePath,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const processRecord = {
      child,
      cancelled: false,
      stderr: "",
      stdoutBuffer: "",
      consumeQueue: Promise.resolve(),
    };
    this.processes.set(taskId, processRecord);

    await this.store.appendEvent({
      taskId,
      projectId: task.projectId,
      type: "agent.process_spawned",
      payload: { agent: "codex", pid: child.pid ?? null, runId },
    });

    child.stdout.on("data", (chunk) => {
      processRecord.consumeQueue = processRecord.consumeQueue
        .then(() => this.#consumeStdout(taskId, chunk.toString()))
        .catch((error) =>
          this.store.appendEvent({
            taskId,
            projectId: task.projectId,
            type: "agent.event_parse_failed",
            payload: { message: error.message },
          }),
        );
    });
    child.stderr.on("data", (chunk) => {
      processRecord.stderr = appendBounded(processRecord.stderr, chunk.toString());
      void this.store.appendEvent({
        taskId,
        projectId: task.projectId,
        type: "agent.stderr",
        payload: { text: chunk.toString().slice(-2000) },
      });
    });
    child.on("error", (error) => {
      void this.#fail(taskId, "AGENT_SPAWN_FAILED", error.message);
    });
    child.on("close", (code, signal) => {
      void this.#handleExit(taskId, code, signal);
    });

    return this.store.getTask(taskId);
  }

  async cancel(taskId) {
    const record = this.processes.get(taskId);
    if (!record) throw new Error("Task does not have a live local process.");
    record.cancelled = true;
    record.child.kill("SIGTERM");
    await this.store.appendEvent({
      taskId,
      projectId: this.store.getTask(taskId)?.projectId ?? null,
      type: "agent.cancel_requested",
      payload: {},
    });
    return { ok: true };
  }

  async #consumeStdout(taskId, chunk) {
    const record = this.processes.get(taskId);
    if (!record) return;
    record.stdoutBuffer += chunk;
    const lines = record.stdoutBuffer.split("\n");
    record.stdoutBuffer = lines.pop() ?? "";
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const event = parseJsonLine(line);
      if (!event) {
        await this.store.appendEvent({
          taskId,
          projectId: this.store.getTask(taskId)?.projectId ?? null,
          type: "agent.output_unparsed",
          payload: { text: line.slice(0, 2000) },
        });
        continue;
      }
      const task = this.store.getTask(taskId);
      if (!task) continue;
      if (event.type === "thread.started" && event.thread_id) {
        await this.store.patchTask(
          taskId,
          { externalThreadId: event.thread_id },
          { type: "agent.thread_started", payload: { threadId: event.thread_id } },
        );
        continue;
      }
      if (event.type === "item.completed" && event.item?.type === "agent_message") {
        await this.store.patchTask(
          taskId,
          { lastMessage: event.item.text ?? null },
          { type: "agent.message", payload: { text: String(event.item.text ?? "").slice(0, 4000) } },
        );
        continue;
      }
      await this.store.appendEvent({
        taskId,
        projectId: task.projectId,
        type: `codex.${event.type ?? "event"}`,
        payload: event,
      });
    }
  }

  async #handleExit(taskId, code, signal) {
    const record = this.processes.get(taskId);
    if (record) {
      await record.consumeQueue;
      if (record.stdoutBuffer.trim()) await this.#consumeStdout(taskId, "\n");
    }
    this.processes.delete(taskId);
    const task = this.store.getTask(taskId);
    if (!task || task.status !== "RUNNING") return;
    if (record?.cancelled) {
      await this.#fail(taskId, "CANCELLED", `Codex was cancelled${signal ? ` (${signal})` : ""}.`);
      return;
    }
    if (code !== 0) {
      await this.#fail(
        taskId,
        "AGENT_EXIT_NONZERO",
        record?.stderr || `Codex exited with code ${code ?? "unknown"}.`,
      );
      return;
    }
    await this.#verify(taskId);
  }

  async #verify(taskId) {
    let task = this.store.getTask(taskId);
    if (!task) return;
    const project = this.store.getProject(task.projectId);
    if (!project) return this.#fail(taskId, "PROJECT_MISSING", "Project disappeared before verification.");

    task = await this.store.transition(taskId, "VERIFYING", {}, "task.verification_started");
    const results = [];
    for (const check of project.verification ?? []) {
      await this.store.appendEvent({
        taskId,
        projectId: task.projectId,
        type: "verification.check_started",
        payload: { name: check.name, command: [check.command, ...check.args].join(" ") },
      });
      const result = await runCheck(check, task.worktreePath, (text) => {
        void this.store.appendEvent({
          taskId,
          projectId: task.projectId,
          type: "verification.output",
          payload: { name: check.name, text: text.slice(-2000) },
        });
      });
      results.push(result);
      await this.store.patchTask(taskId, { verification: results });
      if (!result.ok) {
        await this.#fail(taskId, "VERIFICATION_FAILED", `${check.name} failed with exit code ${result.exitCode}.`, {
          verification: results,
        });
        return;
      }
    }

    const evidence = await worktreeEvidence({ task: this.store.getTask(taskId) });
    if (!evidence.clean) {
      await this.#fail(
        taskId,
        "DIRTY_WORKTREE",
        "Agent finished with uncommitted changes. READY_TO_SHIP requires a clean exact head.",
        { verification: results, evidence },
      );
      return;
    }

    await this.store.transition(
      taskId,
      "READY_TO_SHIP",
      {
        verification: results,
        exactHead: evidence.exactHead,
        evidence,
        failure: null,
      },
      "task.ready_to_ship",
    );
  }

  async #fail(taskId, code, message, extraPatch = {}) {
    const task = this.store.getTask(taskId);
    if (!task || !["RUNNING", "VERIFYING", "NEEDS_INPUT"].includes(task.status)) return;
    await this.store.transition(
      taskId,
      "FAILED",
      { ...extraPatch, failure: { code, message: String(message).slice(-8000) } },
      "task.failed",
    );
  }
}
