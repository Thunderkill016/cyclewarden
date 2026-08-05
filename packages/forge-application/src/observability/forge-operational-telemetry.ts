import { redactSecrets } from "@cyclewarden/forge-domain";

export type ForgeOperationalLevel = "info" | "warn" | "error";

export interface ForgeOperationalLog {
  timestamp: string;
  level: ForgeOperationalLevel;
  event: string;
  workspaceId?: string | undefined;
  runId?: string | undefined;
  provider?: string | undefined;
  state?: string | undefined;
  outcome?: string | undefined;
  failureCode?: string | undefined;
  latencyMs?: number | undefined;
  attributes: Record<string, unknown>;
  redactionCount: number;
}

export interface ForgeMetricPoint {
  name: string;
  value: number;
  timestamp: string;
  tags: Record<string, string>;
}

export interface ForgeOperationalSink {
  writeLog(record: ForgeOperationalLog): void | Promise<void>;
  writeMetric(point: ForgeMetricPoint): void | Promise<void>;
}

export interface ForgeOperationalTelemetryDependencies {
  sink: ForgeOperationalSink;
  now?: () => Date;
}

function optional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function latency(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Operational latency must be a finite non-negative number");
  }
  return Math.round(value);
}

function metricTags(input: {
  provider?: string | undefined;
  outcome?: string | undefined;
  state?: string | undefined;
  operation?: string | undefined;
}): Record<string, string> {
  return Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

export class ForgeOperationalTelemetry {
  private readonly now: () => Date;

  constructor(private readonly dependencies: ForgeOperationalTelemetryDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async recordRunState(input: {
    workspaceId: string;
    runId: string;
    previousState: string;
    nextState: string;
    reason?: string;
  }): Promise<void> {
    await this.log({
      level: "info",
      event: "forge.run.state_changed",
      workspaceId: input.workspaceId,
      runId: input.runId,
      state: input.nextState,
      outcome: "transitioned",
      attributes: {
        previousState: input.previousState,
        nextState: input.nextState,
        reason: optional(input.reason),
      },
    });
    await this.metric("forge.run.state_transition", 1, {
      state: input.nextState,
      outcome: "transitioned",
    });
  }

  async recordProviderCall(input: {
    provider: string;
    operation: string;
    latencyMs: number;
    outcome: "success" | "failure";
    workspaceId?: string;
    runId?: string;
    failureCode?: string;
    attributes?: Record<string, unknown>;
  }): Promise<void> {
    const measuredLatency = latency(input.latencyMs);
    await this.log({
      level: input.outcome === "success" ? "info" : "error",
      event: "forge.provider.request",
      workspaceId: optional(input.workspaceId),
      runId: optional(input.runId),
      provider: input.provider,
      outcome: input.outcome,
      failureCode: optional(input.failureCode),
      latencyMs: measuredLatency,
      attributes: {
        operation: input.operation,
        ...(input.attributes ?? {}),
      },
    });
    await this.metric("forge.provider.latency_ms", measuredLatency, {
      provider: input.provider,
      operation: input.operation,
      outcome: input.outcome,
    });
    await this.metric("forge.provider.request", 1, {
      provider: input.provider,
      operation: input.operation,
      outcome: input.outcome,
    });
  }

  async recordApproval(input: {
    workspaceId: string;
    runId: string;
    approvalId: string;
    decision: "approved" | "rejected" | "expired";
    riskLevel: string;
  }): Promise<void> {
    await this.log({
      level: input.decision === "expired" ? "warn" : "info",
      event: "forge.approval.resolved",
      workspaceId: input.workspaceId,
      runId: input.runId,
      outcome: input.decision,
      attributes: {
        approvalId: input.approvalId,
        riskLevel: input.riskLevel,
      },
    });
    await this.metric("forge.approval.resolution", 1, {
      outcome: input.decision,
    });
  }

  async recordCleanup(input: {
    provider: string;
    sandboxId: string;
    runId?: string;
    latencyMs: number;
    outcome: "success" | "failure";
    reason: string;
    failureCode?: string;
  }): Promise<void> {
    const measuredLatency = latency(input.latencyMs);
    await this.log({
      level: input.outcome === "success" ? "info" : "error",
      event: "forge.sandbox.cleanup",
      runId: optional(input.runId),
      provider: input.provider,
      outcome: input.outcome,
      failureCode: optional(input.failureCode),
      latencyMs: measuredLatency,
      attributes: {
        sandboxId: input.sandboxId,
        reason: input.reason,
      },
    });
    await this.metric("forge.sandbox.cleanup_latency_ms", measuredLatency, {
      provider: input.provider,
      outcome: input.outcome,
    });
    await this.metric("forge.sandbox.cleanup", 1, {
      provider: input.provider,
      outcome: input.outcome,
    });
  }

  async recordFailure(input: {
    event: string;
    failureCode: string;
    message: string;
    workspaceId?: string;
    runId?: string;
    provider?: string;
    attributes?: Record<string, unknown>;
  }): Promise<void> {
    await this.log({
      level: "error",
      event: input.event,
      workspaceId: optional(input.workspaceId),
      runId: optional(input.runId),
      provider: optional(input.provider),
      outcome: "failure",
      failureCode: input.failureCode,
      attributes: {
        message: input.message,
        ...(input.attributes ?? {}),
      },
    });
    await this.metric("forge.failure", 1, {
      provider: optional(input.provider),
      outcome: input.failureCode,
    });
  }

  private async log(
    input: Omit<ForgeOperationalLog, "timestamp" | "redactionCount">,
  ): Promise<void> {
    const redacted = redactSecrets(input.attributes);
    await this.dependencies.sink.writeLog({
      ...input,
      timestamp: this.now().toISOString(),
      attributes: redacted.value,
      redactionCount: redacted.redactionCount,
    });
  }

  private async metric(
    name: string,
    value: number,
    tags: {
      provider?: string | undefined;
      outcome?: string | undefined;
      state?: string | undefined;
      operation?: string | undefined;
    },
  ): Promise<void> {
    await this.dependencies.sink.writeMetric({
      name,
      value,
      timestamp: this.now().toISOString(),
      tags: metricTags(tags),
    });
  }
}
