import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { URL } from "node:url";
import { AtoRynBridge } from "./atoryn-bridge.mjs";
import { createTaskRecord } from "./domain.mjs";
import { git, inspectInterruptedWorktree, inspectRepository } from "./git.mjs";
import { ProjectHealthWatcher } from "./project-health-watcher.mjs";
import { AgentRunner } from "./runner.mjs";
import { ControlStore } from "./store.mjs";

const execFileAsync = promisify(execFile);
const HOST = "127.0.0.1";
const PORT = Number.parseInt(process.env.CYCLEWARDEN_CONTROL_PORT || "4318", 10);
const BODY_LIMIT = 256 * 1024;
const CODEX_MODE = process.env.CYCLEWARDEN_CODEX_MODE === "app-server" ? "app-server" : "exec";
const allowedOrigins = new Set(
  (process.env.CYCLEWARDEN_CONTROL_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

const store = await new ControlStore().init();
const reconciled = await store.reconcileInterruptedTasks({ inspectRecovery: inspectInterruptedWorktree });
const runner = new AgentRunner({ store });
const projectWatcher = new ProjectHealthWatcher({ store });
projectWatcher.start();
const atorynBridge = new AtoRynBridge({ store, runner });
atorynBridge.start();

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

function writeSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function openEventStream(req, res) {
  requireBrowserOrigin(req);
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
    ...corsHeaders(req),
  });
  res.flushHeaders?.();

  writeSse(res, "snapshot", store.dashboard());
  const unsubscribe = store.subscribe((snapshot) => {
    if (!res.writableEnded && !res.destroyed) writeSse(res, "snapshot", snapshot);
  });
  const heartbeat = setInterval(() => {
    if (!res.writableEnded && !res.destroyed) res.write(`: heartbeat ${Date.now()}\n\n`);
  }, 15_000);
  heartbeat.unref?.();

  const close = () => {
    clearInterval(heartbeat);
    unsubscribe();
  };
  req.once("close", close);
  res.once("close", close);
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
      runtime: { codexMode: CODEX_MODE },
      reconciledInterruptedTasks: reconciled,
      projectWatcher: projectWatcher.status(),
      remote: { atoryn: atorynBridge.status() },
      time: new Date().toISOString(),
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/doctor") {
    const [gitVersion, codexVersion] = await Promise.all([
      versionOf("git"),
      versionOf(process.env.CYCLEWARDEN_CODEX_BIN || "codex"),
    ]);
    sendJson(req, res, 200, {
      ok: gitVersion.ok && codexVersion.ok,
      runtime: { codexMode: CODEX_MODE },
      git: gitVersion,
      codex: codexVersion,
      projectWatcher: projectWatcher.status(),
      atoryn: atorynBridge.status(),
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/snapshot") {
    sendJson(req, res, 200, store.dashboard());
    return;
  }

  if (req.method === "GET" && url.pathname === "/events") {
    openEventStream(req, res);
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
    await projectWatcher.refreshProject(project.id);
    sendJson(req, res, 201, { project: store.getProject(project.id) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/tasks") {
    requireBrowserOrigin(req);
    const body = await readJson(req);
    const project = store.getProject(body.projectId);
    if (!project) throw new Error("projectId does not reference a registered project.");
    if (project.health?.available === false) throw new Error("project repository is currently unavailable.");
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

  const taskAction = url.pathname.match(/^\/tasks\/([^/]+)\/(start|cancel|decision)$/);
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
    if (action === "decision") {
      const body = await readJson(req);
      if (typeof body.decision !== "string" || body.decision.length === 0) {
        throw new Error("decision is required.");
      }
      const task = await runner.decide(taskId, body.decision);
      sendJson(req, res, 202, { task });
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
  if (reconciled) console.log(`[control-core] recovered ${reconciled} interrupted task(s) for manual review`);
  if (atorynBridge.enabled) console.log(`[control-core] AtoRyn bridge enabled: ${atorynBridge.status().baseUrl}`);
});

function shutdown(signal) {
  console.log(`[control-core] ${signal}; closing listener`);
  projectWatcher.stop();
  atorynBridge.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
