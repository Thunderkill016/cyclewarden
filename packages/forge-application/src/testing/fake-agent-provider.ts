import type {
  CodingAgentEvent,
  CodingAgentProvider,
  CodingAgentStartInput,
  CodingAgentUsageSummary,
} from "@cyclewarden/forge-domain";

export class FakeCodingAgentProvider implements CodingAgentProvider {
  readonly key = "fake-agent";
  readonly startCalls: CodingAgentStartInput[] = [];
  readonly resumeCalls: Array<{ externalRunId: string }> = [];
  readonly instructionCalls: Array<{ externalRunId: string; instruction: string }> = [];
  readonly approvalCalls: Array<{
    externalRunId: string;
    requestKey: string;
    decision: "approved" | "rejected";
  }> = [];
  readonly cancelCalls: Array<{ externalRunId: string; reason: string }> = [];
  readonly usageCalls: Array<{ externalRunId: string }> = [];

  constructor(
    private readonly scriptedEvents: CodingAgentEvent[] = [
      { type: "message", text: "Implemented requested change" },
      { type: "completed", summary: "Done" },
    ],
    private readonly scriptedUsage: CodingAgentUsageSummary = {
      inputTokens: 100,
      cachedInputTokens: 0,
      outputTokens: 50,
      reasoningTokens: 0,
      totalTokens: 150,
    },
  ) {}

  async start(input: CodingAgentStartInput): Promise<{ externalRunId: string }> {
    this.startCalls.push(input);
    return { externalRunId: `agent-run-${this.startCalls.length}` };
  }

  async resume(input: { externalRunId: string }): Promise<void> {
    this.resumeCalls.push(input);
  }

  async *events(): AsyncIterable<{ cursor: string; event: CodingAgentEvent }> {
    for (const [index, event] of this.scriptedEvents.entries()) {
      yield { cursor: String(index + 1), event };
    }
  }

  async addInstruction(input: {
    externalRunId: string;
    instruction: string;
  }): Promise<void> {
    this.instructionCalls.push(input);
  }

  async resolveApproval(input: {
    externalRunId: string;
    requestKey: string;
    decision: "approved" | "rejected";
  }): Promise<void> {
    this.approvalCalls.push(input);
  }

  async cancel(input: { externalRunId: string; reason: string }): Promise<void> {
    this.cancelCalls.push(input);
  }

  async usageSummary(input: {
    externalRunId: string;
  }): Promise<CodingAgentUsageSummary> {
    this.usageCalls.push(input);
    return { ...this.scriptedUsage };
  }
}
