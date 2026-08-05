# Atoryn Forge live-provider spike results

This file records evidence for Phase 9 tasks T078-T080. A harness or workflow definition is not acceptance evidence by itself. A task may be marked complete only after the corresponding protected workflow succeeds and its artifact is reviewed.

## Evidence status

| Task | Evidence required | Status | Evidence |
|---|---|---|---|
| T078 live GitHub contract | Disposable repository, exact-head draft PR, idempotent replay, unchanged base branch, successful cleanup | Pending protected credential | Tracked attempt `30980978118` reached the protected job, but `ATORYN_LIVE_GITHUB_TOKEN` was absent; no repository was created |
| T079 live sandbox/Codex smoke | Ephemeral Vercel sandbox, deterministic JavaScript change by Codex, passing validation, usage capture, successful cleanup | Pending protected credentials | Tracked attempt `30980978118` uploaded a preflight artifact proving all four required credentials were absent; no sandbox or model call was created |
| T080 measured spike report | Reviewed artifacts for startup, dependency installation, model usage, sandbox usage, cancellation, and cleanup | Pending successful T078/T079 plus cancellation probe | No timing or usage value was manufactured from the failed preflight attempt |

## Required measurements

| Measurement | GitHub contract | Sandbox/Codex smoke | Result |
|---|---:|---:|---|
| Startup time | Not applicable | Required | Pending |
| Dependency-install time | Not applicable | Required | Pending |
| Model usage | Not applicable | Required | Pending |
| Sandbox usage | Not applicable | Required | Pending |
| Cancellation time | Not applicable | Required before T080 completion | Pending |
| Cleanup result | Required | Required | Pending |

## Protected live attempt — 2026-08-05

- Workflow: `Forge tracked live evidence` run `30980978118`.
- Run URL: `https://github.com/Thunderkill016/cyclewarden/actions/runs/30980978118`.
- Tracking PR: `#88`.
- Head commit: `197102887f0f90b2cbcd22c7b8d4c48946d6a451`.
- Pull-request merge-ref commit observed by Actions: `563014d3eafa7486a6800ed89c1bdced4737a982`.

### GitHub contract preflight

The `github-contract` job entered environment `live-github-contract` and failed before repository creation because `ATORYN_LIVE_GITHUB_TOKEN` resolved to an empty value. The disposable repository creation command, provider contract, draft pull request, and cleanup path were therefore not executed. No existing product repository was targeted and no GitHub resource was left behind.

### Sandbox/Codex preflight

The `sandbox-codex-smoke` job entered environment `live-sandbox-codex`. Artifact `forge-live-sandbox-codex-smoke` (`8920114009`, SHA-256 `70b7fd37817f9a4e51a2e697418503e328cd9426a9cfe7562dc8be705a962ee4`) recorded:

```json
{
  "openaiApiKey": false,
  "vercelToken": false,
  "vercelTeamId": false,
  "vercelProjectId": false
}
```

The job stopped before installing the Vercel Sandbox SDK, creating a sandbox, invoking Codex, or consuming model/sandbox resources. No cleanup action was necessary and no external cost was incurred by this tracked attempt.

### Required protected configuration before retry

Configure these exact environment secrets in `Thunderkill016/cyclewarden`:

- environment `live-github-contract`: `ATORYN_LIVE_GITHUB_TOKEN` with permission to create, write to, and delete an explicitly disposable repository;
- environment `live-sandbox-codex`: `OPENAI_API_KEY`, `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, and `VERCEL_PROJECT_ID`.

After configuration, re-run the existing manual workflows. T078 and T079 remain unchecked until successful artifacts are reviewed. T080 additionally remains blocked on a real cancellation probe and its measured cleanup interval.

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
