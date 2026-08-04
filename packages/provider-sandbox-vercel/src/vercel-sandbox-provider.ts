import { createHash } from "node:crypto";

import type {
  SandboxExecResult,
  SandboxExposeResult,
  SandboxLimits,
  SandboxProvider,
} from "@cyclewarden/forge-domain";

export type VercelSandboxNetworkPolicy =
  | { mode: "deny-all" }
  | { mode: "allow-only"; hosts: string[] };

export interface VercelSandboxResourceLimits {
  cpuMillis: number;
  memoryMb: number;
  storageMb: number;
}

export interface VercelSandboxCreateInput {
  name: string;
  runtime: "node24";
  timeoutMs: number;
  persistent: false;
  ports: number[];
  networkPolicy: VercelSandboxNetworkPolicy;
  resources: VercelSandboxResourceLimits;
  tags: Record<string, string>;
}

export interface VercelSandboxCommandResult {
  exitCode: number;
  stdout: string | (() => Promise<string>);
  stderr: string | (() => Promise<string>);
  durationMs?: number;
  startedAt?: string;
  finishedAt?: string;
}

export interface VercelSandboxClient {
  readonly sandboxId: string;
  readonly expiresAt: string;

  runCommand(input: {
    command: string;
    args: string[];
    cwd?: string;
    timeoutMs: number;
    environment?: Record<string, string>;
  }): Promise<VercelSandboxCommandResult>;

  domain(port: number): string;
  stop(): Promise<void>;
  delete(): Promise<void>;
}

export interface VercelSandboxClientFactory {
  create(input: VercelSandboxCreateInput): Promise<VercelSandboxClient>;
  get(sandboxId: string): Promise<VercelSandboxClient>;
}

export interface VercelSandboxRepositoryBootstrapper {
  bootstrap(input: {
    sandbox: VercelSandboxClient;
    repositoryUrl: string;
    repositoryCredentialHandle: string;
    baseBranch: string;
  }): Promise<void>;
}

export interface VercelSandboxRecord {
  sandboxId: string;
  runId: string;
  expiresAt: string;
  maxCommandTimeoutMs: number;
  exposedPorts: number[];
  status: "running" | "stopped";
}

export interface VercelSandboxRegistry {
  register(record: VercelSandboxRecord): Promise<void>;
  get(sandboxId: string): Promise<VercelSandboxRecord | null>;
  markStopped(input: {
    sandboxId: string;
    reason: string;
    stoppedAt: string;
  }): Promise<void>;
  remove(sandboxId: string): Promise<void>;
}

export class VercelSandboxProviderError extends Error {
  constructor(
    readonly code:
      | "INVALID_INPUT"
      | "LIMIT_EXCEEDED"
      | "SANDBOX_NOT_FOUND"
      | "SANDBOX_NOT_RUNNING"
      | "EXPOSURE_DENIED"
      | "SENSITIVE_ENVIRONMENT_DENIED"
      | "PROVIDER_CONFLICT"
      | "PROVIDER_UNAVAILABLE",
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "VercelSandboxProviderError";
  }
}

export interface VercelSandboxProviderDependencies {
  clients: VercelSandboxClientFactory;
  repositories: VercelSandboxRepositoryBootstrapper;
  registry: VercelSandboxRegistry;
  now?: () => Date;
  maximumTimeoutMs?: number;
  maximumCpuMillis?: number;
  maximumMemoryMb?: number;
  maximumStorageMb?: number;
  maximumPorts?: number;
  maximumOutputBytes?: number;
}

interface NormalizedSandboxPolicy {
  timeoutMs: number;
  resources: VercelSandboxResourceLimits;
  ports: number[];
  networkPolicy: VercelSandboxNetworkPolicy;
}

const HOST_PATTERN = /^(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const SANDBOX_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;
const SENSITIVE_ENVIRONMENT_PATTERN =
  /(?:^|_)(?:TOKEN|SECRET|PASSWORD|PRIVATE_KEY|API_KEY|ACCESS_KEY|CREDENTIAL|AUTH)(?:_|$)/i;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

function assertNonEmptySafeText(value: string, name: string): string {
  const normalized = value.trim();
  if (normalized.length === 0 || CONTROL_CHARACTER_PATTERN.test(normalized)) {
    throw new VercelSandboxProviderError(
      "INVALID_INPUT",
      `${name} must be non-empty and contain no control characters.`,
    );
  }
  return normalized;
}

function assertPositiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new VercelSandboxProviderError(
      "INVALID_INPUT",
      `${name} must be a positive safe integer.`,
    );
  }
  return value;
}

function normalizeRepositoryUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    throw new VercelSandboxProviderError(
      "INVALID_INPUT",
      "Repository URL is invalid.",
      error,
    );
  }
  if (
    url.protocol !== "https:" ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.search.length > 0 ||
    url.hash.length > 0
  ) {
    throw new VercelSandboxProviderError(
      "INVALID_INPUT",
      "Repository URL must be credential-free HTTPS without query or fragment data.",
    );
  }
  return url.toString();
}

function normalizeHosts(hosts: string[]): string[] {
  if (!Array.isArray(hosts) || hosts.length > 100) {
    throw new VercelSandboxProviderError(
      "INVALID_INPUT",
      "Sandbox allowedHosts must contain at most 100 entries.",
    );
  }

  const normalized = new Set<string>();
  for (const host of hosts) {
    const candidate = host.trim().toLowerCase().replace(/\.$/, "");
    if (
      !HOST_PATTERN.test(candidate) ||
      candidate === "localhost" ||
      candidate.endsWith(".localhost") ||
      candidate.endsWith(".local")
    ) {
      throw new VercelSandboxProviderError(
        "INVALID_INPUT",
        "Sandbox network allowlist entries must be public DNS host patterns without schemes, paths, or ports.",
      );
    }
    normalized.add(candidate);
  }
  return [...normalized].sort();
}

function normalizePorts(ports: number[] | undefined, maximumPorts: number): number[] {
  if (ports === undefined) return [];
  if (!Array.isArray(ports) || ports.length > maximumPorts) {
    throw new VercelSandboxProviderError(
      "LIMIT_EXCEEDED",
      `Sandbox exposedPorts may contain at most ${maximumPorts} ports.`,
    );
  }

  const normalized = new Set<number>();
  for (const port of ports) {
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new VercelSandboxProviderError(
        "INVALID_INPUT",
        "Sandbox exposed ports must be integers between 1 and 65535.",
      );
    }
    normalized.add(port);
  }
  return [...normalized].sort((left, right) => left - right);
}

function sandboxName(runId: string): string {
  const digest = createHash("sha256").update(runId).digest("hex").slice(0, 20);
  return `atoryn-${digest}`;
}

async function readOutput(
  value: string | (() => Promise<string>),
): Promise<string> {
  return typeof value === "string" ? value : value();
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function computeDurationMs(result: VercelSandboxCommandResult): number {
  if (
    result.durationMs !== undefined &&
    Number.isFinite(result.durationMs) &&
    result.durationMs >= 0
  ) {
    return Math.floor(result.durationMs);
  }
  if (result.startedAt !== undefined && result.finishedAt !== undefined) {
    const startedAt = Date.parse(result.startedAt);
    const finishedAt = Date.parse(result.finishedAt);
    if (Number.isFinite(startedAt) && Number.isFinite(finishedAt) && finishedAt >= startedAt) {
      return finishedAt - startedAt;
    }
  }
  return 0;
}

export class VercelSandboxProvider implements SandboxProvider {
  readonly key = "vercel-sandbox";
  private readonly now: () => Date;
  private readonly maximumTimeoutMs: number;
  private readonly maximumCpuMillis: number;
  private readonly maximumMemoryMb: number;
  private readonly maximumStorageMb: number;
  private readonly maximumPorts: number;
  private readonly maximumOutputBytes: number;

  constructor(private readonly dependencies: VercelSandboxProviderDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.maximumTimeoutMs = dependencies.maximumTimeoutMs ?? 24 * 60 * 60 * 1_000;
    this.maximumCpuMillis = dependencies.maximumCpuMillis ?? 8_000;
    this.maximumMemoryMb = dependencies.maximumMemoryMb ?? 8_192;
    this.maximumStorageMb = dependencies.maximumStorageMb ?? 10_240;
    this.maximumPorts = dependencies.maximumPorts ?? 15;
    this.maximumOutputBytes = dependencies.maximumOutputBytes ?? 1_048_576;

    for (const [name, value] of [
      ["maximumTimeoutMs", this.maximumTimeoutMs],
      ["maximumCpuMillis", this.maximumCpuMillis],
      ["maximumMemoryMb", this.maximumMemoryMb],
      ["maximumStorageMb", this.maximumStorageMb],
      ["maximumPorts", this.maximumPorts],
      ["maximumOutputBytes", this.maximumOutputBytes],
    ] as const) {
      assertPositiveInteger(value, name);
    }
  }

  async create(input: Parameters<SandboxProvider["create"]>[0]): Promise<{
    sandboxId: string;
    expiresAt: string;
  }> {
    const runId = assertNonEmptySafeText(input.runId, "Run ID");
    const repositoryUrl = normalizeRepositoryUrl(input.repositoryUrl);
    const repositoryCredentialHandle = assertNonEmptySafeText(
      input.repositoryCredentialHandle,
      "Repository credential handle",
    );
    const baseBranch = assertNonEmptySafeText(input.baseBranch, "Base branch");
    const policy = this.normalizePolicy(input.limits);

    let sandbox: VercelSandboxClient;
    try {
      sandbox = await this.dependencies.clients.create({
        name: sandboxName(runId),
        runtime: "node24",
        timeoutMs: policy.timeoutMs,
        persistent: false,
        ports: policy.ports,
        networkPolicy: policy.networkPolicy,
        resources: policy.resources,
        tags: {
          "atoryn.run_id_sha256": createHash("sha256").update(runId).digest("hex"),
          "atoryn.lifecycle": "ephemeral",
        },
      });
    } catch (error) {
      throw new VercelSandboxProviderError(
        "PROVIDER_UNAVAILABLE",
        "Vercel Sandbox creation failed.",
        error,
      );
    }

    try {
      this.assertSandboxIdentity(sandbox);
      const expiresAt = this.validateExpiry(sandbox.expiresAt, policy.timeoutMs);
      await this.dependencies.repositories.bootstrap({
        sandbox,
        repositoryUrl,
        repositoryCredentialHandle,
        baseBranch,
      });
      await this.dependencies.registry.register({
        sandboxId: sandbox.sandboxId,
        runId,
        expiresAt,
        maxCommandTimeoutMs: policy.timeoutMs,
        exposedPorts: policy.ports,
        status: "running",
      });
      return { sandboxId: sandbox.sandboxId, expiresAt };
    } catch (error) {
      try {
        await sandbox.delete();
      } catch {
        // Preserve the root failure while making a best-effort cleanup attempt.
      }
      if (error instanceof VercelSandboxProviderError) throw error;
      throw new VercelSandboxProviderError(
        "PROVIDER_UNAVAILABLE",
        "Vercel Sandbox repository bootstrap or registration failed.",
        error,
      );
    }
  }

  async execute(
    input: Parameters<SandboxProvider["execute"]>[0],
  ): Promise<SandboxExecResult> {
    const record = await this.requireRunningRecord(input.sandboxId);
    const command = assertNonEmptySafeText(input.command, "Sandbox command");
    const args = this.normalizeArgs(input.args);
    const timeoutMs = assertPositiveInteger(input.timeoutMs, "Command timeout");
    const remainingMs = Date.parse(record.expiresAt) - this.now().getTime();
    if (
      timeoutMs > record.maxCommandTimeoutMs ||
      remainingMs < 1 ||
      timeoutMs > remainingMs
    ) {
      throw new VercelSandboxProviderError(
        "LIMIT_EXCEEDED",
        "Sandbox command timeout exceeds the run policy or remaining sandbox lifetime.",
      );
    }

    const request: Parameters<VercelSandboxClient["runCommand"]>[0] = {
      command,
      args,
      timeoutMs,
    };
    if (input.cwd !== undefined) request.cwd = this.normalizeCwd(input.cwd);
    if (input.environment !== undefined) {
      request.environment = this.normalizeEnvironment(input.environment);
    }

    let result: VercelSandboxCommandResult;
    try {
      const sandbox = await this.dependencies.clients.get(record.sandboxId);
      result = await sandbox.runCommand(request);
    } catch (error) {
      throw new VercelSandboxProviderError(
        "PROVIDER_UNAVAILABLE",
        "Vercel Sandbox command execution failed.",
        error,
      );
    }

    if (!Number.isInteger(result.exitCode)) {
      throw new VercelSandboxProviderError(
        "PROVIDER_CONFLICT",
        "Vercel Sandbox returned an invalid command exit code.",
      );
    }
    const stdout = await readOutput(result.stdout);
    const stderr = await readOutput(result.stderr);
    if (
      byteLength(stdout) > this.maximumOutputBytes ||
      byteLength(stderr) > this.maximumOutputBytes
    ) {
      throw new VercelSandboxProviderError(
        "LIMIT_EXCEEDED",
        "Vercel Sandbox command output exceeded the configured capture limit.",
      );
    }

    return {
      exitCode: result.exitCode,
      stdout,
      stderr,
      durationMs: computeDurationMs(result),
    };
  }

  async expose(
    input: Parameters<SandboxProvider["expose"]>[0],
  ): Promise<SandboxExposeResult> {
    const record = await this.requireRunningRecord(input.sandboxId);
    const port = assertPositiveInteger(input.port, "Sandbox port");
    if (!record.exposedPorts.includes(port)) {
      throw new VercelSandboxProviderError(
        "EXPOSURE_DENIED",
        "The requested port was not approved when the sandbox was created.",
      );
    }

    let rawUrl: string;
    try {
      const sandbox = await this.dependencies.clients.get(record.sandboxId);
      rawUrl = sandbox.domain(port);
    } catch (error) {
      throw new VercelSandboxProviderError(
        "PROVIDER_UNAVAILABLE",
        "Vercel Sandbox exposure failed.",
        error,
      );
    }

    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch (error) {
      throw new VercelSandboxProviderError(
        "PROVIDER_CONFLICT",
        "Vercel Sandbox returned an invalid exposure URL.",
        error,
      );
    }
    if (
      url.protocol !== "https:" ||
      url.username.length > 0 ||
      url.password.length > 0 ||
      url.hostname.length === 0
    ) {
      throw new VercelSandboxProviderError(
        "PROVIDER_CONFLICT",
        "Vercel Sandbox exposure URL must be credential-free HTTPS.",
      );
    }
    return { port, url: url.toString() };
  }

  async stop(input: Parameters<SandboxProvider["stop"]>[0]): Promise<void> {
    const record = await this.requireRunningRecord(input.sandboxId);
    const reason = assertNonEmptySafeText(input.reason, "Sandbox stop reason");
    try {
      const sandbox = await this.dependencies.clients.get(record.sandboxId);
      await sandbox.stop();
      await this.dependencies.registry.markStopped({
        sandboxId: record.sandboxId,
        reason,
        stoppedAt: this.now().toISOString(),
      });
    } catch (error) {
      throw new VercelSandboxProviderError(
        "PROVIDER_UNAVAILABLE",
        "Vercel Sandbox stop failed.",
        error,
      );
    }
  }

  async destroy(input: Parameters<SandboxProvider["destroy"]>[0]): Promise<void> {
    const sandboxId = this.normalizeSandboxId(input.sandboxId);
    const record = await this.dependencies.registry.get(sandboxId);
    if (record === null) {
      throw new VercelSandboxProviderError(
        "SANDBOX_NOT_FOUND",
        "The sandbox is not registered for this provider.",
      );
    }
    try {
      const sandbox = await this.dependencies.clients.get(sandboxId);
      await sandbox.delete();
      await this.dependencies.registry.remove(sandboxId);
    } catch (error) {
      throw new VercelSandboxProviderError(
        "PROVIDER_UNAVAILABLE",
        "Vercel Sandbox deletion failed.",
        error,
      );
    }
  }

  private normalizePolicy(limits: SandboxLimits): NormalizedSandboxPolicy {
    const timeoutMs = assertPositiveInteger(limits.timeoutMs, "Sandbox timeout");
    const cpuMillis = assertPositiveInteger(limits.cpuMillis, "Sandbox CPU limit");
    const memoryMb = assertPositiveInteger(limits.memoryMb, "Sandbox memory limit");
    const storageMb = assertPositiveInteger(limits.storageMb, "Sandbox storage limit");
    if (
      timeoutMs > this.maximumTimeoutMs ||
      cpuMillis > this.maximumCpuMillis ||
      memoryMb > this.maximumMemoryMb ||
      storageMb > this.maximumStorageMb
    ) {
      throw new VercelSandboxProviderError(
        "LIMIT_EXCEEDED",
        "Sandbox resource policy exceeds the configured Vercel provider ceiling.",
      );
    }
    const hosts = normalizeHosts(limits.allowedHosts);
    const ports = normalizePorts(limits.exposedPorts, this.maximumPorts);
    return {
      timeoutMs,
      resources: { cpuMillis, memoryMb, storageMb },
      ports,
      networkPolicy:
        hosts.length === 0
          ? { mode: "deny-all" }
          : { mode: "allow-only", hosts },
    };
  }

  private normalizeArgs(args: string[]): string[] {
    if (!Array.isArray(args) || args.length > 256) {
      throw new VercelSandboxProviderError(
        "INVALID_INPUT",
        "Sandbox command args must contain at most 256 values.",
      );
    }
    return args.map((arg) => {
      if (typeof arg !== "string" || CONTROL_CHARACTER_PATTERN.test(arg)) {
        throw new VercelSandboxProviderError(
          "INVALID_INPUT",
          "Sandbox command args must be strings without control characters.",
        );
      }
      return arg;
    });
  }

  private normalizeCwd(cwd: string): string {
    const normalized = assertNonEmptySafeText(cwd, "Sandbox working directory");
    if (!normalized.startsWith("/") || normalized.includes("..")) {
      throw new VercelSandboxProviderError(
        "INVALID_INPUT",
        "Sandbox working directory must be an absolute path without parent traversal.",
      );
    }
    return normalized;
  }

  private normalizeEnvironment(
    environment: Record<string, string>,
  ): Record<string, string> {
    const entries = Object.entries(environment);
    if (entries.length > 100) {
      throw new VercelSandboxProviderError(
        "LIMIT_EXCEEDED",
        "Sandbox environment may contain at most 100 entries.",
      );
    }
    const normalized: Record<string, string> = {};
    for (const [key, value] of entries) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
        throw new VercelSandboxProviderError(
          "INVALID_INPUT",
          "Sandbox environment names must be portable identifiers.",
        );
      }
      if (SENSITIVE_ENVIRONMENT_PATTERN.test(key)) {
        throw new VercelSandboxProviderError(
          "SENSITIVE_ENVIRONMENT_DENIED",
          "Secrets and credentials must be brokered outside the sandbox environment.",
        );
      }
      if (typeof value !== "string" || CONTROL_CHARACTER_PATTERN.test(value)) {
        throw new VercelSandboxProviderError(
          "INVALID_INPUT",
          "Sandbox environment values must be strings without control characters.",
        );
      }
      normalized[key] = value;
    }
    return normalized;
  }

  private normalizeSandboxId(sandboxId: string): string {
    const normalized = sandboxId.trim();
    if (!SANDBOX_ID_PATTERN.test(normalized)) {
      throw new VercelSandboxProviderError(
        "INVALID_INPUT",
        "Vercel sandbox ID is invalid.",
      );
    }
    return normalized;
  }

  private assertSandboxIdentity(sandbox: VercelSandboxClient): void {
    this.normalizeSandboxId(sandbox.sandboxId);
  }

  private validateExpiry(value: string, timeoutMs: number): string {
    const expiresAtMs = Date.parse(value);
    const nowMs = this.now().getTime();
    if (
      !Number.isFinite(expiresAtMs) ||
      expiresAtMs <= nowMs ||
      expiresAtMs > nowMs + timeoutMs + 60_000
    ) {
      throw new VercelSandboxProviderError(
        "PROVIDER_CONFLICT",
        "Vercel Sandbox returned an expiry outside the requested ephemeral window.",
      );
    }
    return new Date(expiresAtMs).toISOString();
  }

  private async requireRunningRecord(
    sandboxId: string,
  ): Promise<VercelSandboxRecord> {
    const normalized = this.normalizeSandboxId(sandboxId);
    const record = await this.dependencies.registry.get(normalized);
    if (record === null) {
      throw new VercelSandboxProviderError(
        "SANDBOX_NOT_FOUND",
        "The sandbox is not registered for this provider.",
      );
    }
    if (record.status !== "running" || Date.parse(record.expiresAt) <= this.now().getTime()) {
      throw new VercelSandboxProviderError(
        "SANDBOX_NOT_RUNNING",
        "The sandbox is stopped or expired.",
      );
    }
    return record;
  }
}
