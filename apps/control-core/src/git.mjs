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
    health: {
      available: true,
      head,
      branch,
      dirty: false,
      changedFiles: 0,
      headMoved: false,
      changedAt: nowIso(),
    },
    agentsPath,
    contractPath: (await exists(contractPath)) ? contractPath : null,
    contract: contractResult.contract,
    contractWarnings: contractResult.warnings,
    packageManager,
    verification,
    registeredAt: nowIso(),
  };
}

export async function inspectProjectHealth(project) {
  const checkedAt = nowIso();
  try {
    const { stdout: head } = await git(project.rootPath, ["rev-parse", "HEAD"], { timeout: 5000 });
    let branch = "HEAD";
    try {
      branch = (await git(project.rootPath, ["symbolic-ref", "--short", "HEAD"], { timeout: 5000 })).stdout;
    } catch {
      branch = "HEAD";
    }
    const { stdout: status } = await git(project.rootPath, ["status", "--porcelain=v1"], { timeout: 8000 });
    const changedFiles = status ? status.split("\n").filter(Boolean).length : 0;
    return {
      available: true,
      head,
      branch,
      dirty: changedFiles > 0,
      changedFiles,
      headMoved: Boolean(project.registeredHead && project.registeredHead !== head),
      checkedAt,
    };
  } catch (error) {
    return {
      available: false,
      head: null,
      branch: null,
      dirty: null,
      changedFiles: null,
      headMoved: null,
      checkedAt,
      error: String(error?.message || error).slice(0, 500),
    };
  }
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "task";
}

function taskBranch(task) {
  if (task.branch) return task.branch;
  const shortId = task.id.replace(/^task_/, "").slice(0, 8);
  return `cyclewarden/${shortId}-${slugify(task.title)}`;
}

async function localBranchExists(project, branch) {
  try {
    await git(project.rootPath, ["show-ref", "--verify", `refs/heads/${branch}`], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export async function createTaskWorktree({ project, task, dataDir }) {
  const worktreesRoot = path.join(dataDir, "worktrees");
  await mkdir(worktreesRoot, { recursive: true });
  const branch = taskBranch(task);
  const worktreePath = path.join(worktreesRoot, task.id);

  if (await exists(worktreePath)) {
    const { stdout: existingRoot } = await git(worktreePath, ["rev-parse", "--show-toplevel"]);
    const { stdout: exactHead } = await git(worktreePath, ["rev-parse", "HEAD"]);
    return { branch, worktreePath: existingRoot, baseHead: task.baseHead, exactHead, reused: true };
  }

  const branchExists = await localBranchExists(project, branch);
  const args = branchExists
    ? ["-C", project.rootPath, "worktree", "add", worktreePath, branch]
    : ["-C", project.rootPath, "worktree", "add", "-b", branch, worktreePath, task.baseHead];
  await execFileAsync("git", args, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });

  const { stdout: exactHead } = await git(worktreePath, ["rev-parse", "HEAD"]);
  return { branch, worktreePath, baseHead: task.baseHead, exactHead, reused: branchExists };
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

export async function inspectInterruptedWorktree({ project, task, dataDir }) {
  const expectedPath = task.worktreePath || path.join(dataDir, "worktrees", task.id);
  const branch = taskBranch(task);
  const branchExists = await localBranchExists(project, branch);
  if (!(await exists(expectedPath))) {
    return {
      canResume: branchExists,
      worktreeExists: false,
      branchExists,
      branch,
      worktreePath: expectedPath,
      clean: null,
      exactHead: null,
      changedFiles: [],
      reason: branchExists ? "WORKTREE_MISSING_BRANCH_RECOVERABLE" : "WORKTREE_AND_BRANCH_MISSING",
      inspectedAt: nowIso(),
    };
  }

  try {
    const recoveryTask = { ...task, branch, worktreePath: expectedPath };
    const evidence = await worktreeEvidence({ task: recoveryTask });
    return {
      canResume: true,
      worktreeExists: true,
      branchExists,
      branch,
      worktreePath: expectedPath,
      clean: evidence.clean,
      exactHead: evidence.exactHead,
      changedFiles: evidence.changedFiles,
      reason: evidence.clean ? "WORKTREE_CLEAN" : "WORKTREE_DIRTY",
      inspectedAt: nowIso(),
    };
  } catch (error) {
    return {
      canResume: branchExists,
      worktreeExists: true,
      branchExists,
      branch,
      worktreePath: expectedPath,
      clean: null,
      exactHead: null,
      changedFiles: [],
      reason: "WORKTREE_INSPECTION_FAILED",
      error: String(error?.message || error).slice(0, 500),
      inspectedAt: nowIso(),
    };
  }
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
