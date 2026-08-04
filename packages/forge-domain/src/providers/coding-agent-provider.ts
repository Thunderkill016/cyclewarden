export type CodingAgentEvent =
  | { type: "message"; text: string }
  | { type: "tool_requested"; requestKey: string; tool: string; input: unknown }
  | { type: "usage"; inputTokens: number; outputTokens: number }
  | { type: "completed"; summary: string }
  | { type: "failed"; code: string; summary: string };

export interface CodingAgentStartInput {
  runId: string;
  sandboxId: string;
  objective: string;
  acceptanceCriteria: string[];
  constraints: string[];
  technicalOutputLanguage: "vi" | "en";
}

export interface CodingAgentProvider {
  readonly key: string;

  start(input: CodingAgentStartInput): Promise<{ externalRunId: string }>;

  events(input: {
    externalRunId: string;
    afterCursor?: string;
  }): AsyncIterable<{ cursor: string; event: CodingAgentEvent }>;

  addInstruction(input: {
    externalRunId: string;
    instruction: string;
  }): Promise<void>;

  resolveApproval(input: {
    externalRunId: string;
    requestKey: string;
    decision: "approved" | "rejected";
  }): Promise<void>;

  cancel(input: { externalRunId: string; reason: string }): Promise<void>;
}
