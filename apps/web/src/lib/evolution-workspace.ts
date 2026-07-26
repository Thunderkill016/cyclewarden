import "server-only";

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import { basename, dirname, parse, resolve } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";

export type CycleSummary = {
  cycleId: string;
  objective: string;
  stage: string;
  autonomy: string;
  risk: string;
  updatedAt: string;
};

export type OpportunityView = {
  recordId: string;
  title: string;
  problem: string;
  smallestExperiment: string;
};

export type DecisionView = {
  selectedOpportunityId: string;
  rejectedOpportunityIds: string[];
  rationale: string;
};

export type ExperimentView = {
  hypothesis: string;
  method: string;
  successCriteria: string[];
};

export type HandoffView = {
  parameterDigest: string;
  allowedScope: string[];
  forbiddenScope: string[];
  acceptanceCriteria: string[];
  verificationPlan: string[];
};

export type ResearchRunView = {
  adapter: string;
  outcome: string;
  usage: {
    queries: number;
    sources: number;
    minutes: number;
    costUsd: number;
  };
  coverage: {
    required: string[];
    answered: string[];
    gaps: string[];
  };
  stopReason: string;
};

export type ResearchEvaluationView = {
  actor: string;
  verdict: string;
  checks: Array<{ id: string; passed: boolean; summary: string }>;
  unsupportedClaimIds: string[];
  unresolvedContradictionIds: string[];
  limitations: string[];
};

export type ResearchView = {
  runs?: ResearchRunView[];
  sources: Array<{ recordId: string }>;
  claims: Array<{ recordId: string }>;
  contradictions: Array<{ recordId: string }>;
  opportunities: OpportunityView[];
  evaluations?: ResearchEvaluationView[];
  decisions: DecisionView[];
  experiments: ExperimentView[];
  executionHandoffs: HandoffView[];
};

export type CycleView = {
  cycleId: string;
  objective: string;
  stage: string;
  autonomy: string;
  risk: string;
  history: unknown[];
  artifacts: Record<string, string[]>;
  research?: ResearchView;
};

export type EvolutionProjectSummary = {
  id: string;
  label: string;
};

export type EvolutionProjectContext = EvolutionProjectSummary & {
  projectRoot: string;
  stateRoot: string;
};

type StatusOutput = {
  root: string;
  cycles: CycleSummary[];
};

type ShowOutput = {
  cycle: CycleView;
};

type ProjectDefinition = {
  id: string;
  label: string;
  projectRoot: string;
  stateRoot: string;
};

type ProjectRegistry = {
  defaultProjectId: string;
  projects: ProjectDefinition[];
};

const ProjectIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);

const ProjectDefinitionSchema = z
  .object({
    id: ProjectIdSchema,
    label: z.string().trim().min(1).max(80),
    projectRoot: z.string().trim().min(1).max(4096),
    stateRoot: z.string().trim().min(1).max(4096),
  })
  .strict();

const ProjectRegistrySchema = z
  .object({
    version: z.literal(1),
    defaultProjectId: ProjectIdSchema.optional(),
    projects: z.array(ProjectDefinitionSchema).min(1).max(32),
  })
  .strict();

const execFileAsync = promisify(execFile);
const MAX_CLI_OUTPUT_BYTES = 4 * 1024 * 1024;
const MAX_CLI_RUNTIME_MS = 10 * 60 * 1000;

export function resolveCycleWardenRepositoryRoot(): string {
  const cwd = process.cwd();
  return basename(cwd) === "web" && basename(dirname(cwd)) === "apps"
    ? resolve(cwd, "../..")
    : cwd;
}

function configuredEvolutionProjectRoot(): string {
  const repositoryRoot = resolveCycleWardenRepositoryRoot();
  return resolve(repositoryRoot, process.env.CYCLEWARDEN_PROJECT_ROOT ?? ".");
}

/** A display-safe label; the configured absolute path remains server-only. */
export function resolveEvolutionProjectRoot(): string {
  return process.env.CYCLEWARDEN_PROJECT_LABEL?.trim() || "server-configured trusted repository";
}

export function resolveEvolutionStateRoot(): string {
  const repositoryRoot = resolveCycleWardenRepositoryRoot();
  const configuredRoot =
    process.env.CYCLEWARDEN_STATE_ROOT ?? process.env.SHIPKIT_STATE_ROOT;
  if (configuredRoot) return resolve(repositoryRoot, configuredRoot);

  const canonicalRoot = resolve(repositoryRoot, ".cyclewarden");
  const legacyRoot = resolve(repositoryRoot, ".shipkit");
  return existsSync(canonicalRoot) || !existsSync(legacyRoot) ? canonicalRoot : legacyRoot;
}

async function assertProjectDirectory(requestedRoot: string): Promise<string> {
  let projectRoot: string;
  try {
    projectRoot = await realpath(requestedRoot);
  } catch {
    throw new Error("Configured project root does not exist");
  }
  if (projectRoot === parse(projectRoot).root) {
    throw new Error("Configured project root may not target a filesystem root");
  }
  const info = await stat(projectRoot);
  if (!info.isDirectory()) {
    throw new Error("Configured project root is not a directory");
  }
  return projectRoot;
}

export async function assertEvolutionProjectRoot(): Promise<string> {
  return assertProjectDirectory(configuredEvolutionProjectRoot());
}

function legacyProjectRegistry(): ProjectRegistry {
  return {
    defaultProjectId: "default",
    projects: [
      {
        id: "default",
        label: resolveEvolutionProjectRoot(),
        projectRoot: configuredEvolutionProjectRoot(),
        stateRoot: resolveEvolutionStateRoot(),
      },
    ],
  };
}

async function loadProjectRegistry(): Promise<ProjectRegistry> {
  const configuredFile = process.env.CYCLEWARDEN_PROJECTS_FILE?.trim();
  if (!configuredFile) return legacyProjectRegistry();

  const registryPath = resolve(resolveCycleWardenRepositoryRoot(), configuredFile);
  let source: string;
  try {
    source = await readFile(registryPath, "utf8");
  } catch {
    throw new Error("Configured CycleWarden project registry could not be read");
  }

  let json: unknown;
  try {
    json = JSON.parse(source);
  } catch {
    throw new Error("Configured CycleWarden project registry is not valid JSON");
  }

  const parsed = ProjectRegistrySchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`Invalid CycleWarden project registry: ${issue?.message ?? "schema mismatch"}`);
  }

  const data = parsed.data as { defaultProjectId?: string; projects: ProjectDefinition[] };
  const ids = data.projects.map((project) => project.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Invalid CycleWarden project registry: project IDs must be unique");
  }

  const defaultProjectId = data.defaultProjectId ?? data.projects[0].id;
  if (!ids.includes(defaultProjectId)) {
    throw new Error("Invalid CycleWarden project registry: defaultProjectId is not configured");
  }

  const repositoryRoot = resolveCycleWardenRepositoryRoot();
  const projects = data.projects.map((project) => ({
    ...project,
    projectRoot: resolve(repositoryRoot, project.projectRoot),
    stateRoot: resolve(repositoryRoot, project.stateRoot),
  }));
  const stateRoots = projects.map((project) => project.stateRoot);
  if (new Set(stateRoots).size !== stateRoots.length) {
    throw new Error("Invalid CycleWarden project registry: state roots must be unique");
  }

  return { defaultProjectId, projects };
}

export async function resolveEvolutionProjectContext(requestedProjectId?: string): Promise<{
  projects: EvolutionProjectSummary[];
  selected: EvolutionProjectContext;
}> {
  const registry = await loadProjectRegistry();
  const requested = requestedProjectId?.trim();
  if (requested && !ProjectIdSchema.safeParse(requested).success) {
    throw new Error("Invalid configured project ID");
  }

  const selectedId = requested || registry.defaultProjectId;
  const definition = registry.projects.find((project) => project.id === selectedId);
  if (!definition) {
    throw new Error("Requested project is not present in the server-configured registry");
  }

  const stateRoot = resolve(definition.stateRoot);
  if (stateRoot === parse(stateRoot).root) {
    throw new Error("Configured project state root may not target a filesystem root");
  }

  return {
    projects: registry.projects.map(({ id, label }) => ({ id, label })),
    selected: {
      id: definition.id,
      label: definition.label,
      projectRoot: await assertProjectDirectory(definition.projectRoot),
      stateRoot,
    },
  };
}

function evolutionCliPath(): string {
  const repositoryRoot = resolveCycleWardenRepositoryRoot();
  return resolve(
    repositoryRoot,
    process.env.CYCLEWARDEN_EVOLUTION_CLI ??
      process.env.SHIPKIT_EVOLUTION_CLI ??
      "packages/evolution-core/dist/cli.js"
  );
}

function cliErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const stderr = "stderr" in error ? String(error.stderr ?? "").trim() : "";
    if (stderr) {
      return stderr.replace(/^cyclewarden-evolve:\s*/i, "").slice(0, 800);
    }
  }
  return (error instanceof Error ? error.message : String(error)).slice(0, 800);
}

export async function runEvolutionCoreCli<T>(args: string[]): Promise<T> {
  try {
    const { stdout } = await execFileAsync(process.execPath, [evolutionCliPath(), ...args], {
      cwd: resolveCycleWardenRepositoryRoot(),
      env: process.env,
      maxBuffer: MAX_CLI_OUTPUT_BYTES,
      timeout: MAX_CLI_RUNTIME_MS,
      windowsHide: true,
    });
    return JSON.parse(stdout) as T;
  } catch (error) {
    throw new Error(cliErrorMessage(error));
  }
}

export async function loadEvolutionWorkspace(selectedCycleId?: string, projectId?: string) {
  let registry: Awaited<ReturnType<typeof resolveEvolutionProjectContext>>;
  try {
    registry = await resolveEvolutionProjectContext(projectId);
  } catch (error) {
    return {
      root: basename(resolveEvolutionStateRoot()),
      projects: [] as EvolutionProjectSummary[],
      project: null as EvolutionProjectSummary | null,
      summaries: [] as CycleSummary[],
      selected: null as CycleView | null,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const root = registry.selected.stateRoot;
  const project = { id: registry.selected.id, label: registry.selected.label };
  try {
    const status = await runEvolutionCoreCli<StatusOutput>(["status", "--root", root]);
    const selectedSummary =
      status.cycles.find((cycle) => cycle.cycleId === selectedCycleId) ??
      status.cycles[0] ??
      null;
    const selected = selectedSummary
      ? (await runEvolutionCoreCli<ShowOutput>([
          "show",
          selectedSummary.cycleId,
          "--root",
          root,
        ])).cycle
      : null;
    return {
      root: basename(status.root),
      projects: registry.projects,
      project,
      summaries: status.cycles,
      selected,
      error: null,
    };
  } catch (error) {
    return {
      root: basename(root),
      projects: registry.projects,
      project,
      summaries: [] as CycleSummary[],
      selected: null as CycleView | null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
