import { describe, expect, it } from "vitest";

import {
  CodexProvider,
  CodexProviderError,
  type CodexAppServerClient,
  type CodexAppServerEvent,
  type CodexPendingApproval,
  type CodexRunRecord,
  type CodexRunRegistry,
  type CodexThreadResumeInput,
  type CodexThreadStartInput,
  type CodexTurnUsage,
  type CodexWorkspace,
} from "./codex-provider.js";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const SANDBOX_ID = "sandbox-1";
const THREAD_ID = "thread-1";
const CWD = "/workspace/atoryn";
const USAGE: CodexTurnUsage = {
  inputTokens: 120,
  cachedInputTokens: 20,
  outputTokens: 80,
  reasoningTokens: 30,
  totalTokens: 200,
};

class MemoryRegistry implements CodexRunRegistry {
  readonly records = new Map<string, CodexRunRecord>();
  readonly approvals = new Map<string, CodexPendingApproval>();
  readonly cancellations: Array<{ externalRunId: string; reason: string }> = [];

  async register(record: CodexRunRecord): Promise<void> {
    this.records.set(record.externalRunId, { ...record });
  }

  async get(externalRunId: string): Promise<CodexRunRecord | null> {
    const record = this.records.get(externalRunId);
    return record ? { ...record } : null;
  }

  async setActiveTurn(input: {
    externalRunId: string;
    turnId: string;
  }): Promise<void> {
    const record = this.requireRecord(input.externalRunId);
    this.records.set(input.externalRunId, {
      ...record,
      activeTurnId: input.turnId,
      status: "running",
    });
  }

  async markIdle(input: {
    externalRunId: string;
    turnId: string;
  }): Promise<void> {
    const record = this.requireTurn(input.externalRunId, input.turnId);
    this.records.set(input.externalRunId, {
      ...record,
      activeTurnId: null,
      status: "idle",
    });
  }

  async markCompleted(input: {
    externalRunId: string;
    turnId: string;
  }): Promise<void> {
    const record = this.requireTurn(input.externalRunId, input.turnId);
    this.records.set(input.externalRunId, {
      ...record,
      activeTurnId: null,
      status: "completed",
    });
  }

  async markCancelled(input: {
    externalRunId: string;
    reason: string;
  }): Promise<void> {
    const record = this.requireRecord(input.externalRunId);
    this.cancellations.push(input);
    this.records.set(input.externalRunId, {
      ...record,
      activeTurnId: null,
      status: "cancelled",
    });
  }

  async saveApproval(approval: CodexPendingApproval): Promise<void> {
    this.approvals.set(this.approvalKey(approval.externalRunId, approval.requestKey), {
      ...approval,
    });
  }

  async getApproval(input: {
    externalRunId: string;
    requestKey: string;
  }): Promise<CodexPendingApproval | null> {
    const approval = this.approvals.get(
      this.approvalKey(input.externalRunId, input.requestKey),
    );
    return approval ? { ...approval } : null;
  }

  async removeApproval(input: {
    externalRunId: string;
    requestKey: string;
  }): Promise<void> {
    this.approvals.delete(this.approvalKey(input.externalRunId, input.requestKey));
  }

  private requireRecord(externalRunId: string): CodexRunRecord {
    const record = this.records.get(externalRunId);
    if (!record) throw new Error("record not found");
    return record;
  }

  private requireTurn(externalRunId: string, turnId: string): CodexRunRecord {
    const record = this.requireRecord(externalRunId);
    if (record.activeTurnId !== turnId) throw new Error("turn mismatch");
    return record;
  }

  private approvalKey(externalRunId: string, requestKey: string): string {
    return `${externalRunId}:${requestKey}`;
  }
}

class RecordingClient implements CodexAppServerClient {
  readonly threadStarts: CodexThreadStartInput[] = [];
  readonly threadResumes: CodexThreadResumeInput[] = [];
  readonly turnStarts: Array<{ threadId: string; input: string }> = [];
  readonly turnSteers: Array<{
    threadId: string;
    turnId: string;
    input: string;
  }> = [];
  readonly approvals: Array<{
    requestId: string;
    decision: "accept" | "decline";
  }> = [];
  readonly interrupts: Array<{ threadId: string; turnId: string }> = [];
  readonly cleans: Array<{ threadId: string }> = [];
  scriptedEvents: CodexAppServerEvent[] = [];
  usage: CodexTurnUsage = { ...USAGE };
  turnSequence = 0;

  async startThread(input: CodexThreadStartInput) {
    this.threadStarts.push(input);
    return { threadId: THREAD_ID };
  }

  async resumeThread(input: CodexThreadResumeInput) {
    this.threadResumes.push(input);
    return { threadId: input.threadId };
  }

  async startTurn(input: { threadId: string; input: string }) {
    this.turnStarts.push(input);
    this.turnSequence += 1;
    return { turnId: `turn-${this.turnSequence}` };
  }

  async steerTurn(input: {
    threadId: string;
    turnId: string;
    input: string;
  }): Promise<void> {
    this.turnSteers.push(input);
  }

  async *events(_input: {
    threadId: string;
    afterCursor?: string;
  }): AsyncIterable<CodexAppServerEvent> {
    for (const event of this.scriptedEvents) yield event;
  }

  async respondToApproval(input: {
    requestId: string;
    decision: "accept" | "decline";
  }): Promise<void> {
    this.approvals.push(input);
  }

  async interruptTurn(input: {
    threadId: string;
    turnId: string;
  }): Promise<void> {
    this.interrupts.push(input);
  }

  async cleanBackgroundTerminals(input: { threadId: string }): Promise<void> {
    this.cleans.push(input);
  }

  async readUsage(_input: { threadId: string }): Promise<CodexTurnUsage> {
    return { ...this.usage };
  }
}

function fixture() {
  const client = new RecordingClient();
  const registry = new MemoryRegistry();
  const workspace: CodexWorkspace = {
    sandboxId: SANDBOX_ID,
    cwd: CWD,
    active: true,
  };
  const provider = new CodexProvider({
    client,
    registry,
    workspaces: {
      resolve: async (sandboxId) =>
        sandboxId === workspace.sandboxId ? { ...workspace } : null,
    },
  });
  return { provider, client, registry, workspace };
}

async function start(provider: CodexProvider) {
  return provider.start({
    runId: RUN_ID,
    sandboxId: SANDBOX_ID,
    objective: "Implement the approved change",
    acceptanceCriteria: ["All tests pass", "No base-branch write"],
    constraints: ["Do not expose credentials"],
    technicalOutputLanguage: "en",
  });
}

async function collect(
  provider: CodexProvider,
): Promise<Array<{ cursor: string; event: unknown }>> {
  const result: Array<{ cursor: string; event: unknown }> = [];
  for await (const item of provider.events({ externalRunId: THREAD_ID })) {
    result.push(item);
  }
  return result;
}

describe("CodexProvider", () => {
  it("starts a governed persistent thread and initial turn inside the resolved workspace", async () => {
    const { provider, client, registry } = fixture();

    await expect(start(provider)).resolves.toEqual({ externalRunId: THREAD_ID });

    expect(client.threadStarts).toEqual([
      {
        cwd: CWD,
        ephemeral: false,
        approvalPolicy: "on-request",
        approvalsReviewer: "client",
        sandbox: "workspace-write",
        developerInstructions: expect.stringContaining("Atoryn Forge"),
      },
    ]);
    expect(client.turnStarts[0]?.input).toContain("Implement the approved change");
    expect(client.turnStarts[0]?.input).toContain("All tests pass");
    expect(client.turnStarts[0]?.input).toContain("Technical output language");
    await expect(registry.get(THREAD_ID)).resolves.toMatchObject({
      runId: RUN_ID,
      sandboxId: SANDBOX_ID,
      cwd: CWD,
      activeTurnId: "turn-1",
      status: "running",
    });
  });

  it("resumes the exact thread only when its sandbox workspace identity is unchanged", async () => {
    const { provider, client, workspace } = fixture();
    await start(provider);

    await provider.resume({ externalRunId: THREAD_ID });
    expect(client.threadResumes).toEqual([
      {
        threadId: THREAD_ID,
        cwd: CWD,
        approvalPolicy: "on-request",
        approvalsReviewer: "client",
        sandbox: "workspace-write",
        excludeTurns: true,
      },
    ]);

    workspace.cwd = "/workspace/replaced";
    await expect(
      provider.resume({ externalRunId: THREAD_ID }),
    ).rejects.toMatchObject({
      code: "WORKSPACE_CONFLICT",
    });
  });

  it("steers an active turn and starts a new turn when the run is idle", async () => {
    const { provider, client, registry } = fixture();
    await start(provider);

    await provider.addInstruction({
      externalRunId: THREAD_ID,
      instruction: "Also update the regression test",
    });
    expect(client.turnSteers).toEqual([
      {
        threadId: THREAD_ID,
        turnId: "turn-1",
        input: "Also update the regression test",
      },
    ]);

    await registry.markIdle({ externalRunId: THREAD_ID, turnId: "turn-1" });
    await provider.addInstruction({
      externalRunId: THREAD_ID,
      instruction: "Run the final verification",
    });
    expect(client.turnStarts.at(-1)).toEqual({
      threadId: THREAD_ID,
      input: "Run the final verification",
    });
    await expect(registry.get(THREAD_ID)).resolves.toMatchObject({
      activeTurnId: "turn-2",
      status: "running",
    });
  });

  it("maps app-server messages, approvals, usage, and warnings into provider-neutral events", async () => {
    const { provider, client, registry } = fixture();
    await start(provider);
    client.scriptedEvents = [
      { cursor: "1", type: "agent_message", text: "Editing files" },
      {
        cursor: "2",
        type: "approval_requested",
        requestId: "approval-1",
        turnId: "turn-1",
        tool: "commandExecution",
        input: { command: "pnpm test" },
      },
      { cursor: "3", type: "usage", usage: USAGE },
      { cursor: "4", type: "warning", message: "Optional skill omitted" },
    ];

    await expect(collect(provider)).resolves.toEqual([
      { cursor: "1", event: { type: "message", text: "Editing files" } },
      {
        cursor: "2",
        event: {
          type: "tool_requested",
          requestKey: "approval-1",
          tool: "commandExecution",
          input: { command: "pnpm test" },
        },
      },
      {
        cursor: "3",
        event: { type: "usage", inputTokens: 120, outputTokens: 80 },
      },
      {
        cursor: "4",
        event: {
          type: "message",
          text: "Codex warning: Optional skill omitted",
        },
      },
    ]);
    await expect(
      registry.getApproval({
        externalRunId: THREAD_ID,
        requestKey: "approval-1",
      }),
    ).resolves.toMatchObject({ turnId: "turn-1" });
  });

  it("answers the exact pending JSON-RPC approval request and removes it after success", async () => {
    const { provider, client, registry } = fixture();
    await start(provider);
    await registry.saveApproval({
      externalRunId: THREAD_ID,
      requestKey: "approval-1",
      requestId: "approval-1",
      turnId: "turn-1",
    });

    await provider.resolveApproval({
      externalRunId: THREAD_ID,
      requestKey: "approval-1",
      decision: "approved",
    });
    expect(client.approvals).toEqual([
      { requestId: "approval-1", decision: "accept" },
    ]);
    await expect(
      registry.getApproval({
        externalRunId: THREAD_ID,
        requestKey: "approval-1",
      }),
    ).resolves.toBeNull();
  });

  it("marks completed and interrupted turn events with stable provider-neutral outcomes", async () => {
    const completed = fixture();
    await start(completed.provider);
    completed.client.scriptedEvents = [
      {
        cursor: "1",
        type: "turn_completed",
        turnId: "turn-1",
        status: "completed",
        summary: "Change implemented",
      },
    ];
    await expect(collect(completed.provider)).resolves.toEqual([
      {
        cursor: "1",
        event: { type: "completed", summary: "Change implemented" },
      },
    ]);
    await expect(completed.registry.get(THREAD_ID)).resolves.toMatchObject({
      activeTurnId: null,
      status: "completed",
    });

    const interrupted = fixture();
    await start(interrupted.provider);
    interrupted.client.scriptedEvents = [
      {
        cursor: "1",
        type: "turn_completed",
        turnId: "turn-1",
        status: "interrupted",
        summary: "Turn interrupted",
      },
    ];
    await expect(collect(interrupted.provider)).resolves.toEqual([
      {
        cursor: "1",
        event: {
          type: "failed",
          code: "CANCELLED",
          summary: "Turn interrupted",
        },
      },
    ]);
  });

  it("interrupts the active turn, cleans background terminals, and records cancellation", async () => {
    const { provider, client, registry } = fixture();
    await start(provider);

    await provider.cancel({
      externalRunId: THREAD_ID,
      reason: "Developer cancelled the run",
    });

    expect(client.interrupts).toEqual([
      { threadId: THREAD_ID, turnId: "turn-1" },
    ]);
    expect(client.cleans).toEqual([{ threadId: THREAD_ID }]);
    expect(registry.cancellations).toEqual([
      {
        externalRunId: THREAD_ID,
        reason: "Developer cancelled the run",
      },
    ]);
    await expect(registry.get(THREAD_ID)).resolves.toMatchObject({
      activeTurnId: null,
      status: "cancelled",
    });
  });

  it("returns a validated aggregate usage summary and rejects inconsistent totals", async () => {
    const { provider, client } = fixture();
    await start(provider);

    await expect(
      provider.usageSummary({ externalRunId: THREAD_ID }),
    ).resolves.toEqual(USAGE);

    client.usage = { ...USAGE, totalTokens: 201 };
    await expect(
      provider.usageSummary({ externalRunId: THREAD_ID }),
    ).rejects.toMatchObject({
      code: "USAGE_CONFLICT",
    });
  });

  it("fails closed on duplicate event cursors and stale approvals", async () => {
    const { provider, client } = fixture();
    await start(provider);
    client.scriptedEvents = [
      { cursor: "same", type: "agent_message", text: "one" },
      { cursor: "same", type: "agent_message", text: "two" },
    ];

    await expect(collect(provider)).rejects.toMatchObject({ code: "EVENT_CONFLICT" });

    await expect(
      provider.resolveApproval({
        externalRunId: THREAD_ID,
        requestKey: "missing",
        decision: "rejected",
      }),
    ).rejects.toMatchObject({
      code: "APPROVAL_NOT_FOUND",
    });
  });
});
