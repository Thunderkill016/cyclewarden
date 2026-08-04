# Atoryn Forge live-provider spike results

This file records evidence for Phase 9 tasks T078-T080. A harness or workflow definition is not acceptance evidence by itself. A task may be marked complete only after the corresponding protected workflow succeeds and its artifact is reviewed.

## Evidence status

| Task | Evidence required | Status | Evidence |
|---|---|---|---|
| T078 live GitHub contract | Disposable repository, exact-head draft PR, idempotent replay, unchanged base branch, successful cleanup | Pending external run | Manual workflow `Forge live GitHub contract`; requires a repository explicitly named as disposable plus the protected environment secret |
| T079 live sandbox/Codex smoke | Ephemeral Vercel sandbox, deterministic JavaScript change by Codex, passing validation, usage capture, successful cleanup | Pending external run | Manual workflow `Forge live sandbox Codex smoke`; JSON artifact is uploaded even on failure |
| T080 measured spike report | Reviewed artifacts for startup, dependency installation, model usage, sandbox usage, cancellation, and cleanup | Pending evidence review | Populate the measurements table from successful workflow artifacts; do not estimate missing values |

## Required measurements

| Measurement | GitHub contract | Sandbox/Codex smoke | Result |
|---|---:|---:|---|
| Startup time | Not applicable | Required | Pending |
| Dependency-install time | Not applicable | Required | Pending |
| Model usage | Not applicable | Required | Pending |
| Sandbox usage | Not applicable | Required | Pending |
| Cancellation time | Not applicable | Required before T080 completion | Pending |
| Cleanup result | Required | Required | Pending |

## Live GitHub contract acceptance

Record these values after a successful run:

- workflow run URL and run ID;
- commit SHA containing the harness;
- disposable repository name;
- base branch and unchanged base SHA;
- created head SHA, working branch, and draft pull-request number;
- replay result proving the same branch and pull request were reused;
- pull-request close result and branch-deletion result;
- confirmation that the production repository was not targeted.

## Live sandbox/Codex smoke acceptance

The smoke fixture begins with a failing `sum(left, right)` implementation and two deterministic Node.js tests. Codex must implement finite-number addition and run the tests successfully.

Record these values from `forge-live-sandbox-codex-smoke.json`:

- workflow run URL and run ID;
- commit SHA containing the harness;
- resolved Vercel Sandbox SDK and Codex CLI versions;
- sandbox ID, runtime, persistence setting, timeout, and cleanup method;
- startup, Codex installation, agent execution, validation, and cleanup timings;
- Codex thread ID and model;
- input, cached-input, output, reasoning, and total token usage when reported;
- validation exit code and concise output;
- proof that the sandbox observed only the non-secret broker placeholder;
- cleanup success or the exact cleanup failure.

## Cancellation measurement

The deterministic success smoke does not manufacture a cancellation result. Before T080 is complete, add a separate opt-in cancellation probe that starts a controllable Codex turn, interrupts it, cleans background terminals, and measures the interval from the cancellation request to confirmed terminal cleanup. Keep this row pending until that probe succeeds.

## Decision record

- Existing product repositories are not disposable fixtures.
- Provider harnesses may be merged while live tasks remain unchecked.
- No timing or usage value may be inferred from unit tests or mocked providers.
- Secrets, installation tokens, and private keys must never appear in workflow artifacts.
