import { spawn } from "node:child_process";

const children = [];
let shuttingDown = false;

function launch(command, args, name) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: process.env,
  });
  children.push(child);
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.error(`[dev-control-center] ${name} exited (${signal ?? code ?? "unknown"}); stopping peers.`);
    shutdown(code ?? 1);
  });
  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 1500).unref();
}

launch(process.execPath, ["apps/control-core/src/server.mjs"], "control-core");
launch("pnpm", ["--filter", "@cyclewarden/web", "dev"], "web");

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
