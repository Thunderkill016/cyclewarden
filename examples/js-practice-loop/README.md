# JS Practice Loop — JPL-003

This isolated pilot tests the third bounded CycleWarden greenfield slice.

## User outcome

A learner can:

1. create a JavaScript attempt;
2. record what was wrong and what they learned;
3. manually mark the reflected attempt as needing another try;
4. make a fresh attempt while all previous work is hidden;
5. submit the fresh attempt and then compare it with the original and reflection;
6. reload and recover the retry history.

## Review decision

JPL-003 uses a manual review queue. It does not use fixed intervals, due dates, notifications or spaced-repetition scoring because the project does not yet have enough real retry data to justify them.

## Data compatibility

- JPL-001 stored schema version 1.
- JPL-002 stored schema version 2.
- JPL-003 reads both safely and writes schema version 3.

## Deliberate boundaries

This slice keeps React, TypeScript, Vite, plain CSS, versioned `localStorage`, Vitest and Playwright.

It does **not** add AI, generated answers, grading, code execution, accounts, backend APIs, cloud databases, sync, analytics, scores, streaks, scheduling, mistake taxonomy, broad navigation or a component library.

## Commands

```bash
npm install
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

## Acceptance boundary

Passing checks proves only that manual selection, hidden-work retry, migration and persistence behave as specified. It does not prove that retries improve learning or that a review schedule is needed. Owner review and real use remain separate evidence.
