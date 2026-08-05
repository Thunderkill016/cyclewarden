import { describe, expect, it } from "vitest";

import {
  ForgeOperationalTelemetry,
  type ForgeMetricPoint,
  type ForgeOperationalLog,
  type ForgeOperationalSink,
} from "./forge-operational-telemetry.js";

const NOW = new Date("2026-08-05T04:00:00.000Z");

class RecordingSink implements ForgeOperationalSink {
  readonly logs: ForgeOperationalLog[] = [];
  readonly metrics: ForgeMetricPoint[] = [];

  writeLog(record: ForgeOperationalLog): void {
    this.logs.push(record);
  }

  writeMetric(point: ForgeMetricPoint): void {
    this.metrics.push(point);
  }
}

function fixture() {
  const sink = new RecordingSink();
  const telemetry = new ForgeOperationalTelemetry({ sink, now: () => NOW });
  return { sink, telemetry };
}

describe("ForgeOperationalTelemetry", () => {
  it("records provider latency and request outcome with stable dimensions", async () => {
    const { sink, telemetry } = fixture();

    await telemetry.recordProviderCall({
      provider: "codex",
      operation: "turn/start",
      latencyMs: 128.6,
      outcome: "success",
      workspaceId: "workspace-1",
      runId: "run-1",
    });

    expect(sink.logs).toEqual([
      expect.objectContaining({
        timestamp: NOW.toISOString(),
        event: "forge.provider.request",
        provider: "codex",
        latencyMs: 129,
        outcome: "success",
      }),
    ]);
    expect(sink.metrics).toEqual([
      expect.objectContaining({
        name: "forge.provider.latency_ms",
        value: 129,
        tags: { provider: "codex", operation: "turn/start", outcome: "success" },
      }),
      expect.objectContaining({
        name: "forge.provider.request",
        value: 1,
        tags: { provider: "codex", operation: "turn/start", outcome: "success" },
      }),
    ]);
  });

  it("records run state, approvals, cleanup and failures", async () => {
    const { sink, telemetry } = fixture();

    await telemetry.recordRunState({
      workspaceId: "workspace-1",
      runId: "run-1",
      previousState: "running",
      nextState: "awaiting_review",
    });
    await telemetry.recordApproval({
      workspaceId: "workspace-1",
      runId: "run-1",
      approvalId: "approval-1",
      decision: "approved",
      riskLevel: "high",
    });
    await telemetry.recordCleanup({
      provider: "vercel-sandbox",
      sandboxId: "sbx-1",
      runId: "run-1",
      latencyMs: 42,
      outcome: "success",
      reason: "run completed",
    });
    await telemetry.recordFailure({
      event: "forge.publication.failed",
      failureCode: "PUBLICATION_CONFLICT",
      message: "Exact head changed",
      runId: "run-1",
      provider: "github",
    });

    expect(sink.logs.map((record) => record.event)).toEqual([
      "forge.run.state_changed",
      "forge.approval.resolved",
      "forge.sandbox.cleanup",
      "forge.publication.failed",
    ]);
    expect(sink.metrics.map((point) => point.name)).toContain(
      "forge.sandbox.cleanup_latency_ms",
    );
    expect(sink.metrics.map((point) => point.name)).toContain("forge.failure");
  });

  it("redacts secret-shaped fields and values before writing logs", async () => {
    const { sink, telemetry } = fixture();

    await telemetry.recordFailure({
      event: "forge.provider.failed",
      failureCode: "PROVIDER_UNAVAILABLE",
      message: "Bearer abc.def.ghi",
      attributes: {
        authorization: "Bearer abc.def.ghi",
        nested: { apiKey: "sk-exampleexampleexampleexample" },
      },
    });

    expect(JSON.stringify(sink.logs[0])).not.toContain("sk-example");
    expect(JSON.stringify(sink.logs[0])).not.toContain("abc.def.ghi");
    expect(sink.logs[0]?.redactionCount).toBeGreaterThan(0);
  });

  it("rejects invalid latency values before emitting telemetry", async () => {
    const { sink, telemetry } = fixture();

    await expect(
      telemetry.recordProviderCall({
        provider: "github",
        operation: "publish",
        latencyMs: Number.NaN,
        outcome: "failure",
      }),
    ).rejects.toThrow("finite non-negative");

    expect(sink.logs).toHaveLength(0);
    expect(sink.metrics).toHaveLength(0);
  });
});
