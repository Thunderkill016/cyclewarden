export interface SandboxLimits {
  timeoutMs: number;
  cpuMillis: number;
  memoryMb: number;
  storageMb: number;
  allowedHosts: string[];
  exposedPorts?: number[];
}

export interface SandboxExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface SandboxExposeResult {
  port: number;
  url: string;
}

export interface SandboxProvider {
  readonly key: string;

  create(input: {
    runId: string;
    repositoryUrl: string;
    repositoryCredentialHandle: string;
    baseBranch: string;
    limits: SandboxLimits;
  }): Promise<{ sandboxId: string; expiresAt: string }>;

  execute(input: {
    sandboxId: string;
    command: string;
    args: string[];
    cwd?: string;
    timeoutMs: number;
    environment?: Record<string, string>;
  }): Promise<SandboxExecResult>;

  expose(input: {
    sandboxId: string;
    port: number;
  }): Promise<SandboxExposeResult>;

  stop(input: { sandboxId: string; reason: string }): Promise<void>;

  destroy(input: { sandboxId: string }): Promise<void>;
}
