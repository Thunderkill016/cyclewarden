# JS Practice Loop — JPL-001 implementation result

## Starting contract

`JPL-001` had one intended outcome: a learner records a real JavaScript exercise and their own unfinished attempt, saves it locally, reloads the page and recovers the same record.

The implementation was deliberately stacked on the CycleWarden Project OS pilot instead of merged into `main`.

## Scope correction discovered during review

The initial roadmap fixture listed separate title, source and solved/stuck fields. Those fields were inconsistent with the shaping document's smaller first useful outcome and were not needed for create-save-reload.

They were removed explicitly from JPL-001 and recorded as deferred, rather than silently omitted or added to the product without evidence.

The accepted verification scope is now:

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

## Pilot finding: verification was not represented correctly

The implementation exposed a CycleWarden lifecycle defect. The schema allowed `verify`, but the original CLI only treated `active` as current work. A task could therefore disappear from `status` and `next` while waiting for owner acceptance.

Draft PR #65 corrects this by treating `active` and `verify` as mutually exclusive current-task states. JPL-001 remains current in `verify`; JPL-002 stays blocked.

## What this proves

The pilot now demonstrates:

1. vague idea shaping;
2. explicit product and foundation decisions;
3. one active implementation task;
4. scoped coding-agent handoff;
5. deterministic scope enforcement;
6. automated implementation verification;
7. preservation of owner acceptance as a separate gate;
8. a real CW defect discovered and fixed from use.

## What this does not prove

It does not prove the product improves learning. That requires the owner to review the UI and use it for real exercises.

JPL-001 must not become `done` and JPL-002 must not start until the owner accepts the first slice.
