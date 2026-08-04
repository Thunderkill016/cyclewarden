import type {
  SandboxExecResult,
  SandboxExposeResult,
  SandboxProvider,
} from "@cyclewarden/forge-domain";

export class FakeSandboxProvider implements SandboxProvider {
  readonly key = "fake-sandbox";
  readonly createCalls: unknown[] = [];
  readonly executeCalls: unknown[] = [];
  readonly exposeCalls: unknown[] = [];
  readonly stopCalls: unknown[] = [];
  readonly destroyCalls: unknown[] = [];

  constructor(
    private readonly commandResult: SandboxExecResult = {
      exitCode: 0,
      stdout: "13 tests passed",
      stderr: "",
      durationMs: 25,
    },
  ) {}

  async create(input: Parameters<SandboxProvider["create"]>[0]): Promise<{
    sandboxId: string;
    expiresAt: string;
  }> {
    this.createCalls.push(input);
    return {
      sandboxId: `sandbox-${this.createCalls.length}`,
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    };
  }

  async execute(
    input: Parameters<SandboxProvider["execute"]>[0],
  ): Promise<SandboxExecResult> {
    this.executeCalls.push(input);
    return this.commandResult;
  }

  async expose(
    input: Parameters<SandboxProvider["expose"]>[0],
  ): Promise<SandboxExposeResult> {
    this.exposeCalls.push(input);
    return {
      port: input.port,
      url: `https://sandbox-${input.sandboxId}-${input.port}.example.test`,
    };
  }

  async stop(input: Parameters<SandboxProvider["stop"]>[0]): Promise<void> {
    this.stopCalls.push(input);
  }

  async destroy(input: Parameters<SandboxProvider["destroy"]>[0]): Promise<void> {
    this.destroyCalls.push(input);
  }
}
