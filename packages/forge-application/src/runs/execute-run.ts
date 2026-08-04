import { randomUUID } from "node:crypto";

import {
  transitionRun,
  type CodingAgentProvider,
  type Run,
  type RunState,
  type SandboxProvider,
} from "@cyclewarden/forge-domain";

import { normalizeLiveProviderEvent } from "../events/live-provider-event-normalizer.js";
import type { InMemoryForgeStore } from "../store/in-memory-store.js";

function move(run: Run, nextState: RunState): Run {
  const transitioned = transitionRun(run, nextState);
  return {
    ...run,
    ...transitioned,
    updatedAt: new Date().toISOString(),
  };
}

function appendNormalizedProviderEvent(input: {
  store: InMemoryForgeStore;
  runId: string;
  event: ReturnType<typeof normalizeLiveProviderEvent>;
}): void {
  input.store.appendEvent({
    runId: input.runId,
    type: input.event.type,
    actorType: input.event.actorType,
    actorId: input.event.actorId,
    correlationId: input.event.correlationId,
    payload: input.event.payload,
  });
}

export async function executeRun(input: {
  store: InMemoryForgeStore;
  runId: string;
  sandboxProvider: SandboxProvider;
  codingAgentProvider: CodingAgentProvider;
  repositoryUrl: string;
  repositoryCredentialHandle: string;
  validationCommand?: string;
}): Promise<Run> {
  let run = input.store.getRun(input.runId);
  if (run.state !== "queued") {
    throw new Error(`Run must be queued before execution: ${run.state}`);
  }

  let sandboxId: string | null = null;
  try {
    run = move(run, "provisioning");
    input.store.saveRun(run);
    input.store.appendEvent({
      runId: run.id,
      type: "sandbox.provisioning_started",
      payload: {},
    });

    const sandbox = await input.sandboxProvider.create({
      runId: run.id,
      repositoryUrl: input.repositoryUrl,
      repositoryCredentialHandle: input.repositoryCredentialHandle,
      baseBranch: run.baseBranch,
      limits: {
        timeoutMs: 300_000,
        cpuMillis: 60_000,
        memoryMb: 2048,
        storageMb: 4096,
        allowedHosts: [],
      },
    });
    sandboxId = sandbox.sandboxId;

    run = {
      ...move(run, "running"),
      startedAt: new Date().toISOString(),
    };
    input.store.saveRun(run);
    appendNormalizedProviderEvent({
      store: input.store,
      runId: run.id,
      event: normalizeLiveProviderEvent({
        source: "sandbox",
        providerKey: input.sandboxProvider.key,
        externalRunId: sandboxId,
        cursor: `created:${sandboxId}`,
        event: { kind: "created", expiresAt: sandbox.expiresAt },
      }),
    });

    const task = input.store.getTask(run.taskId);
    const agent = await input.codingAgentProvider.start({
      runId: run.id,
      sandboxId,
      objective: task.normalizedObjective,
      acceptanceCriteria: task.acceptanceCriteria.map((item) => item.description),
      constraints: task.constraints,
      technicalOutputLanguage: task.technicalOutputLanguage,
    });
    input.store.appendEvent({
      runId: run.id,
      type: "agent.started",
      actorType: "provider",
      actorId: input.codingAgentProvider.key,
      payload: { externalRunId: agent.externalRunId },
    });

    for await (const item of input.codingAgentProvider.events({
      externalRunId: agent.externalRunId,
    })) {
      appendNormalizedProviderEvent({
        store: input.store,
        runId: run.id,
        event: normalizeLiveProviderEvent({
          source: "agent",
          providerKey: input.codingAgentProvider.key,
          externalRunId: agent.externalRunId,
          cursor: item.cursor,
          event: item.event,
        }),
      });
      if (item.event.type === "failed") {
        throw new Error(item.event.code);
      }
    }

    run = move(run, "validating");
    input.store.saveRun(run);
    const command = input.validationCommand ?? "pnpm test";
    const validation = await input.sandboxProvider.execute({
      sandboxId,
      command,
      args: [],
      timeoutMs: 120_000,
    });
    appendNormalizedProviderEvent({
      store: input.store,
      runId: run.id,
      event: normalizeLiveProviderEvent({
        source: "sandbox",
        providerKey: input.sandboxProvider.key,
        externalRunId: sandboxId,
        cursor: `validation:${run.id}`,
        event: {
          kind: "command.completed",
          command,
          exitCode: validation.exitCode,
          durationMs: validation.durationMs,
        },
      }),
    });
    input.store.saveValidation({
      id: randomUUID(),
      runId: run.id,
      kind: "test",
      command,
      requirement: "constitution",
      status: validation.exitCode === 0 ? "passed" : "failed",
      exitCode: validation.exitCode,
      durationMs: validation.durationMs,
      outputSummary: validation.stdout || validation.stderr || null,
      artifactRef: null,
    });

    for (const criterion of task.acceptanceCriteria) {
      input.store.saveEvidence({
        id: randomUUID(),
        runId: run.id,
        criterionKey: criterion.key,
        requirement: criterion.requirement,
        status: validation.exitCode === 0 ? "satisfied" : "not_satisfied",
        evidenceType: "validation",
        evidenceRef: null,
        explanation:
          validation.exitCode === 0
            ? "Deterministic validation passed"
            : "Deterministic validation failed",
        waivedBy: null,
        waivedReason: null,
        waivedAt: null,
      });
    }

    run = move(run, "awaiting_review");
    input.store.saveRun(run);
    input.store.appendEvent({
      runId: run.id,
      type: "review.ready",
      payload: { evidenceVersion: input.store.getEvidenceVersion(run.id) },
    });
    await input.sandboxProvider.destroy({ sandboxId });
    appendNormalizedProviderEvent({
      store: input.store,
      runId: run.id,
      event: normalizeLiveProviderEvent({
        source: "sandbox",
        providerKey: input.sandboxProvider.key,
        externalRunId: sandboxId,
        cursor: `destroyed:${sandboxId}`,
        event: { kind: "destroyed" },
      }),
    });
    return run;
  } catch (error) {
    if (sandboxId) {
      await input.sandboxProvider.destroy({ sandboxId }).catch(() => undefined);
    }
    if (["queued", "provisioning", "running", "awaiting_approval", "validating", "awaiting_review", "publishing"].includes(run.state)) {
      run = {
        ...move(run, "failed"),
        finishedAt: new Date().toISOString(),
        failureCode: error instanceof Error ? error.name : "EXECUTION_FAILED",
        failureSummary: error instanceof Error ? error.message : "Unknown execution failure",
      };
      input.store.saveRun(run);
      input.store.appendEvent({
        runId: run.id,
        type: "run.failed",
        payload: { failureCode: run.failureCode },
      });
    }
    throw error;
  }
}
