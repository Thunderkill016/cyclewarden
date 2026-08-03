import type {
  CodingAgentEvent,
  CodingAgentProvider,
  CodingAgentStartInput,
} from "@cyclewarden/forge-domain";

export class FakeCodingAgentProvider implements CodingAgentProvider {
  readonly key = "fake-agent";
  readonly startCalls: CodingAgentStartInput[] = [];
  readonly instructionCalls: Array<{ externalRunId: string; instruction: string }> = [];
  readonly approvalCalls: Array<{
    externalRunId: string;
    requestKey: string;
    decision: "approved" | "rejected";
  }> = [];
  readonly cancelCalls: Array<{ externalRunId: string; reason: string }> = [];

  constructor(
    private readonly scriptedEvents: CodingAgentEvent[] = [
      { type: "message", text: "Implemented requested change" },
      { type: "completed", summary: "Done" },
    ],
  ) {}

  async start(input: CodingAgentStartInput): Promise<{ externalRunId: string }> {
    this.startCalls.push(input);
    return { externalRunId: `agent-run-${this.startCalls.length}` };
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
}
