import { access, mkdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { createId, nowIso } from "./domain.mjs";

const execFileAsync = promisify(execFile);

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function git(cwd, args, options = {}) {
  const { stdout, stderr } = await execFileAsync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    ...options,
  });
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

function projectIdFor(rootPath) {
  return `project_${createHash("sha256").update(rootPath).digest("hex").slice(0, 16)}`;
}

function packageManagerFor(rootPath) {
  return Promise.all([
    exists(path.join(rootPath, "pnpm-lock.yaml")),
    exists(path.join(rootPath, "yarn.lock")),
    exists(path.join(rootPath, "bun.lockb")),
    exists(path.join(rootPath, "bun.lock")),
  ]).then(([pnpm, yarn, bunLockb, bunLock]) => {
    if (pnpm) return "pnpm";
    if (yarn) return "yarn";
    if (bunLockb || bunLock) return "bun";
    return "npm";
  });
}

async function discoverVerification(rootPath, packageManager) {
  const packagePath = path.join(rootPath, "package.json");
  if (!(await exists(packagePath))) return [];
  try {
    const pkg = JSON.parse(await readFile(packagePath, "utf8"));
    const scripts = pkg?.scripts ?? {};
    const ordered = ["typecheck", "lint", "test", "build"];
    return ordered
      .filter((name) => typeof scripts[name] === "string")
      .map((name) => {
        if (packageManager === "npm") return { name, command: "npm", args: ["run", name] };
        return { name, command: packageManager, args: [name] };
      });
  } catch {
    return [];
  }
}

export async function inspectRepository(inputPath) {
  if (!path.isAbsolute(inputPath)) throw new Error("Repository path must be absolute.");
  const resolved = await realpath(inputPath);
  const info = await stat(resolved);
  if (!info.isDirectory()) throw new Error("Repository path must be a directory.");

  const { stdout: gitRoot } = await git(resolved, ["rev-parse", "--show-toplevel"]);
  const rootPath = await realpath(gitRoot);
  const { stdout: head } = await git(rootPath, ["rev-parse", "HEAD"]);
  let branch = "HEAD";
  try {
    branch = (await git(rootPath, ["symbolic-ref", "--short", "HEAD"])).stdout;
  } catch {
    branch = "HEAD";
  }

  const agentsPath = path.join(rootPath, "AGENTS.md");
  const contractPath = path.join(rootPath, "agent-contract.json");
  const packageManager = await packageManagerFor(rootPath);
  const verification = await discoverVerification(rootPath, packageManager);

  return {
    id: projectIdFor(rootPath),
    name: path.basename(rootPath),
    rootPath,
    defaultBranch: branch,
    registeredHead: head,
    agentsPath: (await exists(agentsPath)) ? agentsPath : null,
    contractPath: (await exists(contractPath)) ? contractPath : null,
    packageManager,
    verification,
    registeredAt: nowIso(),
  };
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "task";
}

export async function createTaskWorktree({ project, task, dataDir }) {
  const worktreesRoot = path.join(dataDir, "worktrees");
  await mkdir(worktreesRoot, { recursive: true });
  const shortId = task.id.replace(/^task_/, "").slice(0, 8);
  const branch = `cyclewarden/${shortId}-${slugify(task.title)}`;
  const worktreePath = path.join(worktreesRoot, task.id);

  if (await exists(worktreePath)) {
    const { stdout: existingRoot } = await git(worktreePath, ["rev-parse", "--show-toplevel"]);
    const { stdout: exactHead } = await git(worktreePath, ["rev-parse", "HEAD"]);
    return { branch, worktreePath: existingRoot, baseHead: task.baseHead, exactHead, reused: true };
  }

  await execFileAsync("git", [
    "-C",
    project.rootPath,
    "worktree",
    "add",
    "-b",
    branch,
    worktreePath,
    task.baseHead,
  ], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });

  const { stdout: exactHead } = await git(worktreePath, ["rev-parse", "HEAD"]);
  return { branch, worktreePath, baseHead: task.baseHead, exactHead, reused: false };
}

export async function worktreeEvidence({ task }) {
  if (!task.worktreePath) throw new Error("Task has no worktree.");
  const { stdout: exactHead } = await git(task.worktreePath, ["rev-parse", "HEAD"]);
  const { stdout: status } = await git(task.worktreePath, ["status", "--short"]);
  const { stdout: changedFiles } = await git(task.worktreePath, [
    "diff",
    "--name-only",
    `${task.baseHead}...HEAD`,
  ]);
  const { stdout: statSummary } = await git(task.worktreePath, [
    "diff",
    "--stat",
    `${task.baseHead}...HEAD`,
  ]);
  return {
    exactHead,
    clean: status.length === 0,
    status,
    changedFiles: changedFiles ? changedFiles.split("\n").filter(Boolean) : [],
    statSummary,
  };
}

export async function removeTaskWorktree({ project, task }) {
  if (!task.worktreePath || !(await exists(task.worktreePath))) return false;
  await execFileAsync("git", ["-C", project.rootPath, "worktree", "remove", task.worktreePath], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return true;
}

export function newRunId() {
  return createId("run");
}
