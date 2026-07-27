# JS Practice Loop agent instructions

The active task is `JPL-003`: let the learner manually mark a reflected attempt, make a fresh retry while prior work is hidden, then compare after submission.

## Allowed scope

- manual `needsRetry` state on a reflected attempt;
- a fresh retry record appended to the same attempt;
- schema v1/v2 loading and schema v3 writes;
- a retry form that shows the exercise but hides the previous attempt, mistake and lesson;
- reveal and comparison only after a valid fresh attempt is saved;
- focused domain, migration, browser and mobile evidence.

## Forbidden scope

Do not add:

- AI hints, generated answers, grading or model-provider calls;
- code execution, `eval`, `Function`, iframe sandboxes or HTML injection;
- fixed review intervals, due dates, notifications or spaced repetition;
- mistake taxonomy, scores, analytics, streaks or gamification;
- authentication, backend APIs, Supabase, Firebase, cloud databases or sync;
- routers, dashboards, broad navigation or component libraries;
- JPL-004 history/grouping behavior or later roadmap slices.

## Architecture rules

- UI components must not access `localStorage` directly.
- Existing schema-v1 and schema-v2 attempts must load without data loss.
- New writes use schema version 3.
- Learner text must be rendered as text, never as HTML.
- A retry appends to the same attempt instead of duplicating the original.
- Previous attempt and reflection text must not be rendered while the fresh retry form is active.
- Review selection is manual; do not invent a schedule.

## Verification

Run inside this directory:

```bash
npm test
npm run build
npm run test:e2e
```

Report exact results. Automated checks may move JPL-003 to `verify`; only the owner may accept it as `done`.
