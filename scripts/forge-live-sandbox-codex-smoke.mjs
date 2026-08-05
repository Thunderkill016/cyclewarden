import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

const ENABLED = process.env.ATORYN_LIVE_SANDBOX_CODEX_SMOKE === "1";
const CONFIRMATION = process.env.ATORYN_LIVE_SANDBOX_CODEX_CONFIRM;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const CODEX_VERSION = process.env.ATORYN_LIVE_CODEX_VERSION ?? "0.146.0";
const MODEL = process.env.ATORYN_LIVE_CODEX_MODEL?.trim();
const REPORT_PATH =
  process.env.ATORYN_LIVE_SMOKE_REPORT_PATH ??
  "artifacts/forge-live-sandbox-codex-smoke.json";
const WORKSPACE = "/vercel/sandbox/atoryn-live-smoke";
const BROKERED_PLACEHOLDER = "atoryn-network-brokered-placeholder";

function required(condition, message) {
  if (!condition) throw new Error(message);
}

function elapsed(startedAt) {
  return Math.round(performance.now() - startedAt);
}

async function output(result, stream) {
  const value = result[stream];
  if (typeof value === "function") return value.call(result);
  return typeof value === "string" ? value : "";
}

async function run(sandbox, input) {
  const result = await sandbox.runCommand(input);
  const stdout = await output(result, "stdout");
  const stderr = await output(result, "stderr");
  return { exitCode: result.exitCode, stdout, stderr };
}

function parseJsonLines(text) {
  const events = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      // Codex may write non-JSON diagnostics beside the JSONL stream.
    }
  }
  return events;
}

function readUsage(events) {
  let usage = null;
  for (const event of events) {
    const candidate = event?.usage ?? event?.turn?.usage ?? event?.item?.usage;
    if (!candidate || typeof candidate !== "object") continue;
    usage = {
      inputTokens:
        candidate.input_tokens ?? candidate.inputTokens ?? usage?.inputTokens ?? null,
      cachedInputTokens:
        candidate.cached_input_tokens ??
        candidate.cachedInputTokens ??
        usage?.cachedInputTokens ??
        null,
      outputTokens:
        candidate.output_tokens ?? candidate.outputTokens ?? usage?.outputTokens ?? null,
      reasoningTokens:
        candidate.reasoning_output_tokens ??
        candidate.reasoningTokens ??
        usage?.reasoningTokens ??
        null,
      totalTokens:
        candidate.total_tokens ?? candidate.totalTokens ?? usage?.totalTokens ?? null,
    };
  }
  return usage;
}

function readThreadId(events) {
  for (const event of events) {
    const threadId = event?.thread_id ?? event?.threadId ?? event?.thread?.id;
    if (typeof threadId === "string" && threadId.length > 0) return threadId;
  }
  return null;
}

function readFinalMessage(events) {
  for (const event of [...events].reverse()) {
    const item = event?.item;
    if (
      item?.type === "agent_message" &&
      typeof (item.text ?? item.content) === "string"
    ) {
      return (item.text ?? item.content).slice(0, 1_000);
    }
    if (typeof event?.message === "string") return event.message.slice(0, 1_000);
  }
  return null;
}

async function main() {
  required(ENABLED, "Live sandbox/Codex smoke requires explicit opt-in");
  required(
    CONFIRMATION === "RUN:LIVE-SANDBOX-CODEX",
    "Live sandbox/Codex smoke requires exact confirmation",
  );
  required(
    typeof OPENAI_API_KEY === "string" && OPENAI_API_KEY.length >= 20,
    "OPENAI_API_KEY is required",
  );
  required(/^\d+\.\d+\.\d+$/.test(CODEX_VERSION), "Codex version must be pinned");

  const { Sandbox } = await import("@vercel/sandbox");
  const report = {
    schemaVersion: 1,
    status: "failed",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    codexVersion: CODEX_VERSION,
    model: MODEL ?? null,
    sandbox: {
      id: null,
      runtime: "node24",
      persistent: false,
      timeoutMs: 900_000,
      cleanup: { attempted: false, method: null, success: false, error: null },
    },
    timingsMs: {
      startup: null,
      dependencyInstall: null,
      agentRun: null,
      validation: null,
      cancellation: null,
      cleanup: null,
    },
    usage: null,
    codex: { threadId: null, exitCode: null, finalMessage: null },
    validation: { exitCode: null, stdout: null, stderr: null },
    error: null,
  };

  let sandbox = null;
  try {
    const startupStarted = performance.now();
    sandbox = await Sandbox.create({
      runtime: "node24",
      timeout: 900_000,
      persistent: false,
      env: { OPENAI_API_KEY: BROKERED_PLACEHOLDER },
    });
    report.timingsMs.startup = elapsed(startupStarted);
    report.sandbox.id = sandbox.sandboxId;

    await sandbox.updateNetworkPolicy({
      allow: ["registry.npmjs.org"],
    });

    const installStarted = performance.now();
    const install = await run(sandbox, {
      cmd: "npm",
      args: ["install", "--global", `@openai/codex@${CODEX_VERSION}`],
      stdout: process.stdout,
      stderr: process.stderr,
    });
    report.timingsMs.dependencyInstall = elapsed(installStarted);
    required(install.exitCode === 0, `Codex install failed with ${install.exitCode}`);

    const version = await run(sandbox, { cmd: "codex", args: ["--version"] });
    required(version.exitCode === 0, "Codex version check failed");
    required(
      version.stdout.includes(CODEX_VERSION),
      `Codex resolved unexpected version: ${version.stdout.trim()}`,
    );

    await sandbox.writeFiles([
      {
        path: `${WORKSPACE}/package.json`,
        content: Buffer.from(
          JSON.stringify(
            {
              name: "atoryn-live-smoke",
              private: true,
              type: "module",
              scripts: { test: "node --test" },
            },
            null,
            2,
          ),
        ),
      },
      {
        path: `${WORKSPACE}/src/sum.mjs`,
        content: Buffer.from(
          "export function sum(left, right) {\n  throw new Error('TODO: implement sum');\n}\n",
        ),
      },
      {
        path: `${WORKSPACE}/test/sum.test.mjs`,
        content: Buffer.from(
          "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { sum } from '../src/sum.mjs';\n\ntest('adds two finite numbers', () => {\n  assert.equal(sum(2, 3), 5);\n  assert.equal(sum(-4, 1.5), -2.5);\n});\n\ntest('rejects non-finite input', () => {\n  assert.throws(() => sum(Number.NaN, 1), /finite/);\n});\n",
        ),
      },
    ]);

    const initialize = await run(sandbox, {
      cmd: "bash",
      args: [
        "-lc",
        `cd ${WORKSPACE} && git init -q && git config user.name 'Atoryn Live Smoke' && git config user.email 'live-smoke@atoryn.invalid' && git add . && git commit -qm 'test: seed deterministic failing fixture'`,
      ],
    });
    required(initialize.exitCode === 0, "Fixture git initialization failed");

    await sandbox.updateNetworkPolicy({
      allow: {
        "api.openai.com": [
          {
            transform: [
              {
                headers: {
                  Authorization: `Bearer ${OPENAI_API_KEY}`,
                },
              },
            ],
          },
        ],
      },
    });

    const prompt = [
      "Fix the deterministic JavaScript fixture in this repository.",
      "Implement src/sum.mjs so sum(left, right) returns the sum of two finite numbers and throws an Error containing the word finite when either input is not finite.",
      "Change only files necessary for this task.",
      "Run npm test and stop after the tests pass.",
    ].join(" ");
    const codexArgs = [
      "exec",
      "--json",
      "--full-auto",
      "--ephemeral",
      "--skip-git-repo-check",
      "--ignore-user-config",
      ...(MODEL ? ["--model", MODEL] : []),
      prompt,
    ];
    const agentStarted = performance.now();
    const codex = await run(sandbox, {
      cmd: "codex",
      args: codexArgs,
      cwd: WORKSPACE,
      env: { OPENAI_API_KEY: BROKERED_PLACEHOLDER },
      stdout: process.stdout,
      stderr: process.stderr,
    });
    report.timingsMs.agentRun = elapsed(agentStarted);
    report.codex.exitCode = codex.exitCode;
    const events = parseJsonLines(codex.stdout);
    report.codex.threadId = readThreadId(events);
    report.codex.finalMessage = readFinalMessage(events);
    report.usage = readUsage(events);
    required(codex.exitCode === 0, `Codex exited with ${codex.exitCode}`);

    await sandbox.updateNetworkPolicy({ allow: [] });
    const validationStarted = performance.now();
    const validation = await run(sandbox, {
      cmd: "npm",
      args: ["test"],
      cwd: WORKSPACE,
    });
    report.timingsMs.validation = elapsed(validationStarted);
    report.validation.exitCode = validation.exitCode;
    report.validation.stdout = validation.stdout.slice(0, 4_000);
    report.validation.stderr = validation.stderr.slice(0, 4_000);
    required(validation.exitCode === 0, "Post-Codex validation failed");

    const credentialProbe = await run(sandbox, {
      cmd: "node",
      args: ["-p", "process.env.OPENAI_API_KEY"],
    });
    required(
      credentialProbe.stdout.trim() === BROKERED_PLACEHOLDER,
      "Sandbox observed a credential other than the brokered placeholder",
    );

    report.status = "passed";
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    if (sandbox) {
      report.sandbox.cleanup.attempted = true;
      const cleanupStarted = performance.now();
      try {
        await sandbox.updateNetworkPolicy({ allow: [] }).catch(() => undefined);
        if (typeof sandbox.delete === "function") {
          report.sandbox.cleanup.method = "delete";
          await sandbox.delete();
        } else {
          report.sandbox.cleanup.method = "stop";
          await sandbox.stop();
        }
        report.sandbox.cleanup.success = true;
      } catch (error) {
        report.sandbox.cleanup.error =
          error instanceof Error ? error.message : String(error);
      }
      report.timingsMs.cleanup = elapsed(cleanupStarted);
    }
    report.finishedAt = new Date().toISOString();
    await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, {
      encoding: "utf8",
    });
    if (!report.sandbox.cleanup.success) {
      process.exitCode = 1;
    }
  }
}

await main();
