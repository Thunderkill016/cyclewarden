import { access, mkdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { createId, nowIso } from "./domain.mjs";

const execFileAsync = promisify(execFile);
const SAFE_SCRIPT_NAME = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$/;

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

function parseSafeContractCheck(value) {
  if (typeof value !== "string") return null;
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 3 && parts[0] === "npm" && parts[1] === "run" && SAFE_SCRIPT_NAME.test(parts[2])) {
    return { name: `contract:${parts[2]}`, command: "npm", args: ["run", parts[2]], source: "agent-contract" };
  }
  if (parts.length === 3 && parts[0] === "pnpm" && parts[1] === "run" && SAFE_SCRIPT_NAME.test(parts[2])) {
    return { name: `contract:${parts[2]}`, command: "pnpm", args: ["run", parts[2]], source: "agent-contract" };
  }
  if (parts.length === 2 && parts[0] === "pnpm" && SAFE_SCRIPT_NAME.test(parts[1])) {
    return { name: `contract:${parts[1]}`, command: "pnpm", args: [parts[1]], source: "agent-contract" };
  }
  if (parts.length === 2 && parts[0] === "yarn" && SAFE_SCRIPT_NAME.test(parts[1])) {
    return { name: `contract:${parts[1]}`, command: "yarn", args: [parts[1]], source: "agent-contract" };
  }
  if (parts.length === 3 && parts[0] === "bun" && parts[1] === "run" && SAFE_SCRIPT_NAME.test(parts[2])) {
    return { name: `contract:${parts[2]}`, command: "bun", args: ["run", parts[2]], source: "agent-contract" };
  }
  return null;
}

async function readAgentContract(contractPath) {
  if (!(await exists(contractPath))) return { contract: null, checks: [], warnings: [] };
  try {
    const raw = JSON.parse(await readFile(contractPath, "utf8"));
    const alwaysChecks = Array.isArray(raw?.alwaysChecks) ? raw.alwaysChecks : [];
    const checks = [];
    const warnings = [];
    for (const value of alwaysChecks) {
      const parsed = parseSafeContractCheck(value);
      if (parsed) checks.push(parsed);
      else warnings.push(`Unsupported agent-contract alwaysCheck: ${String(value).slice(0, 200)}`);
    }
    return {
      contract: {
        schemaVersion: raw?.schemaVersion ?? null,
        canonicalInstructionFile:
          typeof raw?.canonicalInstructionFile === "string" ? raw.canonicalInstructionFile : null,
        contextRouter: typeof raw?.contextRouter === "string" ? raw.contextRouter : null,
        minimumNodeMajor: Number.isInteger(raw?.minimumNodeMajor) ? raw.minimumNodeMajor : null,
        stableCheckName: typeof raw?.stableCheckName === "string" ? raw.stableCheckName : null,
      },
      checks,
      warnings,
    };
  } catch (error) {
    return {
      contract: null,
      checks: [],
      warnings: [`Invalid agent-contract.json: ${error.message}`],
    };
  }
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
        if (packageManager === "npm") return { name, command: "npm", args: ["run", name], source: "package" };
        return { name, command: packageManager, args: [name], source: "package" };
      });
  } catch {
    return [];
  }
}

function dedupeChecks(checks) {
  const seen = new Set();
  return checks.filter((check) => {
    const key = [check.command, ...check.args].join("\0");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

  const defaultAgentsPath = path.join(rootPath, "AGENTS.md");
  const contractPath = path.join(rootPath, "agent-contract.json");
  const packageManager = await packageManagerFor(rootPath);
  const contractResult = await readAgentContract(contractPath);
  const instructionCandidate = contractResult.contract?.canonicalInstructionFile
    ? path.join(rootPath, contractResult.contract.canonicalInstructionFile)
    : defaultAgentsPath;
  const agentsPath = (await exists(instructionCandidate))
    ? instructionCandidate
    : (await exists(defaultAgentsPath))
      ? defaultAgentsPath
      : null;
  const discoveredChecks = await discoverVerification(rootPath, packageManager);
  const verification = dedupeChecks([...contractResult.checks, ...discoveredChecks]);

  return {
    id: projectIdFor(rootPath),
    name: path.basename(rootPath),
    rootPath,
    defaultBranch: branch,
    registeredHead: head,
    agentsPath,
    contractPath: (await exists(contractPath)) ? contractPath : null,
    contract: contractResult.contract,
    contractWarnings: contractResult.warnings,
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
