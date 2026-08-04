import type {
  CodingAgentEvent,
  CodingAgentProvider,
  CodingAgentStartInput,
  CodingAgentUsageSummary,
} from "@cyclewarden/forge-domain";

export type CodexApprovalPolicy = "on-request";
export type CodexSandboxMode = "workspace-write";
export type CodexApprovalDecision = "accept" | "decline";

export interface CodexWorkspace {
  sandboxId: string;
  cwd: string;
  active: boolean;
}

export interface CodexWorkspaceResolver {
  resolve(sandboxId: string): Promise<CodexWorkspace | null>;
}

export interface CodexThreadStartInput {
  cwd: string;
  ephemeral: false;
  approvalPolicy: CodexApprovalPolicy;
  approvalsReviewer: "client";
  sandbox: CodexSandboxMode;
  developerInstructions: string;
}

export interface CodexThreadResumeInput {
  threadId: string;
  cwd: string;
  approvalPolicy: CodexApprovalPolicy;
  approvalsReviewer: "client";
  sandbox: CodexSandboxMode;
  excludeTurns: true;
}

export interface CodexTurnUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
}

export type CodexAppServerEvent =
  | {
      cursor: string;
      type: "agent_message";
      text: string;
    }
  | {
      cursor: string;
      type: "approval_requested";
      requestId: string;
      turnId: string;
      tool: string;
      input: unknown;
    }
  | {
      cursor: string;
      type: "usage";
      usage: CodexTurnUsage;
    }
  | {
      cursor: string;
      type: "turn_completed";
      turnId: string;
      status: "completed" | "failed" | "interrupted";
      summary: string;
      failureCode?: string;
    }
  | {
      cursor: string;
      type: "warning";
      message: string;
    };

export interface CodexAppServerClient {
  startThread(input: CodexThreadStartInput): Promise<{ threadId: string }>;

  resumeThread(input: CodexThreadResumeInput): Promise<{ threadId: string }>;

  startTurn(input: {
    threadId: string;
    input: string;
  }): Promise<{ turnId: string }>;

  steerTurn(input: {
    threadId: string;
    turnId: string;
    input: string;
  }): Promise<void>;

  events(input: {
    threadId: string;
    afterCursor?: string;
  }): AsyncIterable<CodexAppServerEvent>;

  respondToApproval(input: {
    requestId: string;
    decision: CodexApprovalDecision;
  }): Promise<void>;

  interruptTurn(input: {
    threadId: string;
    turnId: string;
  }): Promise<void>;

  cleanBackgroundTerminals(input: { threadId: string }): Promise<void>;

  readUsage(input: { threadId: string }): Promise<CodexTurnUsage>;
}

export type CodexRunStatus = "idle" | "running" | "completed" | "cancelled";

export interface CodexRunRecord {
  externalRunId: string;
  runId: string;
  sandboxId: string;
  cwd: string;
  activeTurnId: string | null;
  status: CodexRunStatus;
}

export interface CodexPendingApproval {
  externalRunId: string;
  requestKey: string;
  requestId: string;
  turnId: string;
}

export interface CodexRunRegistry {
  register(record: CodexRunRecord): Promise<void>;
  get(externalRunId: string): Promise<CodexRunRecord | null>;
  setActiveTurn(input: {
    externalRunId: string;
    turnId: string;
  }): Promise<void>;
  markIdle(input: {
    externalRunId: string;
    turnId: string;
  }): Promise<void>;
  markCompleted(input: {
    externalRunId: string;
    turnId: string;
  }): Promise<void>;
  markCancelled(input: {
    externalRunId: string;
    reason: string;
  }): Promise<void>;
  saveApproval(approval: CodexPendingApproval): Promise<void>;
  getApproval(input: {
    externalRunId: string;
    requestKey: string;
  }): Promise<CodexPendingApproval | null>;
  removeApproval(input: {
    externalRunId: string;
    requestKey: string;
  }): Promise<void>;
}

export class CodexProviderError extends Error {
  constructor(
    readonly code:
      | "INVALID_INPUT"
      | "WORKSPACE_UNAVAILABLE"
      | "RUN_NOT_FOUND"
      | "RUN_NOT_CONTROLLABLE"
      | "WORKSPACE_CONFLICT"
      | "APPROVAL_NOT_FOUND"
      | "EVENT_CONFLICT"
      | "USAGE_CONFLICT"
      | "PROVIDER_UNAVAILABLE",
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "CodexProviderError";
  }
}

export interface CodexProviderDependencies {
  client: CodexAppServerClient;
  workspaces: CodexWorkspaceResolver;
  registry: CodexRunRegistry;
  maximumInstructionCharacters?: number;
  maximumListItems?: number;
}

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const EXTERNAL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;
const ABSOLUTE_PATH_PATTERN = /^(?:\/|[A-Za-z]:[\\/])/;

function normalizeText(value: string, name: string, maximumCharacters: number): string {
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > maximumCharacters ||
    CONTROL_CHARACTER_PATTERN.test(normalized)
  ) {
    throw new CodexProviderError(
      "INVALID_INPUT",
      `${name} must be non-empty, within ${maximumCharacters} characters, and free of control characters.`,
    );
  }
  return normalized;
}

function normalizeId(value: string, name: string): string {
  const normalized = value.trim();
  if (!EXTERNAL_ID_PATTERN.test(normalized)) {
    throw new CodexProviderError("INVALID_INPUT", `${name} is invalid.`);
  }
  return normalized;
}

function normalizePath(value: string): string {
  const normalized = value.trim();
  if (
    !ABSOLUTE_PATH_PATTERN.test(normalized) ||
    normalized.includes("\0") ||
    CONTROL_CHARACTER_PATTERN.test(normalized)
  ) {
    throw new CodexProviderError(
      "WORKSPACE_UNAVAILABLE",
      "Codex workspace path must be absolute and contain no control characters.",
    );
  }
  return normalized;
}

function normalizeList(
  values: string[],
  name: string,
  maximumItems: number,
  maximumCharacters: number,
): string[] {
  if (!Array.isArray(values) || values.length > maximumItems) {
    throw new CodexProviderError(
      "INVALID_INPUT",
      `${name} must contain at most ${maximumItems} entries.`,
    );
  }
  return values.map((value, index) =>
    normalizeText(value, `${name}[${index}]`, maximumCharacters),
  );
}

function buildInitialInstruction(input: {
  objective: string;
  acceptanceCriteria: string[];
  constraints: string[];
  technicalOutputLanguage: "vi" | "en";
}): string {
  const acceptance =
    input.acceptanceCriteria.length === 0
      ? "- No additional acceptance criteria were supplied."
      : input.acceptanceCriteria.map((item) => `- ${item}`).join("\n");
  const constraints =
    input.constraints.length === 0
      ? "- No additional constraints were supplied."
      : input.constraints.map((item) => `- ${item}`).join("\n");
  const language =
    input.technicalOutputLanguage === "en"
      ? "Write technical artifacts, code-facing labels, branch names, commit messages, and summaries in English."
      : "Write technical artifacts and technical summaries in Vietnamese unless an ecosystem convention requires English identifiers.";

  return [
    "Atoryn Forge governed coding task",
    "",
    "Objective:",
    input.objective,
    "",
    "Acceptance criteria:",
    acceptance,
    "",
    "Constraints:",
    constraints,
    "",
    "Technical output language:",
    language,
    "",
    "Work only inside the supplied sandbox workspace. Request approval for sensitive actions instead of bypassing policy.",
  ].join("\n");
}

function developerInstructions(language: "vi" | "en"): string {
  return language === "en"
    ? "You are operating as the coding agent inside Atoryn Forge. Preserve evidence, obey the approval boundary, avoid secrets, and produce inspectable technical output in English."
    : "Bạn đang hoạt động như coding agent bên trong Atoryn Forge. Hãy giữ bằng chứng, tuân thủ ranh giới phê duyệt, tránh làm lộ bí mật và tạo đầu ra kỹ thuật có thể kiểm tra.";
}

function validateUsage(usage: CodexTurnUsage): CodingAgentUsageSummary {
  for (const [name, value] of Object.entries(usage)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new CodexProviderError(
        "USAGE_CONFLICT",
        `Codex returned invalid ${name}.`,
      );
    }
  }
  if (
    usage.cachedInputTokens > usage.inputTokens ||
    usage.reasoningTokens > usage.outputTokens ||
    usage.totalTokens !== usage.inputTokens + usage.outputTokens
  ) {
    throw new CodexProviderError(
      "USAGE_CONFLICT",
      "Codex token usage totals are internally inconsistent.",
    );
  }
  return { ...usage };
}

export class CodexProvider implements CodingAgentProvider {
  readonly key = "codex";
  private readonly maximumInstructionCharacters: number;
  private readonly maximumListItems: number;

  constructor(private readonly dependencies: CodexProviderDependencies) {
    this.maximumInstructionCharacters =
      dependencies.maximumInstructionCharacters ?? 32_000;
    this.maximumListItems = dependencies.maximumListItems ?? 100;
    if (
      !Number.isSafeInteger(this.maximumInstructionCharacters) ||
      this.maximumInstructionCharacters < 1 ||
      !Number.isSafeInteger(this.maximumListItems) ||
      this.maximumListItems < 1
    ) {
      throw new CodexProviderError(
        "INVALID_INPUT",
        "Codex provider limits must be positive safe integers.",
      );
    }
  }

  async start(input: CodingAgentStartInput): Promise<{ externalRunId: string }> {
    const runId = normalizeId(input.runId, "Run ID");
    const sandboxId = normalizeId(input.sandboxId, "Sandbox ID");
    const objective = normalizeText(
      input.objective,
      "Objective",
      this.maximumInstructionCharacters,
    );
    const acceptanceCriteria = normalizeList(
      input.acceptanceCriteria,
      "Acceptance criteria",
      this.maximumListItems,
      this.maximumInstructionCharacters,
    );
    const constraints = normalizeList(
      input.constraints,
      "Constraints",
      this.maximumListItems,
      this.maximumInstructionCharacters,
    );
    const workspace = await this.requireWorkspace(sandboxId);

    let threadId: string;
    try {
      const thread = await this.dependencies.client.startThread({
        cwd: workspace.cwd,
        ephemeral: false,
        approvalPolicy: "on-request",
        approvalsReviewer: "client",
        sandbox: "workspace-write",
        developerInstructions: developerInstructions(input.technicalOutputLanguage),
      });
      threadId = normalizeId(thread.threadId, "Codex thread ID");
    } catch (error) {
      if (error instanceof CodexProviderError) throw error;
      throw new CodexProviderError(
        "PROVIDER_UNAVAILABLE",
        "Codex thread start failed.",
        error,
      );
    }

    let turnId: string;
    try {
      const turn = await this.dependencies.client.startTurn({
        threadId,
        input: buildInitialInstruction({
          objective,
          acceptanceCriteria,
          constraints,
          technicalOutputLanguage: input.technicalOutputLanguage,
        }),
      });
      turnId = normalizeId(turn.turnId, "Codex turn ID");
      await this.dependencies.registry.register({
        externalRunId: threadId,
        runId,
        sandboxId,
        cwd: workspace.cwd,
        activeTurnId: turnId,
        status: "running",
      });
    } catch (error) {
      try {
        await this.dependencies.client.cleanBackgroundTerminals({ threadId });
      } catch {
        // Preserve the root start failure after best-effort cleanup.
      }
      if (error instanceof CodexProviderError) throw error;
      throw new CodexProviderError(
        "PROVIDER_UNAVAILABLE",
        "Codex initial turn start failed.",
        error,
      );
    }

    return { externalRunId: threadId };
  }

  async resume(input: { externalRunId: string }): Promise<void> {
    const record = await this.requireRun(input.externalRunId);
    if (record.status === "cancelled" || record.status === "completed") {
      throw new CodexProviderError(
        "RUN_NOT_CONTROLLABLE",
        "Completed or cancelled Codex runs cannot be resumed.",
      );
    }
    const workspace = await this.requireWorkspace(record.sandboxId);
    if (workspace.cwd !== record.cwd) {
      throw new CodexProviderError(
        "WORKSPACE_CONFLICT",
        "The Codex run workspace changed since the thread was created.",
      );
    }

    try {
      const resumed = await this.dependencies.client.resumeThread({
        threadId: record.externalRunId,
        cwd: record.cwd,
        approvalPolicy: "on-request",
        approvalsReviewer: "client",
        sandbox: "workspace-write",
        excludeTurns: true,
      });
      if (resumed.threadId !== record.externalRunId) {
        throw new CodexProviderError(
          "WORKSPACE_CONFLICT",
          "Codex resumed a different thread identity.",
        );
      }
    } catch (error) {
      if (error instanceof CodexProviderError) throw error;
      throw new CodexProviderError(
        "PROVIDER_UNAVAILABLE",
        "Codex thread resume failed.",
        error,
      );
    }
  }

  async *events(input: {
    externalRunId: string;
    afterCursor?: string;
  }): AsyncIterable<{ cursor: string; event: CodingAgentEvent }> {
    const record = await this.requireRun(input.externalRunId);
    const request: Parameters<CodexAppServerClient["events"]>[0] = {
      threadId: record.externalRunId,
    };
    if (input.afterCursor !== undefined) {
      request.afterCursor = normalizeText(
        input.afterCursor,
        "Event cursor",
        512,
      );
    }

    const seenCursors = new Set<string>();
    try {
      for await (const raw of this.dependencies.client.events(request)) {
        const cursor = normalizeText(raw.cursor, "Codex event cursor", 512);
        if (seenCursors.has(cursor)) {
          throw new CodexProviderError(
            "EVENT_CONFLICT",
            `Codex emitted duplicate cursor ${cursor}.`,
          );
        }
        seenCursors.add(cursor);

        if (raw.type === "agent_message") {
          yield {
            cursor,
            event: {
              type: "message",
              text: normalizeText(
                raw.text,
                "Codex agent message",
                this.maximumInstructionCharacters,
              ),
            },
          };
          continue;
        }

        if (raw.type === "approval_requested") {
          const requestKey = normalizeId(raw.requestId, "Codex approval request ID");
          const turnId = normalizeId(raw.turnId, "Codex approval turn ID");
          if (record.activeTurnId !== turnId) {
            throw new CodexProviderError(
              "EVENT_CONFLICT",
              "Codex approval request does not belong to the active turn.",
            );
          }
          await this.dependencies.registry.saveApproval({
            externalRunId: record.externalRunId,
            requestKey,
            requestId: requestKey,
            turnId,
          });
          yield {
            cursor,
            event: {
              type: "tool_requested",
              requestKey,
              tool: normalizeText(raw.tool, "Codex approval tool", 256),
              input: raw.input,
            },
          };
          continue;
        }

        if (raw.type === "usage") {
          const usage = validateUsage(raw.usage);
          yield {
            cursor,
            event: {
              type: "usage",
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
            },
          };
          continue;
        }

        if (raw.type === "turn_completed") {
          const turnId = normalizeId(raw.turnId, "Codex completed turn ID");
          if (record.activeTurnId !== turnId) {
            throw new CodexProviderError(
              "EVENT_CONFLICT",
              "Codex completed an unexpected turn.",
            );
          }
          const summary = normalizeText(
            raw.summary,
            "Codex turn summary",
            this.maximumInstructionCharacters,
          );
          if (raw.status === "completed") {
            await this.dependencies.registry.markCompleted({
              externalRunId: record.externalRunId,
              turnId,
            });
            yield { cursor, event: { type: "completed", summary } };
          } else {
            await this.dependencies.registry.markIdle({
              externalRunId: record.externalRunId,
              turnId,
            });
            yield {
              cursor,
              event: {
                type: "failed",
                code:
                  raw.status === "interrupted"
                    ? "CANCELLED"
                    : normalizeText(
                        raw.failureCode ?? "CODEX_TURN_FAILED",
                        "Codex failure code",
                        256,
                      ),
                summary,
              },
            };
          }
          continue;
        }

        if (raw.type === "warning") {
          yield {
            cursor,
            event: {
              type: "message",
              text: `Codex warning: ${normalizeText(raw.message, "Codex warning", this.maximumInstructionCharacters)}`,
            },
          };
        }
      }
    } catch (error) {
      if (error instanceof CodexProviderError) throw error;
      throw new CodexProviderError(
        "PROVIDER_UNAVAILABLE",
        "Codex event stream failed.",
        error,
      );
    }
  }

  async addInstruction(input: {
    externalRunId: string;
    instruction: string;
  }): Promise<void> {
    const record = await this.requireControllableRun(input.externalRunId);
    const instruction = normalizeText(
      input.instruction,
      "Additional instruction",
      this.maximumInstructionCharacters,
    );

    try {
      if (record.activeTurnId !== null) {
        await this.dependencies.client.steerTurn({
          threadId: record.externalRunId,
          turnId: record.activeTurnId,
          input: instruction,
        });
        return;
      }
      const turn = await this.dependencies.client.startTurn({
        threadId: record.externalRunId,
        input: instruction,
      });
      const turnId = normalizeId(turn.turnId, "Codex turn ID");
      await this.dependencies.registry.setActiveTurn({
        externalRunId: record.externalRunId,
        turnId,
      });
    } catch (error) {
      if (error instanceof CodexProviderError) throw error;
      throw new CodexProviderError(
        "PROVIDER_UNAVAILABLE",
        "Codex additional instruction failed.",
        error,
      );
    }
  }

  async resolveApproval(input: {
    externalRunId: string;
    requestKey: string;
    decision: "approved" | "rejected";
  }): Promise<void> {
    const record = await this.requireControllableRun(input.externalRunId);
    const requestKey = normalizeId(input.requestKey, "Approval request key");
    const approval = await this.dependencies.registry.getApproval({
      externalRunId: record.externalRunId,
      requestKey,
    });
    if (
      approval === null ||
      approval.turnId !== record.activeTurnId ||
      approval.requestId !== requestKey
    ) {
      throw new CodexProviderError(
        "APPROVAL_NOT_FOUND",
        "The Codex approval request is missing, stale, or belongs to another turn.",
      );
    }

    try {
      await this.dependencies.client.respondToApproval({
        requestId: approval.requestId,
        decision: input.decision === "approved" ? "accept" : "decline",
      });
      await this.dependencies.registry.removeApproval({
        externalRunId: record.externalRunId,
        requestKey,
      });
    } catch (error) {
      throw new CodexProviderError(
        "PROVIDER_UNAVAILABLE",
        "Codex approval response failed.",
        error,
      );
    }
  }

  async cancel(input: {
    externalRunId: string;
    reason: string;
  }): Promise<void> {
    const record = await this.requireControllableRun(input.externalRunId);
    const reason = normalizeText(input.reason, "Cancellation reason", 2_000);

    try {
      if (record.activeTurnId !== null) {
        await this.dependencies.client.interruptTurn({
          threadId: record.externalRunId,
          turnId: record.activeTurnId,
        });
      }
      await this.dependencies.client.cleanBackgroundTerminals({
        threadId: record.externalRunId,
      });
      await this.dependencies.registry.markCancelled({
        externalRunId: record.externalRunId,
        reason,
      });
    } catch (error) {
      throw new CodexProviderError(
        "PROVIDER_UNAVAILABLE",
        "Codex cancellation or terminal cleanup failed.",
        error,
      );
    }
  }

  async usageSummary(input: {
    externalRunId: string;
  }): Promise<CodingAgentUsageSummary> {
    const record = await this.requireRun(input.externalRunId);
    try {
      return validateUsage(
        await this.dependencies.client.readUsage({
          threadId: record.externalRunId,
        }),
      );
    } catch (error) {
      if (error instanceof CodexProviderError) throw error;
      throw new CodexProviderError(
        "PROVIDER_UNAVAILABLE",
        "Codex usage summary failed.",
        error,
      );
    }
  }

  private async requireWorkspace(sandboxId: string): Promise<CodexWorkspace> {
    const workspace = await this.dependencies.workspaces.resolve(sandboxId);
    if (
      workspace === null ||
      !workspace.active ||
      workspace.sandboxId !== sandboxId
    ) {
      throw new CodexProviderError(
        "WORKSPACE_UNAVAILABLE",
        "The selected sandbox workspace is unavailable.",
      );
    }
    return { ...workspace, cwd: normalizePath(workspace.cwd) };
  }

  private async requireRun(externalRunId: string): Promise<CodexRunRecord> {
    const normalized = normalizeId(externalRunId, "External run ID");
    const record = await this.dependencies.registry.get(normalized);
    if (record === null || record.externalRunId !== normalized) {
      throw new CodexProviderError(
        "RUN_NOT_FOUND",
        "The Codex run is not registered.",
      );
    }
    return record;
  }

  private async requireControllableRun(
    externalRunId: string,
  ): Promise<CodexRunRecord> {
    const record = await this.requireRun(externalRunId);
    if (record.status === "cancelled" || record.status === "completed") {
      throw new CodexProviderError(
        "RUN_NOT_CONTROLLABLE",
        "Completed or cancelled Codex runs cannot be controlled.",
      );
    }
    return record;
  }
}
