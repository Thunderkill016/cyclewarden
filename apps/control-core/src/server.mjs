import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { URL } from "node:url";
import { createTaskRecord } from "./domain.mjs";
import { git, inspectRepository } from "./git.mjs";
import { AgentRunner } from "./runner.mjs";
import { ControlStore } from "./store.mjs";

const execFileAsync = promisify(execFile);
const HOST = "127.0.0.1";
const PORT = Number.parseInt(process.env.CYCLEWARDEN_CONTROL_PORT || "4318", 10);
const BODY_LIMIT = 256 * 1024;
const allowedOrigins = new Set(
  (process.env.CYCLEWARDEN_CONTROL_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

const store = await new ControlStore().init();
const reconciled = await store.reconcileInterruptedTasks();
const runner = new AgentRunner({ store });

function isLoopback(address) {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

function corsHeaders(req) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    return {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
      vary: "Origin",
    };
  }
  return {};
}

function sendJson(req, res, status, value) {
  const payload = JSON.stringify(value);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload),
    ...corsHeaders(req),
  });
  res.end(payload);
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > BODY_LIMIT) throw new Error("Request body too large.");
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function requireBrowserOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  if (!allowedOrigins.has(origin)) throw new Error(`Origin is not allowed: ${origin}`);
}

async function versionOf(binary, args = ["--version"]) {
  try {
    const { stdout, stderr } = await execFileAsync(binary, args, { encoding: "utf8", timeout: 5000 });
    return { ok: true, version: (stdout || stderr).trim().slice(0, 500) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function route(req, res) {
  if (!isLoopback(req.socket.remoteAddress)) {
    sendJson(req, res, 403, { error: "loopback_only" });
    return;
  }

  if (req.method === "OPTIONS") {
    requireBrowserOrigin(req);
    res.writeHead(204, corsHeaders(req));
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(req, res, 200, {
      ok: true,
      service: "cyclewarden-control-core",
      pid: process.pid,
      port: PORT,
      dataDir: store.dataDir,
      reconciledInterruptedTasks: reconciled,
      time: new Date().toISOString(),
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/doctor") {
    const [gitVersion, codexVersion] = await Promise.all([
      versionOf("git"),
      versionOf(process.env.CYCLEWARDEN_CODEX_BIN || "codex"),
    ]);
    sendJson(req, res, 200, { ok: gitVersion.ok && codexVersion.ok, git: gitVersion, codex: codexVersion });
    return;
  }

  if (req.method === "GET" && url.pathname === "/snapshot") {
    sendJson(req, res, 200, store.dashboard());
    return;
  }

  if (req.method === "POST" && url.pathname === "/projects") {
    requireBrowserOrigin(req);
    const body = await readJson(req);
    if (typeof body.path !== "string" || body.path.trim().length === 0) {
      throw new Error("path is required.");
    }
    const inspected = await inspectRepository(body.path.trim());
    const project = await store.registerProject(inspected);
    sendJson(req, res, 201, { project });
    return;
  }

  if (req.method === "POST" && url.pathname === "/tasks") {
    requireBrowserOrigin(req);
    const body = await readJson(req);
    const project = store.getProject(body.projectId);
    if (!project) throw new Error("projectId does not reference a registered project.");
    if (typeof body.title !== "string" || body.title.trim().length < 2) throw new Error("title is required.");
    if (typeof body.objective !== "string" || body.objective.trim().length < 3) throw new Error("objective is required.");
    const { stdout: baseHead } = await git(project.rootPath, ["rev-parse", "HEAD"]);
    const task = createTaskRecord({
      projectId: project.id,
      title: body.title,
      objective: body.objective,
      acceptanceCriteria: body.acceptanceCriteria,
      agent: "codex",
      baseHead,
    });
    await store.addTask(task);
    sendJson(req, res, 201, { task });
    return;
  }

  const taskAction = url.pathname.match(/^\/tasks\/([^/]+)\/(start|cancel)$/);
  if (req.method === "POST" && taskAction) {
    requireBrowserOrigin(req);
    const [, taskId, action] = taskAction;
    if (action === "start") {
      const task = await runner.start(taskId);
      sendJson(req, res, 202, { task });
      return;
    }
    if (action === "cancel") {
      const result = await runner.cancel(taskId);
      sendJson(req, res, 202, result);
      return;
    }
  }

  sendJson(req, res, 404, { error: "not_found" });
}

const server = http.createServer((req, res) => {
  void route(req, res).catch((error) => {
    console.error("[control-core]", error);
    if (!res.headersSent) sendJson(req, res, 400, { error: "request_failed", message: error.message });
    else res.end();
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[control-core] listening on http://${HOST}:${PORT}`);
  console.log(`[control-core] state: ${store.statePath}`);
});

function shutdown(signal) {
  console.log(`[control-core] ${signal}; closing listener`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
