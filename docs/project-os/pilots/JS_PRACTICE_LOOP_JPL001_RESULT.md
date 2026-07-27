# JS Practice Loop — JPL-001 implementation result

## Starting contract

`JPL-001` had one intended outcome: a learner records a real JavaScript exercise and their own unfinished attempt, saves it locally, reloads the page and recovers the same record.

The implementation was deliberately stacked on the CycleWarden Project OS pilot instead of merged into `main`.

## Scope correction discovered during review

The initial roadmap fixture listed separate title, source and solved/stuck fields. Those fields were inconsistent with the shaping document's smaller first useful outcome and were not needed for create-save-reload.

They were removed explicitly from JPL-001 and recorded as deferred, rather than silently omitted or added to the product without evidence.

The accepted scope was:

- JavaScript exercise text;
- learner's own attempt text;
- inline validation;
- versioned local storage through a repository boundary;
- recent-attempt list;
- persistence after a full reload;
- plain-text rendering with no execution surface.

## Implementation

The isolated app under `examples/js-practice-loop/` uses:

- React and TypeScript through Vite;
- semantic HTML and plain CSS;
- a domain validation module;
- `LocalPracticeRepository` as the only storage boundary;
- versioned JSON in browser `localStorage`;
- Vitest and Playwright.

No backend, authentication, cloud database, AI SDK, router, analytics library, component library or code-execution mechanism was introduced.

## Automated evidence

GitHub Actions run `30227650052` passed on commit `49cd7de0554be6733d012e32590a5ac9d7fe8f54`:

- deterministic scope guard;
- domain and storage unit tests;
- TypeScript and Vite production build;
- create-save-reload browser proof;
- malicious HTML/event-handler input remaining plain text;
- required mobile screenshots.

Artifact `8639028319` contains the empty and saved Pixel 7 viewport states.

## Owner acceptance

On `2026-07-27`, the owner reviewed the empty and saved mobile states and explicitly accepted `JPL-001`.

The task is now `done`. This acceptance confirms that the bounded create-save-reload slice is satisfactory. It does not prove that JS Practice Loop improves learning outcomes; that claim still requires real exercise use over time.

`JPL-002 — Record the mistake and lesson learned` is now the only active task. Retry scheduling, analytics, backend, authentication, sync, AI hints, code execution and gamification remain out of scope.

## Pilot finding: verification was not represented correctly

The implementation exposed a CycleWarden lifecycle defect. The schema allowed `verify`, but the original CLI only treated `active` as current work. A task could therefore disappear from `status` and `next` while waiting for owner acceptance.

Draft PR #65 corrects this by treating `active` and `verify` as mutually exclusive current-task states. The real acceptance transition then moved `JPL-001` from `verify` to `done` and activated `JPL-002`.

## What this proves

The pilot now demonstrates:

1. vague idea shaping;
2. explicit product and foundation decisions;
3. one active implementation task;
4. scoped coding-agent handoff;
5. deterministic scope enforcement;
6. automated implementation verification;
7. owner acceptance as a separate gate;
8. deterministic advancement to the next dependency-ready task;
9. a real CW defect discovered and fixed from use.

## What this does not prove

It does not prove the product improves learning. That requires the owner to record and revisit real exercises.

It also does not prove every future slice is valuable. `JPL-002` must remain bounded to editable mistake-and-lesson reflection and pass its own evidence and owner-acceptance cycle.
